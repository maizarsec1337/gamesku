# Audit Gamesku — 22 Oktober 2026

> Catatan audit awal. Status terbaru, termasuk perbaikan autentikasi, terdapat pada [audit lanjutan](audit_lanjutan_2026-10-22.md).

## Kondisi awal dan batas verifikasi

- Git bersih sebelum audit; tidak ada AGENTS.md ditemukan pada workspace.
- Frontend React 19 / Vite 8; backend PHP 8.3 / PDO MySQL. Build resmi `npm run build` menghasilkan `gameku.store/dist`, kemudian mengemas backend. Konfigurasi output dipertahankan.
- `npm.cmd run lint`: exit 0, 26 peringatan (termasuk JSX tidak terdefinisi dan penugasan ulang const).
- Build awal gagal: dua `ILLEGAL_REASSIGNMENT` pada layananPesanan.js.
- PHP lint seluruh 35 berkas non-konfigurasi lulus; runner backend awal 20 lulus, kemudian 24 lulus dengan smoke HTTP.
- `/api/sehat`: HTTP 200, tetapi `database: gagal`. Tidak ada instalasi/migrasi atau mutasi database dijalankan. CRUD, transaksi nyata, dan login belum dapat diverifikasi terhadap MySQL.
- Uji visual bawaan gagal karena path Chrome tidak ada. Edge tersedia; pemeriksaan browser awal menampilkan `koleksi is not defined`.
- Folder dist lama dicadangkan sebelum build ke direktori sementara sistem, karena build resmi mengosongkan output.

## Temuan sebelum perbaikan

Lokasi mengacu pada simbol/fungsi agar tetap berlaku setelah nomor baris berubah.

