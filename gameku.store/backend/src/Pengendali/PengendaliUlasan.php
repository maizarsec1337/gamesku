<?php
// Ulasan: kirim (publik, status Menunggu), moderasi & hapus (admin).

class PengendaliUlasan extends PengendaliDasar
{
    private const STATUS = ['Menunggu', 'Disetujui', 'Disembunyikan'];

    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        // /api/ulasan/produk/{produkId}
        if ($id === 'produk' && $sub !== null) {
            if ($metode !== 'GET') $this->metodeTakDiizinkan();
            $this->perProduk($sub);
            return;
        }

        switch ($metode) {
            case 'GET':
                if ($id === null) {
                    Auth::wajib();
                    $this->daftar();
                } else {
                    Auth::wajib();
                    $this->satu($id);
                }
                break;
            case 'POST':
                $this->validateCsrf();
                $this->kirim();
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
        $r['rating'] = (int) $r['rating'];
        return $r;
    }

    private const PILIH = 'SELECT u.id, u.produk_id AS produkId, u.produk_nama AS produk,
        u.pelanggan_id AS pelangganId, u.pelanggan_nama AS pelanggan, u.rating, u.komentar,
        u.tanggal, u.status FROM ulasan u';

    private function perProduk(string $produkId): void
    {
        $rows = Database::banyak(
            self::PILIH . " WHERE u.produk_id = ? AND u.status = 'Disetujui' ORDER BY u.tanggal DESC",
            [$produkId]
        );
        $rata = null;
        if ($rows) {
            $rata = round(array_sum(array_column($rows, 'rating')) / count($rows), 1);
        }
        Bantu::sukses([
            'ulasan'     => array_map(fn($r) => $this->petakan($r), $rows),
            'rataRating' => $rata,
            'jumlah'     => count($rows),
        ]);
    }

    private function daftar(): void
    {
        $rows = Database::banyak(self::PILIH . ' ORDER BY u.tanggal DESC, u.id DESC LIMIT 300');
        Bantu::sukses(array_map(fn($r) => $this->petakan($r), $rows));
    }

    private function satu(string $id): void
    {
        $baris = Database::satu(self::PILIH . ' WHERE u.id = ?', [$id]);
        if (!$baris) Bantu::gagal('Ulasan tidak ditemukan.', 404);
        Bantu::sukses($this->petakan($baris));
    }

    private function kirim(): void
    {
        // Rate limit ulasan publik per IP (cegah spam/flooding).
        $ip = RateLimiter::ip();
        $hasilUlasan = RateLimiter::check('ulasan', $ip, 10, 60);
        if ($hasilUlasan['limited']) {
            header('Retry-After: ' . (int) ($hasilUlasan['retry_after'] ?? 60));
            SecurityLog::catat('rate_limit', 'warn', 'Kirim ulasan dibatasi.', [
                'retryAfter' => $hasilUlasan['retry_after'],
            ]);
            Bantu::gagal('Terlalu banyak ulasan. Tunggu sebentar lalu coba lagi.', 429);
        }

        $produkId   = $this->teks('produkId');
        $pelanggan  = Bantu::potong($this->teks('pelanggan'), 120);
        if ($produkId === '' || $pelanggan === '') {
            Bantu::gagal('Ulasan perlu produk dan nama pelanggan.');
        }

        // Ulasan publik hanya boleh merujuk produk aktif yang benar-benar ada.
        $produk = Database::satu('SELECT nama FROM produk WHERE id = ? AND status = ?', [$produkId, 'Aktif']);
        if (!$produk) Bantu::gagal('Produk tidak ditemukan atau tidak tersedia.', 422);
        $produkNama = $produk['nama'];

        $rating = min(5, max(1, $this->angka('rating', 5)));
        $komentar = $this->teksMentah('komentar', '', 5000);
        $id = Bantu::idBaru('uls');

        // Semua kiriman publik menunggu moderasi, sesuai kontrak respons API.
        $status = 'Menunggu';

        Database::eksekusi(
            'INSERT INTO ulasan (id, produk_id, produk_nama, pelanggan_nama, rating, komentar, status)
             VALUES (?,?,?,?,?,?,?)',
            [$id, $produkId, $produkNama, $pelanggan, $rating, $komentar, $status]
        );
        Aktivitas::audit('kirim_ulasan', 'ulasan', $id, 'Berhasil', [
            'produkId' => $produkId,
            'produkNama' => $produkNama,
            'pelanggan' => $pelanggan,
            'rating' => $rating,
        ], "Ulasan produk \"{$produkNama}\" dikirim oleh {$pelanggan} (rating {$rating}, status {$status})");
        Bantu::sukses(['id' => $id, 'status' => 'Menunggu'], 'Ulasan terkirim, menunggu moderasi.', 201);
    }

    private function ubahStatus(?string $id): void
    {
        if (!$id) Bantu::gagal('ID ulasan wajib ada.', 400);
        $lama = Database::satu('SELECT id FROM ulasan WHERE id = ?', [$id]);
        if (!$lama) Bantu::gagal('Ulasan tidak ditemukan.', 404);

        $status = $this->salahDari($this->teks('status', 'Menunggu'), self::STATUS, 'Menunggu');
        Database::eksekusi('UPDATE ulasan SET status=? WHERE id=?', [$status, $id]);
        Aktivitas::audit('moderasi_ulasan', 'ulasan', $id, 'Berhasil', [
            'statusBaru' => $status,
        ], "Status ulasan {$id} diubah ke {$status}");
        Bantu::sukses(['id' => $id, 'status' => $status], 'Status ulasan diperbarui.');
    }

    private function hapus(?string $id): void
    {
        if (!$id) Bantu::gagal('ID ulasan wajib ada.', 400);
        $baris = Database::satu('SELECT id FROM ulasan WHERE id = ?', [$id]);
        if (!$baris) Bantu::gagal('Ulasan tidak ditemukan.', 404);
        Aktivitas::audit('hapus_ulasan', 'ulasan', $id, 'Berhasil', [], "Ulasan {$id} dihapus");
        Database::eksekusi('DELETE FROM ulasan WHERE id = ?', [$id]);
        Bantu::sukses(['id' => $id], 'Ulasan dihapus.');
    }
}
