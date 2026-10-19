path = 'backend/src/Pengendali/PengendaliAnime.php'
content = """<?php
// PengendaliAnime: endpoint katalog anime Streamku (read-only, GET saja).
// Memakai KatalogAnime sebagai satu-satunya pemuat data (tanpa duplikasi arsitektur).
// Tidak menyentuh database toko. Endpoint ini hanya metadata; sumber pemutaran
// video belum tersedia — data asli hanya berisi tautan halaman episode.

class PengendaliAnime extends PengendaliDasar
{
    private const PER_BAWAAN = 24;
    private const PER_MAKS = 48;

    // ================= PRODUCTION HARDENING =================
    // Timeout kumulatif upstream: 3 tahap × 8s = 24s maks
    public const UPSTREAM_TIMEOUT_BASE = 8;
    public const UPSTREAM_RETRIES = 2; // exponential backoff 1s, 2s

    // TTL cache pemutaran: 6 jam
    private const TTL_CACHE_PEMUTARAN = 21600;
    private const UA_PEMUTARAN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
    // ========================================================

    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        if ($metode !== 'GET') {
            $this->metodeTakDiizinkan();
            return;
        }
        // Muat katalog sekali; galat -> 500 generik (tanpa membocorkan path).
        try {
            $data = KatalogAnime::muat();
        } catch (Throwable $e) {
            error_log('[streamku] ' . $e->getMessage());
            Bantu::gagal('Katalog anime tidak dapat dimuat.', 500);
            return;
        }

        if ($id === null) {
            $this->katalog($data);
        } elseif ($sub === 'episode') {
            $this->episode($id);
        } else {
            $this->detail($id);
        }
    }

    // GET /api/anime — katalog + pencarian + pagination.
    private function katalog(array $data): void
    {
        $q = strtolower($this->qTeks('q'));
        $semua = $data['anime'] ?? [];

        if ($q !== '') {
            $semua = array_values(array_filter($semua, function ($s) use ($q) {
                $hay = strtolower(((string) ($s['judul'] ?? '')) . ' ' . ((string) ($s['slug'] ?? '')));
                return $hay !== '' && stripos($hay, $q) !== false;
            }));
        }

        $total = count($semua);
        $per = $this->qInt('per', self::PER_BAWAAN, 1, self::PER_MAKS);
        $halaman = $this->qInt('halaman', 1, 1, 1000000);
        $totalHalaman = $total > 0 ? (int) ceil($total / $per) : 1;
        if ($halaman > $totalHalaman) {
            $halaman = $totalHalaman;
        }
        $potong = array_slice($semua, ($halaman - 1) * $per, $per);

        Bantu::sukses([
            'items'        => array_map(fn($s) => $this->ringkas($s), $potong),
            'halaman'      => $halaman,
            'per'          => $per,
            'total'        => $total,
            'totalHalaman' => $totalHalaman,
            'kueri'        => $q,
            'sumber'       => $data['sumber'] ?? null,
            'diambilPada'  => $data['diambil_pada'] ?? null,
        ]);
    }

    // GET /api/anime/{slug} — detail seri + daftar episode.
    private function detail(string $slug): void
    {
        $seri = KatalogAnime::petaSlug()[$slug] ?? null;
        if ($seri === null) {
            Bantu::gagal('Seri anime tidak ditemukan.', 404);
            return;
        }
        $eps = array_map(fn($e) => $this->ringkasEps($e), $seri['eps'] ?? []);
        usort($eps, fn($a, $b) => $a['no'] <=> $b['no']);
        Bantu::sukses(['seri' => $this->ringkas($seri), 'episode' => $eps]);
    }

    // GET /api/anime/{slug}/episode/{no} — metadata satu episode + resolusi
    // sumber pemutaran lewat rantai resmi upstream (lihat resolusiPemutaran()).
    private function episode(string $slug): void
    {
        $noMentah = $this->segmen(3) ?? $this->qTeks('no');
        if ($noMentah === '' || !ctype_digit((string) $noMentah) || (int) $noMentah < 1) {
            Bantu::gagal('Nomor episode tidak valid.', 400);
            return;
        }
        $no = (int) $noMentah;

        $seri = KatalogAnime::petaSlug()[$slug] ?? null;
        if ($seri === null) {
            Bantu::gagal('Seri anime tidak ditemukan.', 404);
            return;
        }
        $ditemukan = null;
        foreach (($seri['eps'] ?? []) as $e) {
            if ((int) ($e['no'] ?? 0) === $no) {
                $ditemukan = $e;
                break;
            }
        }
        if ($ditemukan === null) {
            Bantu::gagal('Episode tidak ditemukan.', 404);
            return;
        }
        $eps = $this->ringkasEps($ditemunya);