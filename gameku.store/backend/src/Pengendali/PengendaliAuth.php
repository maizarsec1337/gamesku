<?php
// =====================================================================
// PengendaliAuth.php — autentikasi admin.
//   POST /api/auth/masuk   { pengguna, sandi }  -> buat sesi
//   POST /api/auth/keluar                      -> hancurkan sesi
//   GET  /api/auth/saya                        -> sesi admin saat ini
//   POST /api/auth/daftar    { ... } (admin)   -> tambah admin baru
// =====================================================================

class PengendaliAuth extends PengendaliDasar
{
    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        // Aksi auth ada di segmen pertama setelah 'auth' (posisi $id):
        // /api/auth/masuk -> $id = 'masuk'.
        $aksi = $id ?? 'saya';

        switch ($aksi) {
            case 'masuk':
                if ($metode !== 'POST') $this->metodeTakDiizinkan();
                $this->validasiMasuk();
                break;

            case 'keluar':
                if ($metode !== 'POST') $this->metodeTakDiizinkan();
                $this->validasiCsrf();
                Auth::keluar();
                Bantu::sukses(null, 'Berhasil keluar.');
                break;

            case 'saya':
                if ($metode !== 'GET') $this->metodeTakDiizinkan();
                $sesi = Auth::sesi();
                Bantu::sukses($sesi ? ['admin' => $sesi] : null);
                break;

            case 'daftar':
                // Hanya admin yang boleh menambah admin.
                Auth::wajib();
                $this->validasiCsrf();
                if ($metode !== 'POST') $this->metodeTakDiizinkan();
                $this->daftar();
                break;

            default:
                Bantu::gagal("Aksi auth '{$aksi}' tidak dikenal.", 404);
        }
    }

    // --- Autentikasi dengan rate limiting dan timing-safe comparison ---
    private function validasiMasuk(): void
    {
        $pengguna = $this->teks('pengguna');
        $sandi    = (string) ($this->badan()['sandi'] ?? '');

        // Batas coba login per 60 detik untuk mencegah brute force.
        // AuthRateLimiter::check() digunakan di Auth::masuk() langsung.
        $limiter = AuthRateLimiter::check($pengguna);
        if ($limiter['limited']) {
            // Detail tampilkan samar, hanya IP yang terdeteksi.
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            $store = &$_SESSION['_auth_rate'] ?? null;
            if (is_array($store) && isset($store['ips'][$ip])) {
                $entry = &$store['ips'][$ip];
                if (time() - $entry['window_start'] > 60) {
                    $entry['count'] = 0;
                }
            }
            Bantu::gagal('Layanan sibuk. Coba lagi nanti.', 429);
        }

        if ($pengguna === '' || $sandi === '') {
            Bantu::gagal('Pengguna dan sandi wajib diisi.');
        }

        // Gunakan timing-safe comparison (hash_equals) untuk security.
        // Password_verify() alimya sudah aman.
        $hasil = Auth::masuk($pengguna, $sandi);
        if (!$hasil['berhasil']) {
            // Jika rate limited, kirim 429. Jika gagal login biasa, 401.
            if (isset($hasil['limited']) && $hasil['limited']) {
                Bantu::gagal($hasil['pesan'], 429);
            }
            Bantu::gagal($hasil['pesan'], 401);
        }

        // Catat waktu masuk terakhir.
        try {
            Database::eksekusi('UPDATE admin SET masuk_terakhir = NOW() WHERE pengguna = ?', [$pengguna]);
        } catch (Throwable $e) { /* abaikan */ }

        Aktivitas::catat("Admin '{$pengguna}' masuk", 'kunci', 'biru', $pengguna);
        Bantu::sukses($hasil['data'], 'Berhasil masuk.');
    }

    private function daftar(): void
    {
        $pengguna = $this->teks('pengguna');
        $nama     = $this->teks('nama', $pengguna);
        $email    = $this->teks('email');
        $sandi    = (string) ($this->badan()['sandi'] ?? '');

        if ($pengguna === '' || $sandi === '') {
            Bantu::gagal('Pengguna dan sandi wajib diisi.');
        }
        if (strlen($sandi) < 6) {
            Bantu::gagal('Sandi minimal 6 karakter.');
        }
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Bantu::gagal('Format email tidak valid.');
        }

        $ada = Database::satu('SELECT id FROM admin WHERE pengguna = ?', [$pengguna]);
        if ($ada) {
            // Pesan umum — jangan buka informasi siapa yang ada di database.
            Bantu::gagal('Nama pengguna tidak dapat digunakan.', 409);
        }

        $hash = Auth::hash($sandi);
        Database::eksekusi(
            'INSERT INTO admin (pengguna, nama, email, sandi_hash, status) VALUES (?, ?, ?, ?, ?)',
            [$pengguna, $nama, $email, $hash, 'Aktif']
        );

        Aktivitas::catat("Admin '{$pengguna}' dibuat", 'kreator', 'hijau');
        Bantu::sukses(['pengguna' => $pengguna], 'Admin dibuat.', 201);
    }
}
