<?php
// Autentikasi admin: masuk, keluar, sesi, dan tambah admin baru.

class PengendaliAuth extends PengendaliDasar
{
    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
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
                Auth::wajib();
                $this->validasiCsrf();
                if ($metode !== 'POST') $this->metodeTakDiizinkan();
                $this->daftar();
                break;

            default:
                Bantu::gagal("Aksi auth '{$aksi}' tidak dikenal.", 404);
        }
    }

    // Login dengan rate limiting per IP (file-based, bukan session).
    private function validasiMasuk(): void
    {
        $pengguna = $this->teks('pengguna');
        $sandi    = (string) ($this->badan()['sandi'] ?? '');

        $limiter = AuthRateLimiter::check($pengguna);
        if ($limiter['limited']) {
            // 429 + Retry-After; pesan samar agar tidak membocorkan status akun.
            header('Retry-After: ' . (int) ($limiter['retry_after'] ?? 60));
            Bantu::gagal('Layanan sibuk. Coba lagi nanti.', 429);
        }

        if ($pengguna === '' || $sandi === '') {
            Bantu::gagal('Pengguna dan sandi wajib diisi.');
        }

        // Batas panjang masuk akal (cegah payload besar memicu bcrypt lambat).
        if (strlen($pengguna) > 60 || strlen($sandi) > 72) {
            // bcrypt hanya memproses 72 byte pertama; tolak yang lebih panjang
            // agar tidak ada perbedaan perilaku tak terduga.
            SecurityLog::catat('login_gagal', 'info', 'Login ditolak: panjang kredensial tidak wajar.');
            Bantu::gagal('Pengguna atau sandi salah.', 401);
        }

        // password_verify() sudah aman terhadap timing attack.
        $hasil = Auth::masuk($pengguna, $sandi);
        if (!$hasil['berhasil']) {
            if (isset($hasil['limited']) && $hasil['limited']) {
                Bantu::gagal($hasil['pesan'], 429);
            }
            Bantu::gagal($hasil['pesan'], 401);
        }

        // Login sukses — reset counter percobaan agar user sah tidak terkunci.
        AuthRateLimiter::reset();

        try {
            Database::eksekusi('UPDATE admin SET masuk_terakhir = NOW() WHERE pengguna = ?', [$pengguna]);
        } catch (Throwable $e) { /* abaikan */ }

        Aktivitas::audit('masuk_admin', 'admin', (string) ($hasil['data']['id'] ?? ''), 'Berhasil', [
            'pengguna' => $pengguna,
        ], "Admin '{$pengguna}' masuk");
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
        // Kebijakan sandi: minimal 8 karakter (naik dari 6).
        if (strlen($sandi) < 8) {
            Bantu::gagal('Sandi minimal 8 karakter.');
        }
        if (strlen($sandi) > 72) {
            Bantu::gagal('Sandi maksimal 72 karakter.');
        }
        // Nama pengguna: huruf, angka, strip, underscore; 3-60 karakter.
        if (!preg_match('/^[A-Za-z0-9_\-.]{3,60}$/', $pengguna)) {
            Bantu::gagal('Nama pengguna hanya boleh berisi huruf, angka, strip, underscore (3-60 karakter).');
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

        SecurityLog::catat('admin_dibuat', 'info', 'Admin baru dibuat.', ['pengguna' => $pengguna]);
        Aktivitas::audit('buat_admin', 'admin', '', 'Berhasil', [
            'pengguna' => $pengguna,
            'email' => $email,
        ], "Admin '{$pengguna}' dibuat");
        Bantu::sukses(['pengguna' => $pengguna], 'Admin dibuat.', 201);
    }
}
