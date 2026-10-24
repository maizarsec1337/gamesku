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
        // Perlindungan Apache: larang eksekusi skrip & daftar direktori di uploads/.
        $htaccess = $folder . DIRECTORY_SEPARATOR . '.htaccess';
        if (!is_file($htaccess)) {
            @file_put_contents($htaccess,
                "Options -Indexes\n"
                . "<IfModule mod_php.c>\n<FilesMatch \"\\.(?i:php|phtml|php3|php4|php5|php7|phar|pl|py|cgi)$\">\n    Require all denied\n</FilesMatch>\n</IfModule>\n"
                . "<IfModule mod_authz_core.c>\n    Require all granted\n</IfModule>\n"
                . "RemoveHandler .php .phtml .php3 .php4 .php5 .php7 .phar\n"
                . "RemoveType .php .phtml .php3 .php4 .php5 .php7 .phar\n"
            );
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
        // Tolak ukuran 0 / risiko uploaded partially.
        if ($berkas['size'] <= 0) {
            Bantu::gagal('Berkas kosong.');
        }

        // MIME dari isi berkas sebenarnya (bukan header Content-Type klien).
        $mime = mime_content_type($berkas['tmp_name']) ?: ($berkas['type'] ?? '');
        if (!isset(self::MIME_IZIN[$mime])) {
            SecurityLog::catat('upload_ditolak', 'warn', 'MIME unggahan tidak diizinkan.', ['mime' => $mime]);
            Bantu::gagal('Jenis berkas tidak diizinkan.');
        }

        // Validasi konten sebenarnya (magic bytes) — cegah "MIME spoofing"
        // misal berkas PHP berpura-pura jadi PNG.
        if (!$this->kontenSesuai($berkas['tmp_name'], $mime)) {
            SecurityLog::catat('upload_ditolak', 'warn', 'Isi berkas tidak sesuai MIME-nya.', ['mime' => $mime]);
            Bantu::gagal('Isi berkas tidak sesuai dengan jenisnya.');
        }

        // SVG berpotensi membawa skrip (stored XSS bila dibuka langsung).
        // Tolak bila mengandung <script>, event handler on*, atau xlink:href eksternal.
        if ($mime === 'image/svg+xml' && !$this->svgAman($berkas['tmp_name'])) {
            SecurityLog::catat('upload_ditolak', 'warn', 'SVG mengandung skrip/eksekusi — ditolak.');
            Bantu::gagal('SVG mengandung konten skrip dan tidak diizinkan.');
        }

        $ekstensi = self::MIME_IZIN[$mime];
        $namaAsli = Bantu::potong(basename($berkas['name']), 200);
        // Nama simpan selalu dibuat server (tanpa nama asli) — aman dari
        // path traversal / double extension.
        $namaSimpan = Bantu::idBaru('med') . '.' . $ekstensi;
        $tujuan = rtrim($this->folderUnggah(), '/\\') . DIRECTORY_SEPARATOR . $namaSimpan;

        if (!move_uploaded_file($berkas['tmp_name'], $tujuan)) {
            Bantu::gagal('Gagal menyimpan berkas unggahan.', 500);
        }
        // Kurangi permission berkas (read owner/group) bila didukung.
        @chmod($tujuan, 0644);

        $jenis = $this->salahDari(Bantu::teks('jenis', 'Thumbnail'), self::JENIS, 'Thumbnail');
        $id = Bantu::idBaru('med');
        // URL relatif yang dilayani server (lihat api/index.php).
        $url = '/uploads/' . $namaSimpan;

        Database::eksekusi(
            'INSERT INTO media (id, nama, jenis, mime, ukuran, berkas, url) VALUES (?,?,?,?,?,?,?)',
            [$id, $namaAsli, $jenis, $mime, (int) $berkas['size'], $namaSimpan, $url]
        );

        SecurityLog::catat('upload_sukses', 'info', 'Berkas diunggah.', [
            'jenis' => $jenis, 'mime' => $mime, 'ukuran' => (int) $berkas['size'],
        ]);
        $this->catatAuditUnggah($namaAsli, $jenis, $namaSimpan, (int) $berkas['size']);
        Bantu::sukses([
            'id' => $id, 'nama' => $namaAsli, 'jenis' => $jenis, 'mime' => $mime,
            'ukuran' => (int) $berkas['size'], 'berkas' => $namaSimpan, 'url' => $url,
        ], 'Berkas diunggah.', 201);
    }

    // Catat audit untuk unggahan (dipanggil dari unggah() setelah sukses).
    private function catatAuditUnggah(string $nama, string $jenis, string $berkas, int $ukuran): void
    {
        Aktivitas::audit('unggah_media', 'media', '', 'Berhasil', [
            'nama' => $nama,
            'jenis' => $jenis,
            'berkas' => $berkas,
            'ukuran' => $ukuran,
        ], "Media \"{$nama}\" diunggah");
    }

    // Cocokkan magic bytes isi berkas dengan MIME yang dinyatakan.
    private function kontenSesuai(string $path, string $mime): bool
    {
        $fh = @fopen($path, 'rb');
        if ($fh === false) {
            return false;
        }
        $kepala = (string) fread($fh, 512);
        fclose($fh);
        if ($kepala === '') {
            return false;
        }

        switch ($mime) {
            case 'image/png':
                return strncmp($kepala, "\x89PNG\r\n\x1a\n", 8) === 0;
            case 'image/jpeg':
            case 'image/jpg':
                return strncmp($kepala, "\xFF\xD8\xFF", 3) === 0;
            case 'image/gif':
                return strncmp($kepala, 'GIF87a', 6) === 0 || strncmp($kepala, 'GIF89a', 6) === 0;
            case 'image/webp':
                return strncmp($kepala, 'RIFF', 4) === 0 && substr($kepala, 8, 4) === 'WEBP';
            case 'application/zip':
                // PK\x03\x04 (stored), PK\x05\x06 (empty), PK\x07\x08 (spanned).
                return strncmp($kepala, "PK", 2) === 0
                    && in_array(substr($kepala, 2, 2), ["\x03\x04", "\x05\x06", "\x07\x08"], true);
            case 'application/pdf':
                return strncmp($kepala, '%PDF-', 5) === 0;
            case 'image/svg+xml':
                $rendah = strtolower($kepala);
                return strpos($rendah, '<svg') !== false
                    || strpos($rendah, '<?xml') !== false;
            default:
                return false;
        }
    }

    // SVG aman: tanpa <script>, tanpa handler peristiwa on*, tanpa eksternal
    // xlink:href/href (mencegah exfiltration & XSS).
    private function svgAman(string $path): bool
    {
        $isi = (string) @file_get_contents($path);
        if ($isi === '') {
            return false;
        }
        $rendah = strtolower($isi);
        // Pola berbahaya.
        $larangan = [
            '/<script\b/i',
            '/\son[a-z]+\s*=/i',                       // onclick=, onerror=, ...
            '/xlink:href\s*=\s*["\']?\s*(https?:)?\/\//i',
            '/\shref\s*=\s*["\']?\s*(https?:)?\/\//i', // jangan muat sumber eksternal
            '/javascript\s*:/i',
            '/<!ENTITY/i',                             // XXE entity declaration
            '/<!DOCTYPE[^>]*SYSTEM/i',
            '/data:text\/html/i',
            '/<iframe\b/i',
            '/<foreignObject\b/i',
        ];
        foreach ($larangan as $polah) {
            if (preg_match($polah, $rendah)) {
                return false;
            }
        }
        return true;
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
        Aktivitas::audit('hapus_media', 'media', $id, 'Berhasil', [
            'nama' => $baris['nama'],
            'berkas' => $baris['berkas'],
        ], "Media \"{$baris['nama']}\" dihapus");
        Bantu::sukses(['id' => $id], 'Media dihapus.');
    }
}
