<?php
// =====================================================================
// Bantu.php — fungsi bantu bersama untuk seluruh endpoint.
// Semua respons API memakai bentuk JSON: { ok, data?, pesan }.
// =====================================================================

class Bantu
{
    // Mengirim respons JSON lalu menghentikan eksekusi.
    public static function json($data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: no-referrer');
        header('Cache-Control: no-store, no-cache, must-revalidate');
        header('Pragma: no-cache');
        // Mencegah XSS melalui rendering respons jika Content-Type lali diubah nanti.
        header('X-XSS-Protection: 0');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // Respons sukses: { ok:true, data, pesan }.
    public static function sukses($data = null, string $pesan = '', int $status = 200): void
    {
        self::json(['ok' => true, 'data' => $data, 'pesan' => $pesan], $status);
    }

    // Respons gagal: { ok:false, pesan }.
    public static function gagal(string $pesan, int $status = 400): void
    {
        self::json(['ok' => false, 'pesan' => $pesan], $status);
    }

    // Metode HTTP saat ini (mendukung override lewat header/body untuk PUT/DELETE).
    public static function metode(): string
    {
        $metode = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        if ($metode === 'POST') {
            $override = $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] ?? ($_POST['_method'] ?? '');
            $override = strtoupper(trim((string) $override));
            if (in_array($override, ['PUT', 'PATCH', 'DELETE'], true)) {
                return $override;
            }
        }
        return $metode;
    }

    // Membaca body permintaan sebagai array asosiatif (JSON atau form).
    public static function badan(): array
    {
        $mentah = file_get_contents('php://input') ?: '';
        if ($mentah !== '') {
            $decoded = json_decode($mentah, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }
        // Fallback ke form-urlencoded / multipart.
        if (!empty($_POST)) {
            return $_POST;
        }
        return [];
    }

    // Mengambil nilai string dari input (GET/POST/JSON) dengan pemangkasan spasi.
    public static function teks(string $kunci, string $bawaan = ''): string
    {
        $nilai = $_GET[$kunci] ?? $_POST[$kunci] ?? null;
        if ($nilai === null) {
            $badan = self::badan();
            $nilai = $badan[$kunci] ?? null;
        }
        return trim((string) ($nilai ?? $bawaan));
    }

    // Mengambil nilai bilangan bulat >= 0 dari input.
    public static function angka(string $kunci, int $bawaan = 0): int
    {
        $nilai = $_GET[$kunci] ?? $_POST[$kunci] ?? null;
        if ($nilai === null) {
            $badan = self::badan();
            $nilai = $badan[$kunci] ?? null;
        }
        if ($nilai === null || $nilai === '') {
            return $bawaan;
        }
        return (int) round((float) str_replace(',', '.', (string) $nilai));
    }

    // Membuat slug URL (a-z, 0-9, tanda hubung) — setara jadikanSlug() di frontend.
    public static function slug(string $teks): string
    {
        $slug = strtolower(trim($teks));
        // Normalisasi aksen sederhana.
        if (function_exists('iconv')) {
            $ubah = @iconv('UTF-8', 'ASCII//TRANSLIT', $slug);
            if ($ubah !== false) {
                $slug = $ubah;
            }
        }
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
        return trim($slug, '-');
    }

    // Format rupiah tanpa desimal: 22000 -> "Rp22.000".
    public static function rupiah($angka): string
    {
        return 'Rp' . number_format((float) $angka, 0, ',', '.');
    }

    // Waktu sekarang dalam format ISO 8601 (dipakai frontend via new Date()).
    public static function sekarang(): string
    {
        return date('c');
    }

    // Tanggal hari ini (Y-m-d) — untuk perhitungan status promo di SQL/PHP.
    public static function hariIni(): string
    {
        return date('Y-m-d');
    }

    // Membatasi panjang teks agar aman disimpan.
    public static function potong(string $teks, int $maks): string
    {
        return mb_substr($teks, 0, $maks);
    }

    // ID acak dengan awalan — meniru idBaru() di layananKoleksi frontend.
    // Contoh: kat-lf3k2-9x1ab
    public static function idBaru(string $awalan = 'id'): string
    {
        $waktu = substr(base_convert((string) time(), 10, 36), 0, 8);
        $acak  = substr(str_shuffle('abcdefghijklmnopqrstuvwxyz0123456789'), 0, 5);
        return $awalan . '-' . $waktu . '-' . $acak;
    }

    // Nomor pesanan format GK-YYMM-XXXX — setara buatNomorPesanan() frontend.
    public static function nomorPesanan(): string
    {
        $thn = date('y');
        $bln = date('m');
        $acak = str_pad((string) random_int(1000, 9999), 4, '0', STR_PAD_LEFT);
        return "GK-{$thn}{$bln}-{$acak}";
    }

    // Mengubah array preview menjadi JSON untuk kolom `preview` (JSON).
    public static function keJson($nilai): ?string
    {
        if ($nilai === null || $nilai === '' || $nilai === []) {
            return null;
        }
        if (is_string($nilai)) {
            $decoded = json_decode($nilai, true);
            return is_array($decoded) ? json_encode($decoded) : $nilai;
        }
        return json_encode(array_values((array) $nilai), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}

