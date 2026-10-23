<?php
// Katalog anime Streamku: pemuat & cache berkas JSON statis (tanpa database).
//
// Sumber data asli: backend/api/data_anime_lengkap.json (hasil pengumpulan).
// Saat deployment berkas dipindahkan ke lokasi ter-proteksi (di bawah src/,
// yang diblokir akses HTTP oleh .htaccess) agar tidak terekspos publik.
//
// Pemuatan dilakukan satu kali per proses PHP; cache otomatis divalidasi ulang
// bila berkas berubah (berdasarkan mtime) sehingga tidak menimbulkan data basi.

class KatalogAnime
{
    private const NAMA_BERKAS = 'data_anime_lengkap.json';

    // Cache per-proses.
    private static ?array $cache = null;
    private static ?string $cacheJalur = null;
    private static ?int $cacheMtime = null;

    // Cari berkas data: lokasi ter-proteksi (deploy) lebih dulu, lalu sumber
    // asli di samping index.php (pengembangan). Tidak mengarang data bila tak ada.
    private static function jalurBerkas(): ?string
    {
        $kandidat = [
            __DIR__ . '/data/' . self::NAMA_BERKAS,
            __DIR__ . '/../api/' . self::NAMA_BERKAS,
        ];
        foreach ($kandidat as $jalur) {
            if (is_file($jalur) && is_readable($jalur)) {
                return $jalur;
            }
        }
        return null;
    }

    // Muat seluruh katalog. Lempar RuntimeException bila berkas tidak ada,
    // tidak dapat dibaca, atau formatnya tidak valid (tidak ada fallback data contoh).
    public static function muat(): array
    {
        $jalur = self::jalurBerkas();
        if ($jalur === null) {
            throw new RuntimeException('Berkas katalog anime tidak ditemukan.');
        }

        $mtime = @filemtime($jalur) ?: 0;
        if (self::$cache !== null
            && self::$cacheJalur === $jalur
            && self::$cacheMtime === $mtime) {
            return self::$cache;
        }

        $mentah = @file_get_contents($jalur);
        if ($mentah === false || $mentah === '') {
            throw new RuntimeException('Katalog anime tidak dapat dibaca.');
        }

        $data = json_decode($mentah, true);
        if (!is_array($data) || !isset($data['anime']) || !is_array($data['anime'])) {
            throw new RuntimeException('Format katalog anime tidak valid.');
        }

        self::$cache = $data;
        self::$cacheJalur = $jalur;
        self::$cacheMtime = $mtime;
        return self::$cache;
    }

    // Peta slug -> seri untuk pencarian detail yang cepat.
    public static function petaSlug(): array
    {
        $data = self::muat();
        $peta = [];
        foreach ($data['anime'] as $seri) {
            if (isset($seri['slug']) && is_string($seri['slug'])) {
                $peta[$seri['slug']] = $seri;
            }
        }
        return $peta;
    }

    // Metadata sumber (informasi, bukan untuk dikonsumsi sebagai katalog).
    public static function meta(): array
    {
        $data = self::muat();
        return [
            'sumber'              => $data['sumber'] ?? null,
            'diambilPada'         => $data['diambil_pada'] ?? null,
            'totalSeri'           => $data['total_seri'] ?? count($data['anime']),
            'totalEpisode'        => $data['total_episode_terhitung'] ?? null,
            'catatan'             => $data['catatan'] ?? null,
        ];
    }
}
