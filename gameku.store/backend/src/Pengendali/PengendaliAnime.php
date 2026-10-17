<?php
// PengendaliAnime: endpoint katalog anime Streamku (read-only, GET saja).
// Memakai KatalogAnime sebagai satu-satunya pemuat data (tanpa duplikasi arsitektur).
// Tidak menyentuh database toko. Endpoint ini hanya metadata; sumber pemutaran
// video belum tersedia — data asli hanya berisi tautan halaman episode.

class PengendaliAnime extends PengendaliDasar
{
    private const PER_BAWAAN = 24;
    private const PER_MAKS = 48;

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
        $q = mb_strtolower($this->qTeks('q'));
        $semua = $data['anime'];

        if ($q !== '') {
            $semua = array_values(array_filter($semua, function ($s) use ($q) {
                $hay = mb_strtolower(((string) ($s['judul'] ?? '')) . ' ' . ((string) ($s['slug'] ?? '')));
                return $hay !== '' && mb_stripos($hay, $q) !== false;
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

    // GET /api/anime/{slug}/episode/{no} — metadata satu episode.
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
        $eps = $this->ringkasEps($ditemukan);
        $eps['sumberPemutaran'] = 'belum-tersedia';
        Bantu::sukses([
            'seri'    => ['judul' => (string) ($seri['judul'] ?? ''), 'slug' => (string) ($seri['slug'] ?? '')],
            'episode' => $eps,
        ]);
    }

    // ===== Pemetaan & utilitas =====

    private function ringkas(array $s): array
    {
        $terhitung = isset($s['eps_terhitung']) ? (int) $s['eps_terhitung']
            : (isset($s['eps']) && is_array($s['eps']) ? count($s['eps']) : 0);
        return [
            'idKategori'    => $s['id_kategori'] ?? null,
            'judul'         => (string) ($s['judul'] ?? ''),
            'slug'          => (string) ($s['slug'] ?? ''),
            'gambar'        => (string) ($s['gambar'] ?? ''),
            'jumlahEpisode' => $terhitung,
            'totalEpisode'  => isset($s['total_eps']) ? (int) $s['total_eps'] : $terhitung,
        ];
    }

    private function ringkasEps(array $e): array
    {
        return [
            'no'      => isset($e['no']) ? (int) $e['no'] : 0,
            'judul'   => (string) ($e['judul'] ?? ''),
            'tanggal' => (isset($e['tanggal']) && $e['tanggal'] !== '') ? (string) $e['tanggal'] : null,
            'link'    => (string) ($e['link'] ?? ''),
        ];
    }

    private function qTeks(string $k, string $b = ''): string
    {
        return trim((string) ($_GET[$k] ?? $b));
    }

    private function qInt(string $k, int $b, int $min, int $maks): int
    {
        $v = $_GET[$k] ?? null;
        if ($v === null || $v === '' || !is_numeric($v)) {
            return $b;
        }
        return max($min, min($maks, (int) $v));
    }

    // Segmen path ke-N (0-based), konsisten dengan parser index.php.
    private function segmen(int $i): ?string
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $jalur = preg_replace('#^/api#', '', rawurldecode($uri)) ?? '/';
        $jalur = preg_replace('#\.php$#', '', $jalur) ?? '/';
        $seg = array_values(array_filter(explode('/', $jalur), fn($s) => $s !== ''));
        return $seg[$i] ?? null;
    }
}

