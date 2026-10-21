<?php
// Uji keamanan HTTP (smoke) terhadap server yang sudah berjalan.
// Dilewati otomatis bila env GAMEKU_TEST_BASE tidak diisi, mis.:
//   GAMEKU_TEST_BASE=http://localhost:8000 php backend/tests/jalankan.php
//
// Uji ini TIDAK memutasi data (tidak mendaftar/mengubah apa pun), hanya
// memverifikasi penegakan CSRF, autentikasi, dan keberadaan endpoint CSRF
// (regresi bug integrasi frontend /api/auth/csrf-token).

grup('Keamanan HTTP (smoke)');

$BASE = getenv('GAMEKU_TEST_BASE');

if (!$BASE) {
    echo '  [SKIP] GAMEKU_TEST_BASE tidak diisi — uji HTTP dilewati.' . PHP_EOL;
    echo '         Contoh: GAMEKU_TEST_BASE=http://localhost:8000 php tests/jalankan.php' . PHP_EOL;
    return;
}

$BASE = rtrim($BASE, '/');

// Permintaan HTTP sederhana yang mengembalikan [status, isi_json].
function httpPanggil(string $metode, string $jalur, ?array $body = null, array $header = []): array
{
    global $BASE;
    $header[] = 'Accept: application/json';
    $opsi = [
        'http' => [
            'method' => $metode,
            'header' => implode("\r\n", $header),
            'ignore_errors' => true,
            'timeout' => 10,
        ],
    ];
    if ($body !== null) {
        $opsi['http']['header'] .= "\r\nContent-Type: application/json";
        $opsi['http']['content'] = json_encode($body);
    }
    $isi = @file_get_contents($BASE . $jalur, false, stream_context_create($opsi));
    $status = 0;
    foreach ($http_response_header ?? [] as $h) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) {
            $status = (int) $m[1];
        }
    }
    return [$status, is_string($isi) ? json_decode($isi, true) : null];
}

uji('server dapat dihubungi (/api/sehat)', function () use ($BASE) {
    [$status] = httpPanggil('GET', '/api/sehat');
    tegaskan($status === 200, "status {$status} (server tidak dapat dihubungi?)");
});

uji('GET /api/auth/csrf-token tersedia (regresi bug integrasi)', function () {
    [$status, $data] = httpPanggil('GET', '/api/auth/csrf-token');
    sama(200, $status, 'endpoint csrf-token harus 200');
    tegaskan(!empty($data['data']['csrf_token']), 'csrf_token tidak dikembalikan');
});

uji('POST state-changing tanpa CSRF ditolak 403', function () {
    [$status] = httpPanggil('POST', '/api/pelanggan/masuk', ['email' => 'x@y.z', 'sandi' => 'x']);
    sama(403, $status, 'login pembeli tanpa token CSRF harus 403');
    [$statusPesan] = httpPanggil('POST', '/api/pesanan', ['item' => [['produkId' => 'x', 'jumlah' => 1]]]);
    sama(403, $statusPesan, 'checkout tanpa token CSRF harus 403');
    // Regresi: state-changing pada modul pesan juga harus tolak CSRF.
    [$statusBaca] = httpPanggil('POST', '/api/pesan/baca', ['percakapanId' => 'x']);
    sama(403, $statusBaca, 'baca pesan (POST) tanpa token CSRF harus 403');
    [$statusHapus] = httpPanggil('POST', '/api/pesan/msg-x', null, ['X-HTTP-Method-Override: DELETE']);
    sama(403, $statusHapus, 'hapus pesan (DELETE) tanpa token CSRF harus 403');
});

uji('endpoint admin tanpa sesi ditolak 401', function () {
    [$status] = httpPanggil('GET', '/api/pelanggan');
    sama(401, $status, 'daftar pelanggan tanpa sesi admin harus 401');
    [$statusDash] = httpPanggil('GET', '/api/dasbor');
    sama(401, $statusDash, 'dasbor tanpa sesi admin harus 401');
});
