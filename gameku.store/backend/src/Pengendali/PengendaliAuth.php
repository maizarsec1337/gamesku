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
                $this->validateCsrf();
                Auth::keluar();
                Bantu::sukses(null, 'Berhasil keluar.');
                break;

            case 'saya':
                if ($metode !== 'GET') $this->metodeTakDiizinkan();
                $sesi = Auth::sesi();
                Bantu::sukses($sesi ? ['admin' => $sesi] : null);
                break;

            case 'daftar':
                // Hanya superadmin yang boleh membuat akun admin baru.
                Auth::wajibPeran('superadmin');
                $this->validateCsrf();
                if ($metode !== 'POST') $this->metodeTakDiizinkan();
                $this->daftar();
                break;

            case 'csrf':
            // Alias: frontend toko depan memanggil /api/auth/csrf-token.
            case 'csrf-token':
                if ($metode !== 'GET') $this->metodeTakDiizinkan();
                $token = Auth::buatTokenCsrf();
                Bantu::sukses(['csrf_token' => $token], 'Token CSRF siap.');
                break;

            case 'admin':
                $this->kelolaAdmin($metode, $sub);
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
        // 150 = panjang kolom email (login boleh memakai email).
        if (strlen($pengguna) > 150 || strlen($sandi) > 72) {
            // bcrypt hanya memproses 72 byte pertama; tolak yang lebih panjang
            // agar tidak ada perbedaan perilaku tak terduga.
            SecurityLog::catat('login_gagal', 'info', 'Login ditolak: panjang kredensial tidak wajar.');
            Bantu::gagal('Pengguna atau sandi salah.', 401);
        }

        // password_verify() sudah aman terhadap timing attack.
        $hasil = Auth::masuk($pengguna, $sandi);
        if (!$hasil['berhasil']) {
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

        $peran = $this->salahDari($this->teks('peran', 'admin'), self::PERAN, 'admin');

        $hash = Auth::hash($sandi);
        Database::eksekusi(
            'INSERT INTO admin (pengguna, nama, email, sandi_hash, status, peran) VALUES (?, ?, ?, ?, ?, ?)',
            [$pengguna, $nama, $email, $hash, 'Aktif', $peran]
        );

        SecurityLog::catat('admin_dibuat', 'info', 'Admin baru dibuat.', ['pengguna' => $pengguna, 'peran' => $peran]);
        Aktivitas::audit('buat_admin', 'admin', '', 'Berhasil', [
            'pengguna' => $pengguna,
            'email' => $email,
            'peran' => $peran,
        ], "Admin '{$pengguna}' dibuat");
        Bantu::sukses(['pengguna' => $pengguna, 'peran' => $peran], 'Admin dibuat.', 201);
    }

    // ===== Kelola admin (khusus superadmin) =====
    private const PERAN = ['superadmin', 'admin'];

    private function kelolaAdmin(string $metode, ?string $id): void
    {
        $sesi = Auth::wajibPeran('superadmin');

        switch ($metode) {
            case 'GET':
                $rows = Database::banyak(
                    'SELECT id, pengguna, nama, email, status, peran, dibuat_pada AS dibuatPada,
                        masuk_terakhir AS masukTerakhir FROM admin ORDER BY id ASC'
                );
                Bantu::sukses($rows);
                break;

            case 'PUT':
            case 'PATCH':
                $this->validateCsrf();
                if (!$id) Bantu::gagal('ID admin wajib ada.', 400);
                $this->ubahAdmin($id, $sesi);
                break;

            case 'DELETE':
                $this->validateCsrf();
                if (!$id) Bantu::gagal('ID admin wajib ada.', 400);
                $this->hapusAdmin($id, $sesi);
                break;

            default:
                $this->metodeTakDiizinkan();
        }
    }

    private function ubahAdmin(string $id, array $sesi): void
    {
        $lama = Database::satu('SELECT id, pengguna, status, peran FROM admin WHERE id = ?', [(int) $id]);
        if (!$lama) Bantu::gagal('Admin tidak ditemukan.', 404);

        $status = $this->salahDari($this->teks('status', $lama['status']), ['Aktif', 'Nonaktif'], $lama['status']);
        $peran  = $this->salahDari($this->teks('peran', $lama['peran']), self::PERAN, $lama['peran']);

        // Cegah superadmin menurunkan dirinya sendiri (kunci diri keluar dari RBAC).
        if ((int) $lama['id'] === (int) $sesi['id'] && ($peran !== 'superadmin' || $status !== 'Aktif')) {
            Bantu::gagal('Anda tidak dapat menonaktifkan/menurunkan peran akun sendiri.', 409);
        }

        Database::eksekusi('UPDATE admin SET status = ?, peran = ? WHERE id = ?', [$status, $peran, (int) $id]);
        Aktivitas::audit('ubah_admin', 'admin', $id, 'Berhasil', [
            'pengguna' => $lama['pengguna'] ?? '',
            'status' => $status,
            'peran' => $peran,
        ], "Admin '{$lama['pengguna']}' diperbarui");
        Bantu::sukses(['id' => (int) $id, 'status' => $status, 'peran' => $peran], 'Admin diperbarui.');
    }

    private function hapusAdmin(string $id, array $sesi): void
    {
        $baris = Database::satu('SELECT id, pengguna FROM admin WHERE id = ?', [(int) $id]);
        if (!$baris) Bantu::gagal('Admin tidak ditemukan.', 404);
        if ((int) $baris['id'] === (int) $sesi['id']) {
            Bantu::gagal('Anda tidak dapat menghapus akun sendiri.', 409);
        }
        // Jangan biarkan sistem tanpa superadmin aktif.
        $jumlahSuper = (int) (Database::nilai("SELECT COUNT(*) FROM admin WHERE peran = 'superadmin' AND status = 'Aktif'") ?? 0);
        $targetSuper = (int) (Database::nilai("SELECT COUNT(*) FROM admin WHERE id = ? AND peran = 'superadmin' AND status = 'Aktif'", [(int) $id]) ?? 0);
        if ($targetSuper > 0 && $jumlahSuper <= 1) {
            Bantu::gagal('Tidak dapat menghapus superadmin aktif terakhir.', 409);
        }

        Database::eksekusi('DELETE FROM admin WHERE id = ?', [(int) $id]);
        Aktivitas::audit('hapus_admin', 'admin', $id, 'Berhasil', [
            'pengguna' => $baris['pengguna'] ?? '',
        ], "Admin '{$baris['pengguna']}' dihapus");
        Bantu::sukses(['id' => (int) $id], 'Admin dihapus.');
    }
}
