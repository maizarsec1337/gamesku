<?php
// Uji rate limiter file-based (RateLimiter). Membuat bucket uji unik agar
// tidak mengganggu counter runtime lain.

grup('RateLimiter');

function bucketUji(): array
{
    return [
        'uji_' . bin2hex(random_bytes(4)),
        'ip-' . bin2hex(random_bytes(6)),
    ];
}

uji('membatasi request setelah melewati limit', function () {
    [$bucket, $key] = bucketUji();
    $limit = 3;
    $window = 60;

    $hasil = [];
    for ($i = 0; $i < 4; $i++) {
        $hasil[] = RateLimiter::check($bucket, $key, $limit, $window);
    }

    tegaskan(!$hasil[0]['limited'], 'req-1 tidak dibatasi');
    tegaskan(!$hasil[1]['limited'], 'req-2 tidak dibatasi');
    tegaskan(!$hasil[2]['limited'], 'req-3 tidak dibatasi');
    tegaskan($hasil[3]['limited'], 'req-4 harus dibatasi');
    sama(0, $hasil[3]['remaining'], 'sisa nol saat dibatasi');
    tegaskan($hasil[3]['retry_after'] > 0, 'retry_after positif');
});

uji('kunci berbeda dihitung terpisah', function () {
    [$bucket, ] = bucketUji();
    $a = RateLimiter::check($bucket, 'klien-a', 1, 60);
    $b = RateLimiter::check($bucket, 'klien-b', 1, 60);
    tegaskan(!$a['limited'], 'klien-a lolos pada hit pertama');
    tegaskan(!$b['limited'], 'klien-b tidak terpengaruh klien-a');
    $a2 = RateLimiter::check($bucket, 'klien-a', 1, 60);
    tegaskan($a2['limited'], 'klien-a dibatasi pada hit kedua');
});

uji('peek tidak menambah hitungan', function () {
    [$bucket, $key] = bucketUji();
    RateLimiter::check($bucket, $key, 3, 60);
    $p1 = RateLimiter::peek($bucket, $key, 3, 60);
    $p2 = RateLimiter::peek($bucket, $key, 3, 60);
    sama($p1['remaining'], $p2['remaining'], 'peek berulang tidak mengubah sisa');
    sama(2, $p1['remaining'], 'sisa setelah satu hit adalah limit-1');
});