| Prioritas | File / lokasi | Bukti, gejala dan dampak | Rekomendasi |
| --- | --- | --- | --- |
| Critical | frontend/src/layanan/layananPesanan.js: memoVersi, daftarPesanan, tambahPesanan, subscribePesanan | Build gagal karena `const versi += 1`. Browser gagal saat provider membaca `koleksi` yang tidak didefinisikan. STATUS_PESANAN juga tidak diimpor; unsubscribe justru mendaftar lagi. Seluruh aplikasi terhalang. Direproduksi build/browser. | Pulihkan koleksi lokal yang sudah menjadi model layanan ini, gunakan memo dan unsubscribe bawaan penyimpanan. |
| Critical | frontend/src/App.jsx: elemen rute superadmin | SuperadminDasbor digunakan tanpa import; lint mendeteksi JSX tidak terdefinisi, akan dievaluasi saat App render. | Impor komponen yang sudah tersedia. |
| High | frontend/src/konteks/KonteksPesanan.jsx: badan provider | subscribe dipanggil setiap render tanpa cleanup; callback menumpuk dan hidup setelah unmount. Terbukti dari kode, pengukuran runtime lanjutan diperlukan. | Daftarkan dalam effect dengan cleanup. |
| High | backend/api/index.php: penyajian berkas statis | GET /database/schema.sql HTTP 200, 29.827 byte. /tests/uji_bantu.php dan /src/Bantu.php ikut dieksekusi langsung (500). Server built-in mengabaikan .htaccess. | Batasi berkas statis ke unggahan publik dan aset publik, blokir direktori internal berdasarkan path kanonik. |
| High | frontend/src/halaman/Store.jsx dan Kategori.jsx: daftarHasil | useMemo tidak bergantung snapshot produk; saat fetch selesai filter dapat mempertahankan hasil kosong. Store juga mendahulukan query URL lama atas input baru; reset tidak mengosongkan state lokal. Terbukti dependensi/ekspresi kode; pengujian browser menyusul setelah crash awal diperbaiki. | Jadikan URL sumber pencarian Store, sertakan snapshot katalog pada dependensi memo. |
| High | frontend/src/layanan/gunakanApi.js: muat | Hanya cek mounted; respons lama bisa menimpa hasil permintaan baru atau mematikan loading terlalu dini. Terbukti alur kode; reproduksi respons tertunda diperlukan. | Beri nomor permintaan dan terapkan hanya hasil terbaru. |
| Medium | frontend/src/layanan/layananProduk.js dan halaman katalog | Status memuat/galat tidak masuk snapshot; kegagalan API disajikan seperti katalog kosong, tanpa retry. Database lokal gagal sehingga skenario dapat diverifikasi. | Ekspos status cache tanpa mengubah endpoint/request; tampilkan loading/galat dan retry. |
| Medium | frontend/scripts/uji-visual.mjs | Uji gagal karena Chrome dikunci pada path Windows tertentu; hanya mencetak hasil, tidak menggagalkan proses ketika route/overflow/console bermasalah. | Temukan browser yang tersedia dan tegakkan asersi. |
| High | backend/src/Pengendali/PengendaliProduk.php: satu | Berbeda dari daftar, detail tidak memeriksa status Aktif bagi tamu. Draft/Nonaktif dapat dibaca bila ID/slug diketahui. Terbukti alur kode, belum direproduksi dengan DB nyata. | Terapkan aturan publik yang sama pada detail. |
| High | backend/src/Pengendali/PengendaliPesanan.php: promo dan catch | Checkout memilih promo berdasarkan status tersimpan tanpa tanggal; berbeda dari cek promo yang menghitung tanggal setiap baca. PDOException adalah turunan RuntimeException, sehingga catch idempotensi setelahnya tidak terjangkau. Terbukti kode; transaksi nyata belum diuji. | Validasi tanggal pada query promo dan urutkan catch paling khusus dahulu. |
| High, menunggu persetujuan | frontend/src/layanan/layananSesiPembeli.js: masukPembeli | Backend merotasi CSRF setelah login, tetapi cache frontend tetap token pra-login; logout/aksi berikut dapat 403. Terbukti perbandingan kode frontend–backend, belum diuji login nyata. | Invalidasi cache setelah sukses login; perubahan alur login memerlukan persetujuan pengguna (batasan nomor 4). |
| Medium, perlu verifikasi | frontend/src/halaman/DetailAnime.jsx: pilihEpisode | Request episode paralel tidak dibedakan; respons episode sebelumnya dapat mengganti video pilihan terbaru. Pemain juga tidak direset saat slug berubah. | Terapkan identitas permintaan dan reset pilihan saat seri berubah. |
| Medium | frontend/src/halaman-admin/AdminProdukTambah.jsx | Loading/galat kategori diperlakukan sebagai kategori kosong; galat detail edit diabaikan sehingga form kosong masih dapat disimpan ke ID edit. Terbukti kode; uji browser terkontrol diperlukan. | Tampilkan loading/galat sebelum form, remount editor ketika ID berubah. |
| Medium | frontend/src/halaman-admin/AdminPengaturan.jsx | Preferensi ditulis ke localStorage tetapi tidak pernah dibaca kembali saat halaman dimount. | Inisialisasikan preferensi panel dari penyimpanan yang sama; jangan ubah konfigurasi sensitif. |
| Medium, belum tersedia | frontend/src/halaman/Keranjang.jsx dan komponen/admin/BilahSamping.jsx | Checkout memang disabled dan diberi komentar UI tanpa pembayaran nyata; menu CS mengarah /admin/cs yang tidak terdaftar. Ini fitur belum lengkap, bukan kegagalan endpoint terverifikasi. | Memerlukan keputusan cakupan fitur; jangan mengarang halaman/endpoint/pembayaran. |
| Low | lint / kode sisa | Peringatan dependency memo admin dan setState effect; beberapa konstanta/deklarasi tidak dipakai. Tidak semua merupakan bug fungsional. | Utamakan error fungsional, hindari pembersihan luas tanpa kebutuhan. |

## Batas perubahan

Tidak mengubah query.sql, .env, kredensial, secret, token, konfigurasi sensitif, sistem login, skema database, dependensi, atau mekanisme build. Tidak commit/push. Tidak mengganti katalog backend dengan data dummy. Fixture bila dipakai hanya hidup dalam pengujian terisolasi.

## Hasil setelah perbaikan

### Perbaikan yang diterapkan

