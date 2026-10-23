# Perbaikan lanjutan Gamesku — 22 Oktober 2026

Audit ini dimulai dengan perubahan audit sebelumnya yang sudah ada di working tree. Perubahan tersebut dipertahankan. Catatan ini memperbarui status temuan pada `audit_perbaikan_2026-10-22.md`, termasuk masalah autentikasi yang dahulu belum diterapkan.

## Bug yang diperbaiki pada audit lanjutan

| Area | Penyebab dan perbaikan |
| --- | --- |
| Login pembeli | `Masuk.jsx` mengambil properti `masuk` yang berupa boolean sebagai fungsi. Sekarang menggunakan `masukFungsi` yang benar. |
| Sinkronisasi sesi | Setiap pemanggilan hook dahulu mempunyai state sendiri. Satu provider sekarang membagikan sesi ke login, profil, dan reseller. Respons pemeriksaan sesi awal yang terlambat tidak boleh menimpa login/logout baru. |
| Profil pembeli | UI akun aktif dahulu selalu menampilkan “Belum masuk”. Sekarang menampilkan nama/email dari server dan menyediakan logout. |
| CSRF pembeli/admin/reseller | Cache terpisah menjadi kedaluwarsa setelah login dan pergantian sesi. Token aktif diambil sebelum setiap mutasi; token yang tidak tersedia menyebabkan kegagalan jelas. Pengujian mereproduksi token lama saat logout sebelum perbaikan, kemudian lulus setelah perbaikan. Biayanya satu GET tambahan sebelum mutasi. Tidak ada retry otomatis terhadap mutasi. |
| Logout pembeli dan admin | Kegagalan server dahulu disembunyikan sambil menghapus sesi lokal. State sekarang hanya dibersihkan setelah server berhasil; galat ditampilkan dan pengguna bisa mencoba lagi. Kedua tombol logout admin diuji. |
| Reseller | “Ajukan kembali” dahulu tidak membuka formulir. Sekarang membuka formulir, galat pengiriman/pembatalan ditampilkan, dan tombol pembatalan dikunci selama request. |
| Jumlah keranjang | Penambahan pertama dahulu menerima angka negatif, pecahan, dan jumlah di atas batas. Tambah/ubah jumlah sekarang dinormalisasi ke bilangan bulat 1–10, termasuk input tidak finite. |
| Berkas produk | Respons katalog/detail publik dahulu menyertakan lokasi berkas produk berbayar. Field `fileProduk` sekarang dihilangkan untuk produk berbayar bagi non-admin; berkas gratis dan pengelolaan admin tetap tersedia. Status admin diverifikasi sekali per request katalog. |
| Preview produk | JSON valid yang bukan array dapat membuat pemanggilan `.join()` gagal. Backend sekarang selalu mengembalikan array string preview. |
| Ulasan publik | Rating 4–5 langsung disetujui di DB, tetapi respons menyatakan menunggu moderasi. Semua kiriman sekarang menunggu moderasi sesuai kontrak API. Produk tidak aktif/tidak ada ditolak sebelum INSERT. |
| Promo | Tanggal kalender tidak valid serta rentang terbalik sekarang ditolak dengan HTTP 422. Input diskon admin mengizinkan 0 sesuai fitur gratis biaya layanan pada backend. |
| Perintah pengujian | Frontend mendapat `npm test`, `npm run uji-regresi`, dan `npm run uji-pembeli`. `npm test` backend sekarang menjalankan pengujian PHP sungguhan. |

## Verifikasi

| Pemeriksaan | Hasil |
| --- | --- |
| Frontend `npm test` | 4 lulus, 0 gagal. Fetch dan penyimpanan terisolasi di proses test. |
| `npm run uji-pembeli` terhadap Vite dev | 6 kasus lulus: login dari dua rute, profil/logout beserta kegagalan dan retry, reseller, batas jumlah keranjang, logout admin dari sidebar/header. Menggunakan fixture HTTP terisolasi. |
| `scripts/uji-regresi.mjs` terhadap Vite dev | 19 kasus lulus, termasuk filter, race request, galat/retry, semua halaman admin terdaftar, dan layout 320/375/390/430/768/1280 px. Menggunakan fixture API. |
| Backend runner dengan `GAMEKU_TEST_BASE=http://127.0.0.1:8000` | 25 lulus, termasuk smoke HTTP tanpa mutasi database. |
| `tests/uji_pengendali_terisolasi.php` | 19 lulus dengan double Database/Auth; mencakup akses produk, preview, moderasi, tanggal promo, serta regresi idempotensi sebelumnya. |
| PHP syntax lint | 35 berkas di src/api/tests/database lulus. Konfigurasi rahasia tidak dibaca untuk lint. |
| Frontend lint | 0 error; 22 warning lama masih ada, terutama memo/effect dan deklarasi tidak terpakai. |
| `npm run build` | Lulus; frontend dan backend dikemas ke `dist/`. |
| `git diff --check` | Lulus. |

Perintah browser membutuhkan server Vite yang sudah berjalan. Browser pengujian bisa ditentukan dengan `GAMEKU_TEST_BROWSER`. Dalam audit ini digunakan Edge sistem. Suite browser menguji aplikasi dengan respons API terkontrol; ini bukan bukti transaksi MySQL nyata.

## Batas yang masih berlaku

- PHP default tidak memuat `pdo_mysql` dan tidak memuat php.ini. Percobaan dengan DLL `pdo_mysql` yang sudah tersedia, hanya untuk satu proses, masih menghasilkan `Database tidak dapat dihubungi`. Konfigurasi PHP global dan kredensial tidak diubah. Login, CRUD, kuota promo paralel, pembayaran, serta rollback perlu diuji lagi pada MySQL yang tersedia.
- Penghilangan `fileProduk` mencegah lokasi berkas berbayar bocor melalui katalog. Ini belum menjadi sistem otorisasi unduhan: URL berkas yang sudah diketahui atau dibagikan masih membutuhkan perlindungan penyimpanan/endpoint berdasarkan hak pembelian.
- Checkout frontend masih dinonaktifkan sesuai implementasi awal. Halaman CS admin belum tersedia. Fitur tersebut tidak diklaim selesai.
- Streaming/upstream AI, deployment Apache/Nginx, serta browser/perangkat selain yang diuji belum diverifikasi secara menyeluruh.
- `dist/` sebelum build dicadangkan ke `C:\Users\ARV\AppData\Local\Temp\gamesku-dist-lanjutan-a4c9404968a24b9ab0bd685cc74cc413`. Tidak ada perubahan skema, migrasi, instalasi DB, commit, atau push.
