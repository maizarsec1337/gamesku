<?php
// Pembayaran (admin): catat & kelola pembayaran sebuah pesanan + jejak event.
// Mengacu snapshot total pesanan (pesanan.total), bukan hitung ulang dari klien.
// Idempotensi: uniq_pembayaran_pesanan + uniq_pembayaran_idem + uniq_transaction.

class PengendaliPembayaran extends PengendaliDasar
{
    private const STATUS = ['Menunggu konfirmasi', 'Dikonfirmasi', 'Lunas', 'Gagal', 'Dikembalikan'];

    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        // /api/pembayaran/pesanan/{pesananId}
        if ($id === 'pesanan') {
            Auth::wajib();
            if ($metode !== 'GET') $this->metodeTakDiizinkan();
            $this->perPesanan($sub);
            return;
        }

        switch ($metode) {
            case 'GET':
                Auth::wajib();
                $id === null ? $this->daftar() : $this->satu($id);
                break;
            case 'POST':
                Auth::wajib();
                $this->validateCsrf();
                $this->buat();
                break;
            case 'PUT':
            case 'PATCH':
                Auth::wajib();
                $this->validateCsrf();
                $this->ubah($id);
                break;
            default:
                $this->metodeTakDiizinkan();
        }
    }

    private const PILIH = 'SELECT id, pesanan_id AS pesananId, kode_idempotensi AS kodeIdempotensi,
        nominal, mata_uang AS mataUang, metode, akun_pembayaran AS akunPembayaran, referensi,
        transaction_id AS transactionId, status, dibuat_pada AS dibuatPada,
        dikonfirmasi_pada AS dikonfirmasiPada, gagal_pada AS gagalPada,
        dikembalikan_pada AS dikembalikanPada, nominal_refund AS nominalRefund,
        konfirmasi_admin AS konfirmasiAdmin, catatan, diperbarui_pada AS diperbaruiPada
        FROM pembayaran';

    private function petakan(array $r): array
    {
        foreach (['nominal', 'nominalRefund'] as $k) {
            if (isset($r[$k])) $r[$k] = (int) $r[$k];
        }
        return $r;
    }

    private function daftar(): void
    {
        $where = [];
        $param = [];
        $status = $this->teks('status');
        if ($status !== '' && in_array($status, self::STATUS, true)) {
            $where[] = 'status = ?';
            $param[] = $status;
        }
        $pesananId = $this->teks('pesananId');
        if ($pesananId !== '') {
            $where[] = 'pesanan_id = ?';
            $param[] = $pesananId;
        }
        $sql = self::PILIH;
        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        $sql .= ' ORDER BY dibuat_pada DESC, id DESC LIMIT 500';
        Bantu::sukses(array_map(fn($r) => $this->petakan($r), Database::banyak($sql, $param)));
    }

    private function satu(string $id): void
    {
        $baris = Database::satu(self::PILIH . ' WHERE id = ?', [$id]);
        if (!$baris) Bantu::gagal('Pembayaran tidak ditemukan.', 404);
        $hasil = $this->petakan($baris);
        $hasil['event'] = Database::banyak(
            'SELECT jenis, status_saat_itu AS statusSaatItu, payload_ringkas AS payloadRingkas,
                dibuat_pada AS dibuatPada
             FROM pembayaran_event WHERE pembayaran_id = ? ORDER BY id ASC',
            [$id]
        );
        Bantu::sukses($hasil);
    }

    private function perPesanan(?string $pesananId): void
    {
        if (!$pesananId) Bantu::gagal('ID pesanan wajib ada.', 400);
        $baris = Database::satu(self::PILIH . ' WHERE pesanan_id = ? LIMIT 1', [$pesananId]);
        Bantu::sukses($baris ? $this->petakan($baris) : null);
    }

    private function buat(): void
    {
        $pesananId = $this->teks('pesananId');
        if ($pesananId === '') Bantu::gagal('pesananId wajib diisi.');

        $pesanan = Database::satu('SELECT id, total, pelanggan_nama, status FROM pesanan WHERE id = ?', [$pesananId]);
        if (!$pesanan) Bantu::gagal('Pesanan tidak ditemukan.', 404);

        // Satu pembayaran per pesanan (uniq_pembayaran_pesanan).
        $ada = Database::satu('SELECT id FROM pembayaran WHERE pesanan_id = ?', [$pesananId]);
        if ($ada) {
            Bantu::gagal('Pesanan ini sudah memiliki data pembayaran.', 409);
        }

        // Kode idempotensi: dari klien bila valid, jika tidak dibuat server.
        $kode = trim($this->teks('kodeIdempotensi'));
        if ($kode !== '' && !preg_match('/^[A-Za-z0-9\-_]{8,64}$/', $kode)) {
            Bantu::gagal('kodeIdempotensi tidak valid.', 400);
        }
        if ($kode === '') {
            $kode = Bantu::idBaruAman('pay');
        }

        $nominal = $this->angka('nominal', (int) $pesanan['total']);
        if ($nominal < 0) $nominal = 0;

        $metode   = Bantu::potong($this->teks('metode'), 60);
        $akun     = Bantu::potong($this->teks('akunPembayaran'), 255);
        $referensi = Bantu::potong($this->teks('referensi'), 255) ?: null;
        $transaksi = Bantu::potong($this->teks('transactionId'), 120) ?: null;
        $catatan  = Bantu::potong($this->teks('catatan'), 255);

        $id = Bantu::idBaruAman('pay');
        try {
            Database::transaksi(function () use ($id, $pesananId, $kode, $nominal, $metode, $akun, $referensi, $transaksi, $catatan) {
                Database::eksekusi(
                    'INSERT INTO pembayaran (id, pesanan_id, kode_idempotensi, nominal, metode,
                        akun_pembayaran, referensi, transaction_id, status, catatan)
                     VALUES (?,?,?,?,?,?,?,?,?,?)',
                    [$id, $pesananId, $kode, $nominal, $metode, $akun, $referensi, $transaksi, 'Menunggu konfirmasi', $catatan]
                );
                $this->catatEvent($id, $kode, 'dibuat', 'Menunggu konfirmasi', ['nominal' => $nominal, 'metode' => $metode]);
            });
        } catch (PDOException $e) {
            if ((string) $e->getCode() === '23000') {
                Bantu::gagal('Pembayaran untuk pesanan/kode ini sudah ada.', 409);
            }
            throw $e;
        }

        Aktivitas::audit('buat_pembayaran', 'pembayaran', $id, 'Berhasil', [
            'pesananId' => $pesananId, 'nominal' => $nominal, 'metode' => $metode,
        ], "Pembayaran untuk pesanan {$pesananId} dibuat");
        Bantu::sukses(['id' => $id, 'pesananId' => $pesananId, 'nominal' => $nominal, 'status' => 'Menunggu konfirmasi'], 'Pembayaran dibuat.', 201);
    }

    private function ubah(?string $id): void
    {
        if (!$id) Bantu::gagal('ID pembayaran wajib ada.', 400);
        $lama = Database::satu('SELECT id, kode_idempotensi, status FROM pembayaran WHERE id = ?', [$id]);
        if (!$lama) Bantu::gagal('Pembayaran tidak ditemukan.', 404);

        $status = $this->salahDari($this->teks('status', $lama['status']), self::STATUS, $lama['status']);
        $nominalRefund = max(0, $this->angka('nominalRefund', 0));
        $catatan = Bantu::potong($this->teks('catatan'), 255);
        $transaksi = Bantu::potong($this->teks('transactionId'), 120) ?: null;
        $pengguna = (string) (($_SESSION['admin']['pengguna'] ?? '') ?: 'admin');

        $set = ['status = ?'];
        $param = [$status];
        if ($catatan !== '') { $set[] = 'catatan = ?'; $param[] = $catatan; }
        if ($transaksi !== null) { $set[] = 'transaction_id = ?'; $param[] = $transaksi; }
        if ($status === 'Dikonfirmasi' || $status === 'Lunas') {
            $set[] = 'dikonfirmasi_pada = COALESCE(dikonfirmasi_pada, NOW())';
            $set[] = 'konfirmasi_admin = ?';
            $param[] = $pengguna;
        }
        if ($status === 'Gagal') {
            $set[] = 'gagal_pada = COALESCE(gagal_pada, NOW())';
        }
        if ($status === 'Dikembalikan') {
            $set[] = 'dikembalikan_pada = COALESCE(dikembalikan_pada, NOW())';
            $set[] = 'nominal_refund = ?';
            $param[] = $nominalRefund;
        }
        $param[] = $id;

        try {
            Database::transaksi(function () use ($id, $lama, $status, $set, $param) {
                Database::eksekusi('UPDATE pembayaran SET ' . implode(', ', $set) . ' WHERE id = ?', $param);
                $this->catatEvent($id, (string) $lama['kode_idempotensi'], 'ubah_status', $status, []);
            });
        } catch (PDOException $e) {
            if ((string) $e->getCode() === '23000') {
                Bantu::gagal('transactionId sudah dipakai pembayaran lain.', 409);
            }
            throw $e;
        }

        Aktivitas::audit('ubah_status_pembayaran', 'pembayaran', $id, 'Berhasil', [
            'statusLama' => $lama['status'], 'statusBaru' => $status,
        ], "Status pembayaran {$id} diubah ke {$status}", true);
        Bantu::sukses(['id' => $id, 'status' => $status], 'Pembayaran diperbarui.');
    }

    // Catat event pembayaran (idempoten per (pembayaran, kode, jenis)).
    private function catatEvent(string $pembayaranId, string $kode, string $jenis, ?string $status, array $payload): void
    {
        try {
            Database::eksekusi(
                'INSERT IGNORE INTO pembayaran_event (pembayaran_id, kode_idempotensi, jenis, status_saat_itu, payload_ringkas)
                 VALUES (?,?,?,?,?)',
                [
                    $pembayaranId,
                    Bantu::potong($kode, 64),
                    Bantu::potong($jenis, 40),
                    $status !== null ? Bantu::potong($status, 30) : null,
                    $payload !== [] ? Bantu::potong(json_encode($payload, JSON_UNESCAPED_UNICODE), 500) : null,
                ]
            );
        } catch (Throwable $e) {
            // Jejak event bersifat sampingan; jangan gagalkan transaksi utama.
        }
    }
}