| Berkas yang diubah | Alasan / hasil |
| --- | --- |
| frontend/src/App.jsx | Impor rute SuperadminDasbor yang hilang. |
| frontend/src/komponen/IkonAdmin.jsx | Impor Eye yang hilang. Ditemukan lewat browser: bukan hanya admin, empty state berikon admin juga dapat memicu error global. |
| frontend/src/layanan/layananPesanan.js | Pulihkan deklarasi koleksi/status dan memo stabil bawaan; hapus const yang ditulis ulang; unsubscribe mengembalikan cleanup sebenarnya. |
| frontend/src/konteks/KonteksPesanan.jsx | Pindahkan subscription ke effect dengan cleanup. |
| frontend/src/halaman/Store.jsx | Search memakai query URL, reset/Back sinkron, kategori slug mendapat indikator benar, memo bergantung snapshot katalog. |
| frontend/src/halaman/Kategori.jsx | Filter dihitung dari snapshot produk terbaru; hilangkan tombol kategori duplikat yang tidak melakukan apa pun. |
| frontend/src/halaman-admin/AdminProduk.jsx | Pencarian halaman mengikuti URL, termasuk saat header mencari di rute yang sedang terbuka. |
| frontend/src/komponen/FilterProduk.jsx | Opsi menyembunyikan pemilih kategori duplikat pada halaman kategori; hilangkan role tablist yang tidak sesuai tombol filter. |
| frontend/src/layanan/gunakanApi.js | Nomor permintaan mencegah hasil/galat/loading dari permintaan lama menimpa permintaan terbaru; cleanup menginvalidasi hasil terlambat. Transport API tetap sama. |
| frontend/src/layanan/layananProduk.js | Tambah snapshot status loading/galat yang stabil; cariProduk dapat memakai snapshot eksplisit. Request dan endpoint tidak berubah. |
| frontend/src/komponen/KeadaanKatalog.jsx (baru) | Tampilan loading, galat generik, dan retry menggunakan pemuat katalog yang sudah tersedia. |
| frontend/src/halaman/{DetailProduk,Gratis,Promo,Wishlist}.jsx | Bedakan loading/galat dari data kosong; detail direset saat produk berubah. |
| frontend/src/komponen/DetailProduk.jsx | Nama creator kosong/null tidak menyebabkan `.slice()` crash. |
| frontend/src/halaman/DetailAnime.jsx | Hanya respons episode terbaru diterapkan; pergantian seri dan sumber video mereset state pemain. |
| frontend/src/halaman-admin/AdminProdukTambah.jsx | Blokir form ketika detail/kategori belum selesai atau gagal; retry tersedia; perubahan ID meremount editor agar data lama tidak terbawa. |
| frontend/src/halaman-admin/AdminPengaturan.jsx | Baca kembali preferensi panel lokal yang sebelumnya hanya ditulis. Tidak mengubah konfigurasi server/autentikasi. |
| frontend/vite.config.js | Proxy `/uploads` pada dev dan preview ke backend yang sama. Output build dan proxy `/api` dipertahankan. |
| backend/api/index.php | Blokir area internal dan dot path; hanya aset publik yang boleh disajikan langsung, setelah pemeriksaan realpath. |
| backend/src/Pengendali/PengendaliProduk.php | Tamu menerima 404 untuk detail Draft/Nonaktif; admin tetap bisa membaca Draft. Tidak mengubah login/sesi. |
| backend/src/Pengendali/PengendaliPesanan.php | Cek tanggal promo saat checkout agar sesuai endpoint cek promo; tangani PDOException sebelum RuntimeException sehingga retry idempotensi dapat bekerja. |
| frontend/.oxlintrc.json | no-undef, no-const-assign, dan jsx-no-undef menjadi error; deklarasikan environment browser/Node agar impor hilang tidak lolos lagi. |
| frontend/scripts/uji-visual.mjs | Deteksi Chrome/Edge atau fallback Playwright, tambahkan tablet, klik navbar desktop yang benar, gagal dengan exit 1 bila ada error/overflow/rute gagal. |
| frontend/scripts/uji-regresi.mjs (baru) | Regresi browser terisolasi dengan fixture API, tidak mengubah database/data pengguna. |
| frontend/scripts/uji-layanan.test.mjs (baru) | Tiga unit test snapshot, notifikasi/unsubscribe, dan validasi status pesanan. |
| backend/tests/uji_keamanan.php | Tambah regresi HTTP untuk blokir berkas internal. |
| backend/tests/uji_pengendali_terisolasi.php (baru) | Enam pengujian pengendali dengan double Database/Auth di proses tersendiri; tidak memuat bootstrap/kredensial. |
| README.md | Perbaiki perintah startup backend agar benar-benar memakai router PHP. |
| docs/audit_perbaikan_2026-10-22.md (baru) | Bukti audit, prioritas, batas verifikasi, dan hasil. |

