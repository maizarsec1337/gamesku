<?php
// Uji unit untuk Bantu (helper) & Kecil (validasi). Tanpa dependensi.

grup('Bantu');

uji('slug: lower, spasi → tanda hubung', function () {
    sama('skin-pack-premium', Bantu::slug('  Skin Pack  PREMIUM '));
    sama('a-1-b', Bantu::slug('A 1 B'));
    // Aksen: hasil tetap valid apa pun perilaku transliterasi iconv per sistem.
    tegaskan((bool) preg_match('/^[a-z0-9-]+$/', Bantu::slug('Café Déjà')), 'slug aksen valid');
    tegaskan(Bantu::slug('Café Déjà') !== '', 'slug aksen tidak kosong');
});

uji('potong: batas karakter multibyte', function () {
    sama('café', Bantu::potong('café latté', 4));
    sama('', Bantu::potong('apa saja', 0));
    // maks negatif diperlakukan sebagai 0 → string kosong.
    sama('', Bantu::potong('abc', -5));
});

uji('keJson: array → JSON, kosong → null', function () {
    sama(null, Bantu::keJson([]));
    sama(null, Bantu::keJson(''));
    sama('["a","b"]', Bantu::keJson(['a', 'b']));
    // String yang sudah JSON dipertahankan sebagai JSON valid.
    sama('{"x":1}', Bantu::keJson('{"x":1}'));
});

uji('emailValid & sandiValid', function () {
    tegaskan(Bantu::emailValid('a@b.com'));
    tegaskan(!Bantu::emailValid('bukan-email'));
    tegaskan(Bantu::sandiValid('rahasia9', 8));
    tegaskan(!Bantu::sandiValid('short', 8));
});

uji('nomorPesanan: format GK-YYMM-XXXX', function () {
    tegaskan((bool) preg_match('/^GK-\d{4}-\d{4}$/', Bantu::nomorPesanan()));
});

uji('idBaru & idBaruAman: prefix + aman untuk kolom ID', function () {
    $id = Bantu::idBaru('prd');
    tegaskan(strpos($id, 'prd-') === 0, 'prefix prd-');
    tegaskan((bool) preg_match('/^[A-Za-z0-9\-_]+$/', $id), 'karakter aman');
    $aman = Bantu::idBaruAman('pay');
    tegaskan(strpos($aman, 'pay-') === 0);
    tegaskan(strlen($aman) <= 64, 'muat VARCHAR(64)');
});

uji('teksAman: strip karakter di luar whitelist', function () {
    sama('prd-1_2:3.4', Bantu::teksAman('k', 'prd-1_2:3.4'));
    // Spasi dan tanda baca (< > ! @ #) dibuang; hanya [A-Za-z0-9-_:.] tersisa.
    sama('abcdef', Bantu::teksAman('k', 'a<b>c!d@e#f'));
});

grup('Kecil');

uji('Kecil::idValid, isSlug, emailValid, isInEnum', function () {
    tegaskan(Kecil::idValid('cak-abc-123'));
    tegaskan(!Kecil::idValid('cak abc/..'));
    tegaskan(Kecil::isSlug('skin-pack-1'));
    tegaskan(!Kecil::isSlug('Skin Pack'));
    tegaskan(Kecil::emailValid('x@y.id'));
    tegaskan(Kecil::emailValid(null));
    tegaskan(!Kecil::emailValid('x@'));
    tegaskan(Kecil::isInEnum('open', ['open', 'closed']));
    tegaskan(!Kecil::isInEnum('x', ['open']));
});

uji('Kecil::htmlEncode escapes', function () {
    sama('&lt;b&gt;&amp;&quot;&#039;', Kecil::htmlEncode('<b>&"\''));
});
