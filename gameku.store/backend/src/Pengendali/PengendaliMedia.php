<?php
// Media + unggahan berkas ke folder uploads/ (admin).

class PengendaliMedia extends PengendaliDasar
{
    private const JENIS = ['Thumbnail', 'Banner', 'Preview', 'Gambar Produk'];
    private const MIME_IZIN = [
        'image/png' => 'png', 'image/jpeg' => 'jpg', 'image/jpg' => 'jpg',
        'image/webp' => 'webp', 'image/gif' => 'gif', 'image/svg+xml' => 'svg',
        'application/zip' => 'zip', 'application/pdf' => 'pdf',
    ];
    private const MAKS_BAYAR = 8 * 1024 * 1024; // 8 MB

    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        switch ($metode) {
            case 'GET':
                Auth::wajib();
                $this->daftar();
                break;
            case 'POST':
                Auth::wajib();
                $this->validateCsrf();
                $this->unggah();
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

    private function folderUnggah(): string
    {
        $cfg = require __DIR__ . '/../../config/config.php';
        $folder = $cfg['folder_unggah'] ?? (dirname(__DIR__, 2) . '/uploads');
        if (!is_dir($folder)) {
            @mkdir($folder, 0775, true);
        }
        return $folder;
    }

    private function daftar(): void
    {
        $jenis = Bantu::teks('jenis');
        if ($jenis !== '' && in_array($jenis, self::JENIS, true)) {
            $rows = Database::banyak(
                'SELECT id, nama, jenis, mime, ukuran, berkas, url, tanggal FROM media
                 WHERE jenis = ? ORDER BY tanggal DESC, id DESC',
                [$jenis]
            );
        } else {
            $rows = Database::banyak(
                'SELECT id, nama, jenis, mime, ukuran, berkas, url, tanggal FROM media
                 ORDER BY tanggal DESC, id DESC'
            );
        }
        Bantu::sukses($rows);
    }

    private function unggah(): void
    {
        if (!isset($_FILES['berkas']) || ($_FILES['berkas']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            Bantu::gagal('Berkas unggahan tidak valid.');
        }

        $berkas = $_FILES['berkas'];
        if ($berkas['size'] > self::MAKS_BAYAR) {
            Bantu::gagal('Ukuran berkas melebihi batas 8 MB.');
        }

        $mime = mime_content_type($berkas['tmp_name']) ?: ($berkas['type'] ?? '');
        if (!isset(self::MIME_IZIN[$mime])) {
            Bantu::gagal('Jenis berkas tidak diizinkan.');
        }

        $ekstensi = self::MIME_IZIN[$mime];
        $namaAsli = Bantu::potong(basename($berkas['name']), 200);
        $namaSimpan = Bantu::idBaru('med') . '.' . $ekstensi;
        $tujuan = rtrim($this->folderUnggah(), '/\\') . DIRECTORY_SEPARATOR . $namaSimpan;

        if (!move_uploaded_file($berkas['tmp_name'], $tujuan)) {
            Bantu::gagal('Gagal menyimpan berkas unggahan.', 500);
        }

        $jenis = $this->salahDari(Bantu::teks('jenis', 'Thumbnail'), self::JENIS, 'Thumbnail');
        $id = Bantu::idBaru('med');
        // URL relatif yang dilayani server (lihat api/index.php).
        $url = '/uploads/' . $namaSimpan;

        Database::eksekusi(
            'INSERT INTO media (id, nama, jenis, mime, ukuran, berkas, url) VALUES (?,?,?,?,?,?,?)',
            [$id, $namaAsli, $jenis, $mime, (int) $berkas['size'], $namaSimpan, $url]
        );

        Aktivitas::catat("Media \"{$namaAsli}\" diunggah", 'unggah', 'biru');
        Bantu::sukses([
            'id' => $id, 'nama' => $namaAsli, 'jenis' => $jenis, 'mime' => $mime,
            'ukuran' => (int) $berkas['size'], 'berkas' => $namaSimpan, 'url' => $url,
        ], 'Berkas diunggah.', 201);
    }

    private function hapus(?string $id): void
    {
        if (!$id) Bantu::gagal('ID media wajib ada.', 400);
        $baris = Database::satu('SELECT id, nama, berkas FROM media WHERE id = ?', [$id]);
        if (!$baris) Bantu::gagal('Media tidak ditemukan.', 404);

        // Hapus berkas fisik bila ada.
        if (!empty($baris['berkas'])) {
            $jalur = rtrim($this->folderUnggah(), '/\\') . DIRECTORY_SEPARATOR . basename($baris['berkas']);
            if (is_file($jalur)) {
                @unlink($jalur);
            }
        }

        Database::eksekusi('DELETE FROM media WHERE id = ?', [$id]);
        Aktivitas::catat("Media \"{$baris['nama']}\" dihapus", 'hapus', 'merah');
        Bantu::sukses(['id' => $id], 'Media dihapus.');
    }
}
