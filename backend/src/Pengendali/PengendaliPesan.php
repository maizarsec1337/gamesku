<?php
// Pesan & percakapan (toko depan + admin CS).
//
// Identitas polimorfik: (user_tipe, user_id) — 'admin' (INT jadi string) atau
// 'pembeli' (pelanggan.id). TANPA FK di tabel anggota/pesan (sesuai skema),
// sehingga OTORISASI KEANGGOTAAN WAJIB dicek di lapisan aplikasi
// (lihat pastikanAnggota()) sebelum baca/tulis pesan.

class PengendaliPesan extends PengendaliDasar
{
    private const STATUS = ['open', 'in_progress', 'closed'];
    private const MAKS_PESAN = 4000;

    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        // Sub-sumber: /api/pesan/percakapan[/{id}] dan /api/pesan/baca
        if ($id === 'percakapan') {
            $this->percakapan($metode, $sub);
            return;
        }
        if ($id === 'baca') {
            if ($metode !== 'POST') $this->metodeTakDiizinkan();
            // State-changing: wajib token CSRF (sejalan dengan pola Pesan lainnya).
            $this->validateCsrf();
            $this->baca();
            return;
        }
        // DELETE /api/pesan/{id} — hapus (soft) pesan milik sendiri.
        if ($metode === 'DELETE' && $id !== null) {
            // State-changing: wajib token CSRF.
            $this->validateCsrf();
            $this->hapusPesan($id);
            return;
        }
        $this->metodeTakDiizinkan();
    }

    // ================= Percakapan =================

    private function percakapan(string $metode, ?string $id): void
    {
        switch ($metode) {
            case 'GET':
                $id === null ? $this->daftarPercakapan() : $this->detailPercakapan($id);
                break;
            case 'POST':
                if ($id === null) {
                    $this->validateCsrf();
                    $this->buatPercakapan();
                } else {
                    $this->validateCsrf();
                    $this->kirimPesan($id);
                }
                break;
            case 'PUT':
            case 'PATCH':
                $this->validateCsrf();
                $this->ubahStatusPercakapan($id);
                break;
            default:
                $this->metodeTakDiizinkan();
        }
    }

    private function daftarPercakapan(): void
    {
        $aku = Auth::wajibIdentitas();

        if ($aku['tipe'] === 'admin') {
            $where = [];
            $param = [];
            $status = $this->teks('status');
            if ($status !== '' && in_array($status, self::STATUS, true)) {
                $where[] = 'c.status = ?';
                $param[] = $status;
            }
            $sql = self::PILIH_PERCAKAPAN . ($where ? ' WHERE ' . implode(' AND ', $where) : '');
            $sql .= ' ORDER BY c.diperbarui_pada DESC, c.dibuat_pada DESC LIMIT 200';
            Bantu::sukses(Database::banyak($sql, $param));
            return;
        }

        $sql = self::PILIH_PERCAKAPAN . '
            JOIN anggota_percakapan a ON a.percakapan_id = c.id
            WHERE a.user_tipe = ? AND a.user_id = ? AND a.keluar_pada IS NULL
            ORDER BY c.diperbarui_pada DESC, c.dibuat_pada DESC LIMIT 200';
        Bantu::sukses(Database::banyak($sql, [$aku['tipe'], $aku['id']]));
    }

    private const PILIH_PERCAKAPAN = 'SELECT c.id, c.tipe, c.judul, c.status,
        c.pelanggan_id AS pelangganId, c.creator_id AS creatorId, c.produk_id AS produkId,
        c.pesanan_id AS pesananId, c.cs_petugas_id AS csPetugasId,
        c.dibuat_pada AS dibuatPada, c.diperbarui_pada AS diperbaruiPada,
        (SELECT p.teks FROM pesan p WHERE p.percakapan_id = c.id AND p.dihapus_pada IS NULL
            ORDER BY p.dibuat_pada DESC, p.id DESC LIMIT 1) AS pesanTerakhir
        FROM percakapan c';

    private function detailPercakapan(string $id): void
    {
        $aku = Auth::wajibIdentitas();
        $this->pastikanAnggota($id, $aku);

        $baris = Database::satu(self::PILIH_PERCAKAPAN . ' WHERE c.id = ?', [$id]);
        if (!$baris) Bantu::gagal('Percakapan tidak ditemukan.', 404);

        $batas = min(200, max(1, Bantu::angka('batas', 50)));
        $pesan = Database::banyak(
            'SELECT id, pengirim_tipe AS pengirimTipe, pengirim_id AS pengirimId, teks, tipe,
                dibuat_pada AS dibuatPada, diubah_pada AS diubahPada
             FROM pesan WHERE percakapan_id = ? AND dihapus_pada IS NULL
             ORDER BY dibuat_pada DESC, id DESC LIMIT ' . $batas,
            [$id]
        );
        $pesan = array_reverse($pesan);

        $anggota = Database::banyak(
            'SELECT user_tipe AS userTipe, user_id AS userId, peran, terakhir_baca_pada AS terakhirBacaPada
             FROM anggota_percakapan WHERE percakapan_id = ? AND keluar_pada IS NULL',
            [$id]
        );

        $hasil = $baris;
        $hasil['pesan'] = $pesan;
        $hasil['anggota'] = $anggota;
        Bantu::sukses($hasil);
    }

    private function buatPercakapan(): void
    {
        $aku = Auth::wajibIdentitas();

        $tipe   = $this->salahDari($this->teks('tipe', 'penjualan'), ['penjualan', 'cs'], 'penjualan');
        $judul  = Bantu::potong($this->teks('judul'), 200);
        $produkId  = trim($this->teks('produkId')) ?: null;
        $pesananId = trim($this->teks('pesananId')) ?: null;
        $csPetugas = $aku['tipe'] === 'admin'
            ? (trim($this->teks('csPetugasId')) ?: (int) $aku['id'])
            : (trim($this->teks('csPetugasId')) ?: null);
        $creatorId = trim($this->teks('creatorId')) ?: null;

        // Pelanggan: pembeli memakai dirinya; admin boleh menentukan pelangganId.
        $pelangganId = $aku['tipe'] === 'pembeli'
            ? $aku['id']
            : (trim($this->teks('pelangganId')) ?: null);

        // Dedup: satu percakapan per pesanan, atau per (pembeli, produk).
        if ($pesananId !== null) {
            $ada = Database::satu('SELECT id FROM percakapan WHERE pesanan_id = ? LIMIT 1', [$pesananId]);
            if ($ada) {
                // Cek keanggotaan SEBELUM kembalikan ringkasan: pembeli tidak boleh
                // melihat ringkasan percakapan milik orang lain (IDOR).
                $this->pastikanAnggota($ada['id'], $aku);
                $this->detailRingkasDari($ada['id']);
                return;
            }
        }
        $kunciDedup = null;
        if ($produkId !== null && $pelangganId !== null) {
            $kunciDedup = Bantu::potong($tipe . ':' . $pelangganId . ':' . $produkId, 100);
            $ada = Database::satu('SELECT id FROM percakapan WHERE kunci_dedup = ? LIMIT 1', [$kunciDedup]);
            if ($ada) {
                $this->pastikanAnggota($ada['id'], $aku);
                $this->detailRingkasDari($ada['id']);
                return;
            }
        }

        $id = Bantu::idBaruAman('cak');
        try {
            Database::transaksi(function () use ($id, $tipe, $judul, $pelangganId, $creatorId, $produkId, $pesananId, $csPetugas, $kunciDedup, $aku) {
                Database::eksekusi(
                    'INSERT INTO percakapan (id, tipe, judul, status, pelanggan_id, creator_id, produk_id, pesanan_id, cs_petugas_id, kunci_dedup)
                     VALUES (?,?,?,?,?,?,?,?,?,?)',
                    [$id, $tipe, $judul, 'open', $pelangganId, $creatorId, $produkId, $pesananId, $csPetugas !== null ? (int) $csPetugas : null, $kunciDedup]
                );
                // Anggota: pembuat sebagai pemilik.
                $this->tambahAnggota($id, $aku['tipe'], $aku['id'], 'pemilik');
                // Petugas CS (admin) bila berbeda dari pembuat.
                if ($csPetugas !== null && !($aku['tipe'] === 'admin' && (string) $csPetugas === $aku['id'])) {
                    $this->tambahAnggota($id, 'admin', (string) $csPetugas, 'petugas');
                }
            });
        } catch (PDOException $e) {
            if ((string) $e->getCode() === '23000') {
                Bantu::gagal('Percakapan untuk pesanan ini sudah ada.', 409);
            }
            throw $e;
        }

        Aktivitas::audit('buat_percakapan', 'percakapan', $id, 'Berhasil', [
            'tipe' => $tipe, 'pelangganId' => $pelangganId, 'produkId' => $produkId,
        ], "Percakapan {$id} dibuat");
        $this->detailRingkasDari($id, 201);
    }

    private function ubahStatusPercakapan(?string $id): void
    {
        if (!$id) Bantu::gagal('ID percakapan wajib ada.', 400);
        $aku = Auth::wajibIdentitas();
        // Hanya admin (petugas) yang boleh mengubah status percakapan.
        if ($aku['tipe'] !== 'admin') Bantu::gagal('Hanya petugas yang dapat mengubah status percakapan.', 403);

        $lama = Database::satu('SELECT id, status FROM percakapan WHERE id = ?', [$id]);
        if (!$lama) Bantu::gagal('Percakapan tidak ditemukan.', 404);

        $status = $this->salahDari($this->teks('status', $lama['status']), self::STATUS, $lama['status']);
        Database::eksekusi('UPDATE percakapan SET status = ?, diperbarui_pada = NOW() WHERE id = ?', [$status, $id]);
        Aktivitas::audit('ubah_status_percakapan', 'percakapan', $id, 'Berhasil', [
            'statusLama' => $lama['status'], 'statusBaru' => $status,
        ], "Status percakapan {$id} diubah ke {$status}");
        Bantu::sukses(['id' => $id, 'status' => $status], 'Status percakapan diperbarui.');
    }

    private function detailRingkasDari(string $id, int $status = 200): void
    {
        $baris = Database::satu(self::PILIH_PERCAKAPAN . ' WHERE c.id = ?', [$id]);
        Bantu::sukses($baris, '', $status);
    }

    // ================= Pesan =================

    private function kirimPesan(string $percakapanId): void
    {
        $aku = Auth::wajibIdentitas();
        $this->pastikanAnggota($percakapanId, $aku);

        $konv = Database::satu('SELECT id, status FROM percakapan WHERE id = ?', [$percakapanId]);
        if (!$konv) Bantu::gagal('Percakapan tidak ditemukan.', 404);
        if ($konv['status'] === 'closed') {
            Bantu::gagal('Percakapan sudah ditutup.', 409);
        }

        $teks = Bantu::potong(trim((string) ($this->badan()['teks'] ?? '')), self::MAKS_PESAN);
        if ($teks === '') Bantu::gagal('Pesan masih kosong.', 422);

        $id = Bantu::idBaru('msg');
        Database::transaksi(function () use ($id, $percakapanId, $aku, $teks) {
            Database::eksekusi(
                'INSERT INTO pesan (id, percakapan_id, pengirim_tipe, pengirim_id, teks, tipe)
                 VALUES (?,?,?,?,?,?)',
                [$id, $percakapanId, $aku['tipe'], $aku['id'], $teks, 'teks']
            );
            Database::eksekusi(
                'UPDATE percakapan SET pesan_terakhir_id = ?, diperbarui_pada = NOW() WHERE id = ?',
                [$id, $percakapanId]
            );
            // Pengirim dianggap sudah membaca pesannya sendiri.
            Database::eksekusi(
                'INSERT IGNORE INTO pesan_baca (pesan_id, user_tipe, user_id) VALUES (?,?,?)',
                [$id, $aku['tipe'], $aku['id']]
            );
        });

        Bantu::sukses([
            'id' => $id, 'percakapanId' => $percakapanId,
            'pengirimTipe' => $aku['tipe'], 'pengirimId' => $aku['id'],
            'teks' => $teks, 'dibuatPada' => Bantu::sekarang(),
        ], 'Pesan terkirim.', 201);
    }

    private function baca(): void
    {
        $aku = Auth::wajibIdentitas();
        $percakapanId = $this->teks('percakapanId');
        if ($percakapanId === '') Bantu::gagal('percakapanId wajib diisi.');
        $this->pastikanAnggota($percakapanId, $aku);

        Database::eksekusi(
            'INSERT IGNORE INTO pesan_baca (pesan_id, user_tipe, user_id, dibaca_pada)
             SELECT id, ?, ?, NOW() FROM pesan WHERE percakapan_id = ? AND dihapus_pada IS NULL',
            [$aku['tipe'], $aku['id'], $percakapanId]
        );
        Database::eksekusi(
            'UPDATE anggota_percakapan SET terakhir_baca_pada = NOW()
             WHERE percakapan_id = ? AND user_tipe = ? AND user_id = ?',
            [$percakapanId, $aku['tipe'], $aku['id']]
        );
        Bantu::sukses(['percakapanId' => $percakapanId], 'Ditandai sudah dibaca.');
    }

    private function hapusPesan(string $id): void
    {
        $aku = Auth::wajibIdentitas();
        $pesan = Database::satu('SELECT id, percakapan_id, pengirim_tipe, pengirim_id FROM pesan WHERE id = ?', [$id]);
        if (!$pesan) Bantu::gagal('Pesan tidak ditemukan.', 404);

        // Hanya pengirim (atau admin) yang boleh menghapus.
        $milikSendiri = ($pesan['pengirim_tipe'] === $aku['tipe'] && (string) $pesan['pengirim_id'] === (string) $aku['id']);
        if (!$milikSendiri && $aku['tipe'] !== 'admin') {
            SecurityLog::catat('idor_ditolak', 'warn', 'Upaya hapus pesan milik orang lain.', ['pesanId' => $id]);
            Bantu::gagal('Tidak berhak menghapus pesan ini.', 403);
        }

        Database::eksekusi('UPDATE pesan SET dihapus_pada = NOW() WHERE id = ?', [$id]);
        Bantu::sukses(['id' => $id], 'Pesan dihapus.');
    }

    // ================= Otorisasi & util =================

    private function tambahAnggota(string $percakapanId, string $userTipe, string $userId, string $peran): void
    {
        Database::eksekusi(
            'INSERT IGNORE INTO anggota_percakapan (id, percakapan_id, user_tipe, user_id, peran)
             VALUES (?,?,?,?,?)',
            [Bantu::idBaru('agt'), $percakapanId, $userTipe, $userId, $peran]
        );
    }

    // Admin (petugas) selalu boleh; user lain harus anggota aktif percakapan.
    private function pastikanAnggota(string $percakapanId, array $aku): void
    {
        if ($aku['tipe'] === 'admin') {
            return;
        }
        if (!Kecil::idValid($percakapanId)) {
            Bantu::gagal('ID percakapan tidak valid.', 400);
        }
        $anggota = Database::satu(
            'SELECT id FROM anggota_percakapan
             WHERE percakapan_id = ? AND user_tipe = ? AND user_id = ? AND keluar_pada IS NULL LIMIT 1',
            [$percakapanId, $aku['tipe'], $aku['id']]
        );
        if (!$anggota) {
            SecurityLog::catat('idor_ditolak', 'warn', 'Akses percakapan tanpa keanggotaan.', [
                'percakapanId' => $percakapanId, 'userTipe' => $aku['tipe'], 'userId' => $aku['id'],
            ]);
            Bantu::gagal('Anda bukan anggota percakapan ini.', 403);
        }
    }
}
