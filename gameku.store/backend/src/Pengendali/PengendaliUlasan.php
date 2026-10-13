<?php
// =====================================================================
// PengendaliUlasan.php — tabel `ulasan`.
//   GET  /api/ulasan/produk/{produkId}   (publik) ulasan Disetujui utk produk.
//   GET  /api/ulasan                     (admin) semua ulasan (moderasi).
//   GET  /api/ulasan/{id}                (admin) satu ulasan.
//   POST /api/ulasan                     (publik) kirim ulasan (status Menunggu).
//   PUT  /api/ulasan/{id}                (admin) ubah status moderasi.
//   DELETE /api/ulasan/{id}              (admin) hapus.
// =====================================================================

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
                $this->kirim(); // publik
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
        $produkId   = $this->teks('produkId');
        $pelanggan  = Bantu::potong($this->teks('pelanggan'), 120);
        if ($produkId === '' || $pelanggan === '') {
            Bantu::gagal('Ulasan perlu produk dan nama pelanggan.');
        }

        // Ambil nama produk (aman bila produk ada).
        $produk = Database::satu('SELECT nama FROM produk WHERE id = ?', [$produkId]);
        $produkNama = $produk['nama'] ?? Bantu::potong($this->teks('produk'), 160);

        $rating = min(5, max(1, $this->angka('rating', 5)));
        $komentar = $this->teksMentah('komentar', '', 5000);
        $id = Bantu::idBaru('uls');

        Database::eksekusi(
            'INSERT INTO ulasan (id, produk_id, produk_nama, pelanggan_nama, rating, komentar, status)
             VALUES (?,?,?,?,?,?,?)',
            [$id, $produkId, $produkNama, $pelanggan, $rating, $komentar, 'Menunggu']
        );
        Bantu::sukses(['id' => $id, 'status' => 'Menunggu'], 'Ulasan terkirim, menunggu moderasi.', 201);
    }

    private function ubahStatus(?string $id): void
    {
        if (!$id) Bantu::gagal('ID ulasan wajib ada.', 400);
        $lama = Database::satu('SELECT id FROM ulasan WHERE id = ?', [$id]);
        if (!$lama) Bantu::gagal('Ulasan tidak ditemukan.', 404);

        $status = $this->salahDari($this->teks('status', 'Menunggu'), self::STATUS, 'Menunggu');
        Database::eksekusi('UPDATE ulasan SET status=? WHERE id=?', [$status, $id]);
        Bantu::sukses(['id' => $id, 'status' => $status], 'Status ulasan diperbarui.');
    }

    private function hapus(?string $id): void
    {
        if (!$id) Bantu::gagal('ID ulasan wajib ada.', 400);
        $baris = Database::satu('SELECT id FROM ulasan WHERE id = ?', [$id]);
        if (!$baris) Bantu::gagal('Ulasan tidak ditemukan.', 404);
        Database::eksekusi('DELETE FROM ulasan WHERE id = ?', [$id]);
        Bantu::sukses(['id' => $id], 'Ulasan dihapus.');
    }
}
