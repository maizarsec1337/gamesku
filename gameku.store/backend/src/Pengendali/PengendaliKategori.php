<?php
// CRUD kategori; tamu hanya melihat status Aktif.

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
        // Admin melihat semua status; tamu hanya Aktif.
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
            Aktivitas::audit('ubah_kategori', 'kategori', $id, 'Berhasil', [
                'nama' => $data['nama'],
                'slug' => $data['slug'],
                'status' => $data['status'],
            ], "Kategori \"{$data['nama']}\" diperbarui");
            Bantu::sukses($this->ambilTerpetakan($id), 'Kategori diperbarui.');
        }

        $bentrok = Database::satu('SELECT id FROM kategori WHERE slug = ?', [$data['slug']]);
        if ($bentrok) Bantu::gagal("Slug \"{$data['slug']}\" sudah dipakai kategori lain.");

        $idBaru = Bantu::idBaru('kat');
        Database::eksekusi(
            'INSERT INTO kategori (id, nama, slug, deskripsi, ikon, gambar, status) VALUES (?,?,?,?,?,?,?)',
            [$idBaru, $data['nama'], $data['slug'], $data['deskripsi'], $data['ikon'], $data['gambar'], $data['status']]
        );
        Aktivitas::audit('buat_kategori', 'kategori', $idBaru, 'Berhasil', [
            'nama' => $data['nama'],
            'slug' => $data['slug'],
            'status' => $data['status'],
        ], "Kategori \"{$data['nama']}\" ditambahkan");
        Bantu::sukses($this->ambilTerpetakan($idBaru), 'Kategori ditambahkan.', 201);
    }

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

        // FK produk.kategori_id: ON DELETE SET NULL.
        Database::eksekusi('DELETE FROM kategori WHERE id = ?', [$id]);
        Aktivitas::audit('hapus_kategori', 'kategori', $id, 'Berhasil', [
            'nama' => $baris['nama'],
        ], "Kategori \"{$baris['nama']}\" dihapus");
        Bantu::sukses(['id' => $id], 'Kategori dihapus.');
    }
}
