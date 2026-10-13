<?php
// =====================================================================
// PengendaliKategori.php — tabel `kategori`.
//   GET  /api/kategori            publik (admin: semua, tamu: Aktif saja)
//   GET  /api/kategori/{id}       satu kategori
//   POST /api/kategori            (admin) tambah
//   PUT  /api/kategori/{id}       (admin) ubah
//   DELETE /api/kategori/{id}     (admin) hapus
//
// Bentuk baris dikembalikan dengan nama kolom ala frontend:
//   id, nama, slug, deskripsi, ikon, gambar, status
// =====================================================================

class PengendaliKategori extends PengendaliDasar
{
    private const STATUS = ['Aktif', 'Nonaktif'];

    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        switch ($metode) {
            case 'GET':
                $id === null ? $this->daftar() : $this->satu($id);
                break;
            case 'POST':
                Auth::wajib();
                $this->validateCsrf();
                $this->simpan();
                break;
            case 'PUT':
            case 'PATCH':
                Auth::wajib();
                $this->validateCsrf();
                $this->simpan($id);
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

    private function hanyaAktif(): bool
    {
        // Bila ada sesi admin, tampilkan semua status.
        return Auth::sesi() === null;
    }

    private function daftar(): void
    {
        $sql = 'SELECT id, nama, slug, deskripsi, ikon, gambar, status, dibuat_pada AS dibuatPada
                FROM kategori';
        $param = [];
        if ($this->hanyaAktif()) {
            $sql .= ' WHERE status = ?';
            $param[] = 'Aktif';
        }
        $sql .= ' ORDER BY dibuat_pada DESC, id DESC';

        Bantu::sukses(Database::banyak($sql, $param));
    }

    private function satu(string $id): void
    {
        $baris = Database::satu(
            'SELECT id, nama, slug, deskripsi, ikon, gambar, status, dibuat_pada AS dibuatPada
             FROM kategori WHERE id = ?',
            [$id]
        );
        if (!$baris) Bantu::gagal('Kategori tidak ditemukan.', 404);
        Bantu::sukses($baris);
    }

    private function simpan(?string $id = null): void
    {
        $nama = $this->teks('nama');
        if ($nama === '') Bantu::gagal('Nama kategori wajib diisi.');

        $slug = $this->teks('slug');
        if ($slug === '') $slug = Bantu::slug($nama);

        $data = [
            'nama'      => Bantu::potong($nama, 120),
            'slug'      => Bantu::potong($slug, 140),
            'deskripsi' => $this->teksMentah('deskripsi', '', 5000),
            'ikon'      => $this->teks('ikon', 'kategori'),
            'gambar'    => $this->teks('gambar'),
            'status'    => $this->salahDari($this->teks('status', 'Aktif'), self::STATUS, 'Aktif'),
        ];

        if ($id) {
            $lama = Database::satu('SELECT id, nama FROM kategori WHERE id = ?', [$id]);
            if (!$lama) Bantu::gagal('Kategori tidak ditemukan.', 404);

            $bentrok = Database::satu('SELECT id FROM kategori WHERE slug = ? AND id <> ?', [$data['slug'], $id]);
            if ($bentrok) Bantu::gagal("Slug \"{$data['slug']}\" sudah dipakai kategori lain.");

            Database::eksekusi(
                'UPDATE kategori SET nama=?, slug=?, deskripsi=?, ikon=?, gambar=?, status=?, diperbarui_pada=NOW()
                 WHERE id=?',
                [$data['nama'], $data['slug'], $data['deskripsi'], $data['ikon'], $data['gambar'], $data['status'], $id]
            );
            Aktivitas::catat("Kategori \"{$data['nama']}\" diperbarui", 'edit', 'biru');
            Bantu::sukses($this->ambilTerpetakan($id), 'Kategori diperbarui.');
        }

        $bentrok = Database::satu('SELECT id FROM kategori WHERE slug = ?', [$data['slug']]);
        if ($bentrok) Bantu::gagal("Slug \"{$data['slug']}\" sudah dipakai kategori lain.");

        $idBaru = Bantu::idBaru('kat');
        Database::eksekusi(
            'INSERT INTO kategori (id, nama, slug, deskripsi, ikon, gambar, status) VALUES (?,?,?,?,?,?,?)',
            [$idBaru, $data['nama'], $data['slug'], $data['deskripsi'], $data['ikon'], $data['gambar'], $data['status']]
        );
        Aktivitas::catat("Kategori \"{$data['nama']}\" ditambahkan", 'kategori', 'biru');
        Bantu::sukses($this->ambilTerpetakan($idBaru), 'Kategori ditambahkan.', 201);
    }

    // Ambil satu kategori (terpetakan) untuk dikembalikan setelah tulis.
    private function ambilTerpetakan(string $id): ?array
    {
        return Database::satu(
            'SELECT id, nama, slug, deskripsi, ikon, gambar, status, dibuat_pada AS dibuatPada
             FROM kategori WHERE id = ?',
            [$id]
        );
    }

    private function hapus(?string $id): void
    {
        if (!$id) Bantu::gagal('ID kategori wajib ada.', 400);
        $baris = Database::satu('SELECT id, nama FROM kategori WHERE id = ?', [$id]);
        if (!$baris) Bantu::gagal('Kategori tidak ditemukan.', 404);

        // Produk yang memakai kategori ini -> kategori_id jadi NULL (ON DELETE SET NULL).
        Database::eksekusi('DELETE FROM kategori WHERE id = ?', [$id]);
        Aktivitas::catat("Kategori \"{$baris['nama']}\" dihapus", 'hapus', 'merah');
        Bantu::sukses(['id' => $id], 'Kategori dihapus.');
    }
}