### Pengujian yang benar-benar dijalankan

| Perintah / pemeriksaan | Hasil |
| --- | --- |
| `npm.cmd ls --depth=0` | Lulus; dependensi terpasang, tidak ada dependensi baru atau lockfile yang diubah. |
| `npm.cmd run lint` | Exit 0, **0 error, 22 warning**. Warning tersisa berupa memo/effect dan deklarasi sisa; tidak diklaim bersih total. |
| `node --test scripts/uji-layanan.test.mjs` | **3 lulus, 0 gagal**. Penyimpanan hanya Map dalam proses test. |
| `node scripts/uji-regresi.mjs` terhadap Vite dev | **19 kasus lulus, 0 gagal** pada pengulangan akhir. Termasuk respons tertunda, search/reset/Back, keranjang/wishlist/batas jumlah, race useApi, galat dan retry katalog, form edit 404, preferensi reload, race episode, search admin, modal/Escape/scroll lock, seluruh 12 halaman admin, dan layout/chat pada 320/375/390/430/768/1280 px. Fixture API terisolasi, bukan bukti integrasi MySQL. |
| `GAMEKU_TEST_BASE=http://localhost:8000 php tests/jalankan.php` | **25 lulus, 0 gagal**, termasuk smoke CSRF, akses admin tanpa sesi, dan blokir berkas internal. Tidak melakukan login atau transaksi DB. |
| `php tests/uji_pengendali_terisolasi.php` | **6 lulus, 0 gagal**: detail Aktif/Draft/Nonaktif, admin melihat Draft, race idempotensi, konflik kuota 409. Menggunakan double, bukan database nyata. |
| `php -l` seluruh berkas PHP kecuali konfigurasi sensitif | **36 berkas lulus**. |
| Fixture PNG sementara di uploads + fetch melalui Vite | Lulus: HTTP 200 dan byte identik. Berkas test dibuat dengan nama acak eksklusif dan dihapus kembali; tidak menyentuh unggahan pengguna. |
| `npm.cmd run build` | **Lulus**, termasuk kemas-backend; output tetap `gameku.store/dist`. |
| `npm.cmd run uji-visual -- http://127.0.0.1:4173` | Dijalankan terhadap preview hasil build, kemudian diulang di luar sandbox setelah izin akses jaringan. Hasil akhir **exit 1**: keenam viewport overflowX=0, klik navigasi Store berhasil, gagalRute kosong, reduced-motion terdeteksi. Tetap ada console HTTP 500 dari API karena driver DB tidak tersedia. ERR_NETWORK_ACCESS_DENIED hanya muncul pada percobaan sandbox; tidak muncul pada hasil ulang. Suite integrasi **belum lulus**. |
| `git diff --check` | Lulus. |
| Pemeriksaan file terlindungi/hash | query.sql/.env/kredensial/Auth.php/layananSesiPembeli.js/apiAdmin.js tidak berubah; konfigurasi hasil build identik dengan sumber. |

Build awal yang gagal dan beberapa kegagalan fixture/locator selama pengembangan tidak dihitung sebagai pengujian lulus. Hasil final di atas berasal dari pengulangan setelah perbaikan. Suite visual live dibedakan dari suite fixture agar kegagalan layanan nyata tidak disembunyikan.

### Belum terselesaikan / risiko dan pemeriksaan manual

