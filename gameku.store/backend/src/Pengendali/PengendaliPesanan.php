<?php
// Pesanan + item; semua angka checkout dihitung server dari harga di DB.

class PengendaliPesanan extends PengendaliDasar
{
    private const STATUS = ['Menunggu', 'Diproses', 'Berhasil', 'Gagal'];
    private const BIAYA_LAYANAN = 1000;

    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        switch ($metode) {
            case 'POST':
                $this->validateCsrf();
                $this->checkout();
                break;
            case 'GET':
                Auth::wajib();
                $id === null ? $this->daftar() : $this->satu($id);
                break;
            case 'PUT':
            case 'PATCH':
                Auth::wajib();
                $this->validateCsrf();
                $this->ubahStatus($id);
                break;
            case 'DELETE':
                Auth::wajib();
                $this->validateCsrf();
                $this->hapus($id);
                break;
            default:
                $this->metodeTakDiizinkan();
        }
    }

    private function petakan(array $r): array
    {
        return [
            'id'           => $r['id'],
            'pelangganId'  => $r['pelangganId'],
            'pelanggan'    => $r['pelanggan'],
            'email'        => $r['email'],
            'whatsapp'     => $r['whatsapp'],
            'produk'       => $r['produk'],
            'kategori'     => $r['kategori'],
            'metode'       => $r['metode'],
            'subtotal'     => (int) $r['subtotal'],
            'biayaLayanan' => (int) $r['biayaLayanan'],
            'potongan'     => (int) $r['potongan'],
            'total'        => (int) $r['total'],
            'promo'        => $r['promo'],
            'status'       => $r['status'],
            'catatan'      => $r['catatan'],
            'dibuatPada'   => $r['dibuatPada'],
            'diperbaruiPada' => $r['diperbaruiPada'],
        ];
    }

    private const PILIH = 'SELECT id, pelanggan_id AS pelangganId, pelanggan_nama AS pelanggan, email, whatsapp,
        produk_ringkas AS produk, kategori, metode, subtotal, biaya_layanan AS biayaLayanan, potongan, total,
        kode_promo AS promo, status, catatan, dibuat_pada AS dibuatPada, diperbarui_pada AS diperbaruiPada
        FROM pesanan';

    private function daftar(): void
    {
        $where = [];
        $param = [];

        $status = Bantu::teks('status');
        if ($status !== '' && in_array($status, self::STATUS, true)) {
            $where[] = 'status = ?';
            $param[] = $status;
        }
        $cari = Bantu::teks('cari');
        if ($cari !== '') {
            $where[] = '(id LIKE ? OR pelanggan_nama LIKE ? OR produk_ringkas LIKE ?)';
            $like = '%' . $cari . '%';
            array_push($param, $like, $like, $like);
        }

        $sql = self::PILIH;
        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        $sql .= ' ORDER BY dibuat_pada DESC, id DESC LIMIT 500';

        Bantu::sukses(array_map(fn($r) => $this->petakan($r), Database::banyak($sql, $param)));
    }

    private function satu(string $id): void
    {
        $baris = Database::satu(self::PILIH . ' WHERE id = ?', [$id]);
        if (!$baris) Bantu::gagal('Pesanan tidak ditemukan.', 404);

        $item = Database::banyak(
            'SELECT produk_id AS produkId, nama, harga, jumlah, subtotal
             FROM pesanan_item WHERE pesanan_id = ? ORDER BY id ASC',
            [$id]
        );
        $hasil = $this->petakan($baris);
        $hasil['item'] = $item;
        Bantu::sukses($hasil);
    }

    // Checkout publik: hitung ulang dari harga di DB (bukan dari klien).
    // Terima: item[{produkId,nama?,jumlah}], kodePromo?, pembeli{}, metode?,
    //          idempotencyKey? (opsional, cegah pesanan ganda saat retry).
    private function checkout(): void
    {
        $badan = $this->badan();
        $itemMasuk = $badan['item'] ?? [];
        if (!is_array($itemMasuk) || $itemMasuk === []) {
            Bantu::gagal('Keranjang kosong.');
        }

        // ===== Idempotensi: bila klien mengirim key yang sama dalam jendela
        // pendek, kembalikan pesanan yang sudah ada (retry aman, tanpa dobel). =====
        $idempotencyKey = trim((string) ($badan['idempotencyKey'] ?? ''));
        if ($idempotencyKey !== '') {
            if (!preg_match('/^[A-Za-z0-9\-_]{8,64}$/', $idempotencyKey)) {
                Bantu::gagal('Kunci idempotensi tidak valid.', 400);
            }
            $lama = Database::satu(
                'SELECT id, subtotal, biaya_layanan, potongan, total, status
                 FROM pesanan WHERE idempotency_key = ? LIMIT 1',
                [$idempotencyKey]
            );
            if ($lama) {
                Bantu::sukses([
                    'id' => $lama['id'], 'subtotal' => (int) $lama['subtotal'],
                    'biayaLayanan' => (int) $lama['biaya_layanan'], 'potongan' => (int) $lama['potongan'],
                    'total' => (int) $lama['total'], 'status' => $lama['status'],
                ], 'Pesanan sudah tercatat.', 200);
                return;
            }
        }

        // Bangun ulang baris item HANYA dari harga produk di DB.
        // Harga dari klien TIDAK PERNAH dipakai — meski produkId kosong pun
        // item tanpa produkId valid ditolak (cegah price manipulation).
        $barisItem = [];
        $subtotal = 0;
        $namaRingkas = [];
        $kategoriPertama = '';

        foreach ($itemMasuk as $it) {
            if (!is_array($it)) continue;
            $jumlah = max(1, min(10, (int) round((float) ($it['jumlah'] ?? 1))));
            $produkId = trim((string) ($it['produkId'] ?? ''));

            // WAJIB punya produkId & produk harus ada & status Aktif.
            if ($produkId === '') {
                SecurityLog::catat('checkout_ditolak', 'warn', 'Item tanpa produkId (kemungkinan manipulasi harga).', [
                    'kunci' => Bantu::potong((string) ($it['nama'] ?? ''), 80),
                ]);
                Bantu::gagal('Item keranjang tidak valid: produkId wajib diisi.', 422);
            }
            $p = Database::satu(
                'SELECT id, nama, harga, kategori_id, status FROM produk WHERE id = ?',
                [$produkId]
            );
            if (!$p) {
                Bantu::gagal('Salah satu produk tidak ditemukan.', 422);
            }
            // Hanya produk Aktif yang bisa dibeli (Draft/Nonaktif ditolak).
            if (($p['status'] ?? '') !== 'Aktif') {
                SecurityLog::catat('checkout_ditolak', 'warn', 'Item non-Aktif di checkout.', [
                    'produkId' => $produkId, 'status' => $p['status'] ?? '',
                ]);
                Bantu::gagal('Produk "' . $p['nama'] . '" tidak tersedia untuk dibeli.', 422);
            }

            $harga = (int) $p['harga']; // harga dari DB — bukan dari klien
            $nama  = $p['nama'];
            if ($kategoriPertama === '' && $p['kategori_id']) {
                $kat = Database::satu('SELECT nama FROM kategori WHERE id = ?', [$p['kategori_id']]);
                $kategoriPertama = $kat['nama'] ?? '';
            }

            $subBaris = $harga * $jumlah;
            $subtotal += $subBaris;
            $namaRingkas[] = $nama;
            $barisItem[] = [
                'produk_id' => $produkId,
                'nama'      => $nama,
                'harga'     => $harga,
                'jumlah'    => $jumlah,
                'subtotal'  => $subBaris,
            ];
        }

        if ($barisItem === []) Bantu::gagal('Item keranjang tidak valid.');

        // Potongan promo (bila berlaku).
        $kodePromo = strtoupper(Bantu::potong((string) ($badan['kodePromo'] ?? ''), 40));
        $potongan = 0;
        $promoDipakai = null;
        if ($kodePromo !== '' && $subtotal > 0) {
            $promo = Database::satu(
                "SELECT id, kode, diskon, batas, terpakai FROM promo WHERE kode = ? AND status = 'Aktif'",
                [$kodePromo]
            );
            if ($promo && (int) $promo['terpakai'] < (int) $promo['batas']) {
                $diskon = (int) $promo['diskon'];
                // Diskon 0 => gratis biaya layanan; jika ada %, batas Rp50.000.
                $potongan = $diskon === 0
                    ? self::BIAYA_LAYANAN
                    : min((int) round($subtotal * $diskon / 100), 50000);
                $promoDipakai = $promo;
            }
        }

        $biayaLayanan = self::BIAYA_LAYANAN;
        $total = max($subtotal + $biayaLayanan - $potongan, 0);

        // Data pembeli.
        $pembeli = is_array($badan['pembeli'] ?? null) ? $badan['pembeli'] : [];
        $namaPembeli = Bantu::potong((string) ($pembeli['nama'] ?? ($badan['nama'] ?? '')), 120);
        $email       = Bantu::potong((string) ($pembeli['email'] ?? ''), 150);
        $whatsapp    = Bantu::potong((string) ($pembeli['whatsapp'] ?? ''), 40);
        $metode      = Bantu::potong((string) ($badan['metode'] ?? ''), 60);
        $produkRingkas = Bantu::potong(implode(', ', array_unique($namaRingkas)), 255);

        // Nomor pesanan unik.
        $nomor = Bantu::nomorPesanan();
        while (Database::satu('SELECT id FROM pesanan WHERE id = ?', [$nomor])) {
            $nomor = Bantu::nomorPesanan();
        }

        $hasil = null;
        try {
            $hasil = $this->simpanPesanan(
                $nomor, $namaPembeli, $email, $whatsapp, $metode, $produkRingkas, $kategoriPertama,
                $subtotal, $biayaLayanan, $potongan, $total, $kodePromo, $barisItem, $promoDipakai,
                $idempotencyKey
            );
        } catch (RuntimeException $e) {
            // Kuota promo habis saat transaksi (race) — pesan jelas, bukan 500.
            if (strpos($e->getMessage(), 'promo') !== false) {
                Bantu::gagal('Kuota kode promo sudah habis. Silakan tanpa kode promo.', 409);
            }
            throw $e;
        } catch (PDOException $e) {
            // Race idempotensi: dua request dengan key sama INSERT bersamaan →
            // duplicate key. Kembalikan pesanan yang sudah tersimpan.
            if ($idempotencyKey !== '' && (string) $e->getCode() === '23000') {
                $ada = Database::satu(
                    'SELECT id, subtotal, biaya_layanan, potongan, total, status
                     FROM pesanan WHERE idempotency_key = ? LIMIT 1',
                    [$idempotencyKey]
                );
                if ($ada) {
                    Bantu::sukses([
                        'id' => $ada['id'], 'subtotal' => (int) $ada['subtotal'],
                        'biayaLayanan' => (int) $ada['biaya_layanan'], 'potongan' => (int) $ada['potongan'],
                        'total' => (int) $ada['total'], 'status' => $ada['status'],
                    ], 'Pesanan sudah tercatat.', 200);
                }
            }
            throw $e;
        }

        Aktivitas::audit('buat_pesanan', 'pesanan', $nomor, 'Berhasil', [
            'pelanggan' => $namaPembeli,
            'email' => $email,
            'total' => $total,
            'status' => 'Menunggu',
        ], "Pesanan {$nomor} dibuat" . ($namaPembeli ? " oleh {$namaPembeli}" : ''));
        Bantu::sukses($hasil, 'Pesanan dibuat.', 201);
    }

    // Simpan pesanan + item + efek samping (pelanggan, promo) dalam transaksi.
    private function simpanPesanan(
        string $nomor, string $namaPembeli, string $email, string $whatsapp, string $metode,
        string $produkRingkas, string $kategori, int $subtotal, int $biayaLayanan, int $potongan,
        int $total, string $kodePromo, array $barisItem, ?array $promoDipakai,
        string $idempotencyKey = ''
    ): array {
        return Database::transaksi(function () use (
            $nomor, $namaPembeli, $email, $whatsapp, $metode, $produkRingkas, $kategori,
            $subtotal, $biayaLayanan, $potongan, $total, $kodePromo, $barisItem, $promoDipakai,
            $idempotencyKey
        ) {
            // Cari/buat pelanggan berdasarkan email.
            $pelangganId = null;
            if ($email !== '') {
                $pel = Database::satu('SELECT id FROM pelanggan WHERE email = ?', [$email]);
                if ($pel) {
                    $pelangganId = $pel['id'];
                } else {
                    $pelangganId = Bantu::idBaruAman('pel');
                    Database::eksekusi('INSERT INTO pelanggan (id, nama, email) VALUES (?,?,?)',
                        [$pelangganId, $namaPembeli, $email]);
                }
            }

            Database::eksekusi(
                'INSERT INTO pesanan (id, pelanggan_id, pelanggan_nama, email, whatsapp, produk_ringkas,
                    kategori, metode, subtotal, biaya_layanan, potongan, total, kode_promo, status, idempotency_key)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                [$nomor, $pelangganId, $namaPembeli, $email, $whatsapp, $produkRingkas,
                 $kategori, $metode, $subtotal, $biayaLayanan, $potongan, $total, $kodePromo, 'Menunggu',
                 $idempotencyKey !== '' ? $idempotencyKey : null]
            );

            foreach ($barisItem as $b) {
                Database::eksekusi(
                    'INSERT INTO pesanan_item (pesanan_id, produk_id, nama, harga, jumlah, subtotal)
                     VALUES (?,?,?,?,?,?)',
                    [$nomor, $b['produk_id'], $b['nama'], $b['harga'], $b['jumlah'], $b['subtotal']]
                );
            }

            if ($promoDipakai) {
                // ATOMIK: hanya increment bila masih di bawah batas — mencegah
                // dua checkout bersamaan melebihi kuota promo (TOCTOU race).
                $terpakaiBaru = Database::eksekusi(
                    'UPDATE promo SET terpakai = terpakai + 1 WHERE id = ? AND terpakai < batas',
                    [$promoDipakai['id']]
                );
                if ($terpakaiBaru === 0) {
                    // Kuota habis pada detik ini — batalkan seluruh transaksi.
                    throw new RuntimeException('Kuota promo sudah habis.');
                }
            }
            if ($pelangganId) {
                Database::eksekusi(
                    'UPDATE pelanggan SET jumlah_pesanan = jumlah_pesanan + 1, total_beli = total_beli + ? WHERE id = ?',
                    [$total, $pelangganId]
                );
            }

            return [
                'id' => $nomor, 'subtotal' => $subtotal, 'biayaLayanan' => $biayaLayanan,
                'potongan' => $potongan, 'total' => $total, 'status' => 'Menunggu',
            ];
        });
    }

    private function ubahStatus(?string $id): void
    {
        if (!$id) Bantu::gagal('ID pesanan wajib ada.', 400);
        $lama = Database::satu('SELECT id, status FROM pesanan WHERE id = ?', [$id]);
        if (!$lama) Bantu::gagal('Pesanan tidak ditemukan.', 404);

        $status = $this->salahDari($this->teks('status', $lama['status']), self::STATUS, $lama['status']);

        $success = Database::transaksi(function () use ($id, $lama, $status) {
            // UPDATE pesanan di dalam transaksi
            Database::eksekusi('UPDATE pesanan SET status=?, diperbarui_pada=NOW() WHERE id=?', [$status, $id]);

            // Audit di dalam transaksi — jika gagal, transaksi digulirkan
            $auditOk = Aktivitas::audit('ubah_status_pesanan', 'pesanan', $id, 'Berhasil', [
                'statusLama' => $lama['status'],
                'statusBaru' => $status,
            ], "Status pesanan {$id} diubah ke {$status}", true);

            if (!$auditOk) {
                throw new RuntimeException('Gagal mencatat audit status pesanan');
            }
            return true;
        });

        if (!$success) {
            Bantu::gagal('Gagal memperbarui status pesanan.', 500);
        }
        Bantu::sukses(['id' => $id, 'status' => $status], 'Status pesanan diperbarui.');
    }

    private function hapus(?string $id): void
    {
        if (!$id) Bantu::gagal('ID pesanan wajib ada.', 400);
        $baris = Database::satu('SELECT id FROM pesanan WHERE id = ?', [$id]);
        if (!$baris) Bantu::gagal('Pesanan tidak ditemukan.', 404);

        // FK pembayaran.pesanan_id = ON DELETE RESTRICT. Tolak lebih awal dengan
        // pesan jelas daripada membiarkan galat integritas menjadi 500 generik.
        try {
            $adaBayar = Database::satu('SELECT id FROM pembayaran WHERE pesanan_id = ? LIMIT 1', [$id]);
        } catch (Throwable $e) {
            $adaBayar = null; // pembayaran belum ada di instalasi lama → lanjut hapus.
        }
        if ($adaBayar) {
            Bantu::gagal('Pesanan memiliki data pembayaran dan tidak dapat dihapus. Hapus pembayaran lebih dulu.', 409);
        }

        // pesanan_item ikut terhapus (ON DELETE CASCADE).
        Database::eksekusi('DELETE FROM pesanan WHERE id = ?', [$id]);
        Aktivitas::audit('hapus_pesanan', 'pesanan', $id, 'Berhasil', [], "Pesanan {$id} dihapus");
        Bantu::sukses(['id' => $id], 'Pesanan dihapus.');
    }
}

