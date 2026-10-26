<?php
// Media + unggahan berkas ke folder uploads/ (admin).

class PengendaliMedia extends PengendaliDasar
{
    private const JENIS = ['Thumbnail', 'Banner', 'Preview', 'Gambar Produk', 'Video'];
    private const MIME_IZIN = [
        'image/png' => 'png', 'image/jpeg' => 'jpg', 'image/jpg' => 'jpg',
        'image/webp' => 'webp', 'image/gif' => 'gif', 'image/svg+xml' => 'svg',
        'application/zip' => 'zip', 'application/pdf' => 'pdf',
        'video/mp4' => 'mp4', 'video/webm' => 'webm', 'video/ogg' => 'ogv',
    ];
    private const MAKS_BAYAR = 512 * 1024 * 1024; // 512 MB, termasuk video pendek

    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        switch ($metode) {
            case 'GET':
                // Streaming memakai HTTP Range dan dapat diputar oleh browser
                // tanpa mengirim seluruh file sebagai JSON.
                if ($sub === 'stream' && $id !== null) {
                    $this->stream($id);
                    return;
                }
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
            Bantu::gagal('Ukuran berkas melebihi batas 512 MB.');
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
            case 'video/mp4':
                return strlen($kepala) >= 12 && substr($kepala, 4, 4) === 'ftyp';
            case 'video/webm':
                return strncmp($kepala, "\x1A\x45\xDF\xA3", 4) === 0;
            case 'video/ogg':
                return strncmp($kepala, 'OggS', 4) === 0;
            case 'image/svg+xml':
                $rendah = strtolower($kepala);
                return strpos($rendah, '<svg') !== false
                    || strpos($rendah, '<?xml') !== false;
            default:
                return false;
        }
    }

    /** Sajikan media video milik aplikasi dengan dukungan Range/206. */
    private function stream(string $id): void
    {
        $row = Database::satu(
            'SELECT mime, ukuran, berkas, status FROM media WHERE id = ? LIMIT 1',
            [$id]
        );
        if (!$row || ($row['status'] ?? 'Aktif') !== 'Aktif') {
            http_response_code(404);
            exit;
        }
        $mime = (string) ($row['mime'] ?? '');
        if (!str_starts_with($mime, 'video/')) {
            http_response_code(415);
            exit;
        }
        $folder = $this->folderUnggah();
        $root = realpath($folder);
        $file = realpath($folder . DIRECTORY_SEPARATOR . basename((string) $row['berkas']));
        if (!$root || !$file || !is_file($file) || strpos($file, $root . DIRECTORY_SEPARATOR) !== 0) {
            http_response_code(404);
            exit;
        }
        $size = (int) filesize($file);
        $start = 0;
        $end = $size - 1;
        $range = $_SERVER['HTTP_RANGE'] ?? '';
        if (preg_match('/bytes=(\d*)-(\d*)/', $range, $m)) {
            if ($m[1] === '' && $m[2] !== '') {
                $length = min((int) $m[2], $size);
                $start = max(0, $size - $length);
            } else {
                $start = (int) $m[1];
                $end = $m[2] !== '' ? (int) $m[2] : $end;
            }
            if ($start > $end || $start >= $size) {
                header('Content-Range: bytes */' . $size);
                http_response_code(416);
                exit;
            }
            $end = min($end, $size - 1);
            http_response_code(206);
        }
        $length = $end - $start + 1;
        header_remove('Content-Type');
        header('Content-Type: ' . $mime);
        header('Accept-Ranges: bytes');
        header('Content-Length: ' . $length);
        header('Content-Disposition: inline; filename="' . basename((string) $row['berkas']) . '"');
        if ($start !== 0 || $end !== $size - 1) {
            header("Content-Range: bytes {$start}-{$end}/{$size}");
        }
        $fp = fopen($file, 'rb');
        if ($fp === false) { http_response_code(500); exit; }
        fseek($fp, $start);
        $left = $length;
        while ($left > 0 && !feof($fp)) {
            $chunk = fread($fp, min(1024 * 1024, $left));
            if ($chunk === false || $chunk === '') break;
            echo $chunk;
            $left -= strlen($chunk);
            if (function_exists('ob_flush')) @ob_flush();
            flush();
        }
        fclose($fp);
        exit;
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