1. **Lingkungan lokal — High:** `php -m` tidak memuat `pdo_mysql`; `/api/sehat` menyatakan database gagal. Driver MySQL perlu diaktifkan pada PHP yang dipakai, lalu uji ulang koneksi dengan konfigurasi yang sudah ada. Konfigurasi runtime/rahasia tidak diubah dalam audit ini. Tidak ada instalasi atau migrasi database dijalankan.
2. **Autentikasi — High, perlu persetujuan:** cache CSRF frontend pembeli tetap token pra-login, sementara Auth::masukPembeli merotasinya. Usulan perubahan konkret: pada `masukPembeli`, tunggu hasil POST yang sama, kosongkan cache token hanya setelah sukses, lalu kembalikan hasil. Tidak mengubah nilai token/password atau endpoint. Belum diterapkan karena batasan pengguna nomor 4 meminta persetujuan untuk perubahan login. Login/logout nyata belum bisa diuji tanpa DB.
3. **Kontrak produk — perlu verifikasi:** respons publik produk mencakup `fileProduk`. Bila isinya tautan unduhan produk berbayar tanpa perlindungan, ada risiko akses tanpa pembelian. Nilai nyata dan aturan entitlement perlu diperiksa; penghapusan field atau perubahan kontrak tidak dilakukan tanpa keputusan.
4. **Transaksi nyata:** query tanggal promo sudah diperbaiki secara statis, tetapi tanggal batas, promo kedaluwarsa, kuota paralel, retry checkout paralel, dan rollback perlu integration test pada MySQL terisolasi. Uji double untuk exception bukan pengganti uji transaksi.
5. **Fitur belum lengkap:** checkout toko memang disabled, menu `/admin/cs` belum memiliki halaman; opsi urut `populer` memakai fallback terbaru karena tidak ada metrik penjualan publik. Jangan menganggap fitur-fitur ini sudah selesai. Memerlukan keputusan produk/kontrak sebelum implementasi.
6. **Streaming/AI:** mode panduan chat dan race pemilihan episode diuji dengan fixture. Pemutaran/provider AI nyata, CORS/upstream, timeout panjang, dan keyboard virtual perangkat asli perlu uji manual dengan layanan tersedia.
7. **Sisa audit UI:** otomatisasi memeriksa geometry/overflow, navigasi, modal dan console; belum merupakan pemeriksaan visual piksel penuh, Safari/iOS/Firefox, screen reader, atau semua kemungkinan kombinasi data panjang. Tidak ada perubahan CSS/arsitektur luas.
8. **Konfigurasi deployment:** proteksi Apache `.htaccess` perlu dicek pada hosting sebenarnya; server PHP lokal menguji proteksi router. Nginx memerlukan aturan hosting yang setara. Build tetap mengikuti mekanisme lama; dist awal dicadangkan pada `C:\Users\ARV\AppData\Local\Temp\gamesku-dist-audit-53c3655768ea42c1a22fa04f44b382cc` sebelum build resmi mengosongkan output.
9. **Dokumentasi/setup:** README lama merujuk `config/contoh.config.php` yang tidak ada pada checkout ini; tidak membuat atau menulis ulang konfigurasi sensitif. Pengaturan server baru tetap perlu sumber konfigurasi resmi pemilik project.
10. **Peringatan lint dan typo dekoratif:** 22 warning belum dibersihkan massal. Misalnya ikon `silangLingkaron` di AdminReseller memakai fallback karena typo; dampak dekoratif Low, tidak menghalangi aksi. Tidak ada commit atau push.

### Usulan konkret yang menunggu persetujuan autentikasi

Pada `frontend/src/layanan/layananSesiPembeli.js`, di fungsi `masukPembeli`, perubahan yang diusulkan hanya:

```diff
-  return minta('/pelanggan/masuk', {
+  const data = await minta('/pelanggan/masuk', {
     // method, headers, dan body yang ada tetap sama
   })
+  tokenCsrf = null
+  return data
```

Cache baru dibuang setelah respons login sukses, sehingga request berikut mengambil token aktif dari endpoint yang sudah ada. Ini **belum diterapkan** dan nilai token tidak dicatat atau ditulis ke file. Setelah disetujui, perlu regresi login → logout dan login → aksi reseller pada sesi server nyata.
