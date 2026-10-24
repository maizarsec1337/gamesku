<?php
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
        Bantu::sukses([
            'seri'    => $this->ringkas($seri),
            'episode' => $eps,
        ]);
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
        $eps = $this->ringkasEps($ditemukan);
        $pemutaran = $this->resolusiPemutaran($slug, $no, (string) ($ditemukan['link'] ?? ''));
        $eps['sumberPemutaran'] = $pemutaran['sumberPemutaran'];
        $eps['urlPemutaran'] = $pemutaran['urlPemutaran'];
        $eps['embedPemutaran'] = $pemutaran['embedPemutaran'];
        $eps['diperiksaPada'] = $pemutaran['diperiksaPada'];
        Bantu::sukses([
            'seri'    => ['judul' => (string) ($seri['judul'] ?? ''), 'slug' => (string) ($seri['slug'] ?? '')],
            'episode' => $eps,
        ]);
    }

    private function ringkas(array $s): array
    {
        $terhitung = is_int($s['eps_terhitung'] ?? null)
            ? $s['eps_terhitung']
            : (is_array($s['eps'] ?? null) ? count($s['eps']) : 0);
        return [
            'idKategori'    => $s['id_kategori'] ?? null,
            'judul'         => (string) ($s['judul'] ?? ''),
            'slug'          => (string) ($s['slug'] ?? ''),
            'gambar'        => (string) ($s['gambar'] ?? ''),
            'jumlahEpisode' => $terhitung,
            'totalEpisode'  => is_int($s['total_eps'] ?? null) ? $s['total_eps'] : $terhitung,
        ];
    }

    private function ringkasEps(array $e): array
    {
        return [
            'no'      => (int) ($e['no'] ?? 0),
            'judul'   => (string) ($e['judul'] ?? ''),
            'tanggal' => isset($e['tanggal']) && $e['tanggal'] !== '' ? (string) $e['tanggal'] : null,
            'link'    => (string) ($e['link'] ?? ''),
        ];
    }

    private function qTeks(string $kunci): string
    {
        $v = $_GET[$kunci] ?? '';
        return is_string($v) ? trim($v) : '';
    }

    private function qInt(string $kunci, int $bawaan, int $min, int $maks): int
    {
        $mentah = $_GET[$kunci] ?? null;
        if ($mentah === null || $mentah === '' || !is_numeric($mentah)) {
            return $bawaan;
        }
        return max($min, min($maks, (int) $mentah));
    }

    private function segmen(int $indeks): ?string
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $jalur = preg_replace('#^/api#', '', rawurldecode($uri)) ?? '/';
        $jalur = preg_replace('#\.php$#', '', $jalur) ?? '/';
        $seg = array_values(array_filter(explode('/', '/' . trim($jalur, '/')), fn($s) => $s !== ''));
        // segmen: [0]=anime [1]=slug [2]=episode [3]=no
        return $seg[$indeks] ?? null;
    }

  
    private function resolusiPemutaran(string $slug, int $no, string $link): array
    {
        $kunci = 'streamku:' . $slug . ':' . $no;
        $cached = $this->cacheAmbil($kunci);
        if ($cached !== null) {
            return $cached;
        }
        $hasil = [
            'sumberPemutaran' => 'belum-tersedia',
            'urlPemutaran'    => null,
            'embedPemutaran'  => null,
            'diperiksaPada'   => gmdate('c'),
        ];
        if (!$this->urlAman($link)) {
            $this->cacheSimpan($kunci, $hasil);
            return $hasil;
        }
        try {
            $halaman = $this->httpAmbil($link, null);
            if (!is_string($halaman) || $halaman === '') {
                $this->cacheSimpan($kunci, $hasil);
                return $hasil;
            }
            $embed = $this->ekstrakIframePemutar($halaman);
            if ($embed === null) {
                $hash = $this->ekstrakHashMirror($halaman);
                if ($hash !== null) {
                    $embed = $this->mutasiAjaxPemuter($hash, $link);
                }
            }
            if ($embed !== null) {
                $isi = $this->httpAmbil($embed, $link);
                $tipe = null;
                $url = is_string($isi) ? $this->ekstrakUrlMedia($isi, $tipe) : null;
                if ($url === null) {
                    $isi2 = $this->httpAmbil($embed, null);
                    if (is_string($isi2) && $isi2 !== '') {
                        $url = $this->ekstrakUrlMedia($isi2, $tipe);
                    }
                }
                if ($url !== null) {
                    $hasil['sumberPemutaran'] = $tipe;
                    $hasil['urlPemutaran'] = $url;
                } else {
                    $hasil['sumberPemutaran'] = 'embed';
                    $hasil['embedPemutaran'] = $embed;
                }
            }
        } catch (Throwable $e) {
            error_log('[streamku][resolusi] gagal: ' . $e->getMessage());
        }
        $this->cacheSimpan($kunci, $hasil);
        return $hasil;
    }

    private function cacheDir(): string
    {
        $dir = sys_get_temp_dir() . '/streamku_cache';
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        return $dir;
    }

    private function cacheAmbil(string $kunci): ?array
    {
        $berkas = $this->cacheDir() . '/' . sha1($kunci) . '.json';
        if (!is_file($berkas)) {
            return null;
        }
        if ((time() - (int) @filemtime($berkas)) > self::TTL_CACHE_PEMUTARAN) {
            return null;
        }
        $mentah = @file_get_contents($berkas);
        if (!is_string($mentah) || $mentah === '') {
            return null;
        }
        $data = json_decode($mentah, true);
        return is_array($data) ? $data : null;
    }

    private function cacheSimpan(string $kunci, array $hasil): void
    {
        $berkas = $this->cacheDir() . '/' . sha1($kunci) . '.json';
        @file_put_contents($berkas, json_encode($hasil), LOCK_EX);
    }

    // GET aman dengan retry + exponential backoff (max 8s per upaya, 3 upaya).
    private function httpAmbil(string $url, ?string $rujukan): ?string
    {
        if (!$this->urlAman($url)) {
            return null;
        }
        $upayaMaks = self::UPSTREAM_RETRIES + 1;
        $tunda = [1, 2];
        for ($upaya = 0; $upaya < $upayaMaks; $upaya++) {
            if ($upaya > 0) {
                sleep($tunda[$upaya - 1] ?? 2);
            }
            $hasil = $this->httpAmbilSekali($url, $rujukan);
            if ($hasil !== null) {
                return $hasil;
            }
        }
        return null;
    }

    private function httpAmbilSekali(string $url, ?string $rujukan): ?string
    {
        $header = ['User-Agent: ' . self::UA_PEMUTARAN, 'Accept: text/html,*/*;q=0.8', 'Accept-Language: id-ID,id;q=0.9,en;q=0.8'];
        if ($rujukan !== null && $this->urlAman($rujukan)) {
            $header[] = 'Referer: ' . $rujukan;
        }
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            if ($ch === false) {
                return null;
            }
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_MAXREDIRS, 3);
            curl_setopt($ch, CURLOPT_TIMEOUT, self::UPSTREAM_TIMEOUT_BASE);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
            curl_setopt($ch, CURLOPT_HTTPHEADER, $header);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
            $isi = curl_exec($ch);
            $kode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if (!is_string($isi) || $isi === '' || $kode < 200 || $kode >= 300) {
                return null;
            }
            return $isi;
        }
        $konteks = stream_context_create(['http' => [
            'method' => 'GET', 'header' => implode("\r\n", $header),
            'timeout' => self::UPSTREAM_TIMEOUT_BASE, 'follow_location' => 1, 'max_redirects' => 3,
        ], 'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
        $isi = @file_get_contents($url, false, $konteks);
        return (is_string($isi) && $isi !== '') ? $isi : null;
    }

    private function httpPos(string $url, string $badan, ?string $rujukan): ?string
    {
        if (!$this->urlAman($url)) {
            return null;
        }
        $header = [
            'User-Agent: ' . self::UA_PEMUTARAN,
            'Accept: */*',
            'Content-Type: application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With: XMLHttpRequest',
            'Origin: https://otakudesu.com.mx',
        ];
        if ($rujukan !== null && $this->urlAman($rujukan)) {
            $header[] = 'Referer: ' . $rujukan;
        }
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            if ($ch === false) {
                return null;
            }
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $badan);
            curl_setopt($ch, CURLOPT_TIMEOUT, self::UPSTREAM_TIMEOUT_BASE);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
            curl_setopt($ch, CURLOPT_HTTPHEADER, $header);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
            $isi = curl_exec($ch);
            $kode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if (!is_string($isi) || $isi === '' || $kode < 200 || $kode >= 300) {
                return null;
            }
            return $isi;
        }
        $konteks = stream_context_create(['http' => [
            'method' => 'POST', 'header' => implode("\r\n", $header),
            'content' => $badan, 'timeout' => self::UPSTREAM_TIMEOUT_BASE,
        ], 'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
        $isi = @file_get_contents($url, false, $konteks);
        return (is_string($isi) && $isi !== '') ? $isi : null;
    }

    private function urlAman(string $url): bool
    {
        $b = parse_url($url);
        if (!is_array($b) || ($b['scheme'] ?? '') !== 'https' || !isset($b['host'])) {
            return false;
        }
        $host = strtolower((string) $b['host']);
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return false;
        }
        if ($host === 'localhost' || str_starts_with($host, '127.') || str_starts_with($host, '10.')
            || str_starts_with($host, '192.168.') || str_starts_with($host, '169.254.')) {
            return false;
        }
        return true;
    }

    private function ekstrakIframePemutar(string $html): ?string
    {
        foreach (['megavid', 'video-content'] as $cakupan) {
            $pos = strpos($html, $cakupan);
            if ($pos === false) {
                continue;
            }
            $awal = max(0, $pos - 2000);
            $potong = substr($html, $awal, 12000);
            if (preg_match('#<iframe[^>]*?src=["\'](https://[^"\']+)["\']#i', $potong, $m)) {
                $embed = trim($m[1]);
                if ($this->urlAman($embed)) {
                    return $embed;
                }
            }
        }
        return null;
    }

    private function ekstrakHashMirror(string $html): ?string
    {
        if (!preg_match('#<option\s+value=["\']([A-Za-z0-9+/=]{40,})["\']#', $html, $m)) {
            return null;
        }
        $terkode = trim($m[1]);
        $terurai = base64_decode($terkode, true);
        if (!is_string($terurai) || $terurai === '') {
            return null;
        }
        if (preg_match('#data-video=["\']([A-Za-z0-9_-]{4,32})["\']#', $terurai, $h)) {
            return trim($h[1]);
        }
        return null;
    }

    private function mutasiAjaxPemuter(string $hash, string $linkHalaman): ?string
    {
        if (!preg_match('#^[A-Za-z0-9_-]{4,32}$#', $hash)) {
            return null;
        }
        $b = parse_url($linkHalaman);
        if (!is_array($b) || !isset($b['host'])) {
            return null;
        }
        $skema = ($b['scheme'] ?? 'https') === 'http' ? 'http' : 'https';
        $host = strtolower((string) $b['host']);
        if ($host !== 'otakudesu.com.mx' && !str_ends_with($host, '.otakudesu.com.mx')) {
            return null;
        }
        $url = $skema . '://' . $host . '/wp-admin/admin-ajax.php';
        $isi = $this->httpPos($url, 'action=as_load_player&hash=' . rawurlencode($hash), $linkHalaman);
        if (!is_string($isi) || $isi === '') {
            return null;
        }
        if (preg_match('#<iframe[^>]*?src=["\'](https://[^"\']+)["\']#i', $isi, $m)) {
            $embed = trim($m[1]);
            return $this->urlAman($embed) ? $embed : null;
        }
        return null;
    }

    private function ekstrakUrlMedia(string $isi, ?string &$tipe): ?string
    {
        $tipe = null;
        $pola = [
            'm3u8' => '#(https://[^\s"\'\\\\]+?\.m3u8(?:\?[^\s"\'\\\\]*)?)#i',
            'mp4' => '#(https://[^\s"\'\\\\]+?\.mp4(?:\?[^\s"\'\\\\]*)?)#i',
        ];
        foreach ($pola as $nama => $rx) {
            if (preg_match($rx, $isi, $m)) {
                $url = trim($m[1]);
                if ($this->urlAman($url)) {
                    $tipe = $nama === 'm3u8' ? 'hls' : 'mp4';
                    return $url;
                }
            }
        }
        return null;
    }
}
