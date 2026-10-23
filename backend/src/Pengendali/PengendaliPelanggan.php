<?php
// CRUD pelanggan; totalBeli & jumlahPesanan dihitung dari tabel pesanan.

class PengendaliPelanggan extends PengendaliDasar
{
    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        // Sesi pembeli (toko depan) — terpisah dari sesi admin, tidak
        // memerlukan Auth::wajib() (admin). CSRF berlaku untuk POST state-changing.
        // Dispatch memakai $id EKSPLISIT: tanpa ini GET /api/pelanggan (id null)
        // salah masuk cabang 'saya' dan daftar pelanggan admin jadi tak terjangkau.
        if ($id === 'masuk') {
            if ($metode !== 'POST') $this->metodeTakDiizinkan();
            $this->masukPembeli();
            return;
        }
        if ($id === 'keluar') {
            if ($metode !== 'POST') $this->metodeTakDiizinkan();
            $this->keluarPembeli();
            return;
        }
        if ($id === 'saya') {
            if ($metode !== 'GET') $this->metodeTakDiizinkan();
            $this->sayaPembeli();
            return;
        }

        switch ($metode) {
            case 'GET':
                Auth::wajib();
                $id === null ? $this->daftar() : $this->satu($id);
                break;
            case 'POST':
                $this->validateCsrf();
                $this->daftarBaru();
                break;
            case 'PUT':
            case 'PATCH':
                Auth::wajib();
                $this->validateCsrf();
                $this->ubah($id);
                break;
            case 'DELETE':
                Auth::wajib();
                $this->validateCsrf();
                $this->hapus($id);
                break;
            default:
                $this->metodeTakDiizinkan();
        }
    }

    // ---------- Sesi pembeli ----------

    private function masukPembeli(): void
    {
        $this->validateCsrf();

        // Rate limit login pembeli per IP (selaras dengan AuthRateLimiter admin).
        $ip = RateLimiter::ip();
        $laju = RateLimiter::check('masuk_pembeli', $ip, 10, 60);
        if ($laju['limited']) {
            header('Retry-After: ' . (int) $laju['retry_after']);
            SecurityLog::catat('rate_limit', 'warn', 'Login pembeli dibatasi.', ['retryAfter' => $laju['retry_after']]);
            Bantu::gagal('Layanan sibuk. Coba lagi nanti.', 429);
        }

        $email = $this->teks('email');
        $sandi = (string) ($this->badan()['sandi'] ?? '');
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Bantu::gagal('Email tidak valid.', 400);
        }
        // Batas panjang wajar (cegah payload besar memicu verifikasi mahal).
        if (strlen($email) > 150 || strlen($sandi) > 72) {
            Bantu::gagal('Email atau kata sandi salah.', 401);
        }
        $hasil = Auth::masukPembeli($email, $sandi);
        if (!$hasil['berhasil']) {
            Bantu::gagal($hasil['pesan'], 401);
        }
        // Login sukses — hapus counter percobaan agar user sah tidak terkunci.
        try {
            @unlink(__DIR__ . '/../../logs/ratelimit/masuk_pembeli_' . hash('sha256', 'masuk_pembeli|' . $ip) . '.json');
        } catch (Throwable $e) {
        }
        Bantu::sukses($hasil['data'], 'Berhasil masuk.');
    }

    private function keluarPembeli(): void
    {
        $this->validateCsrf();
        Auth::keluarPembeli();
        Bantu::sukses(null, 'Berhasil keluar.');
    }

    private function sayaPembeli(): void
    {
        $sesi = Auth::sesiPembeli();
        Bantu::sukses($sesi ? ['pembeli' => $sesi] : null);
    }

    private function petakan(array $r): array
    {
        $r['totalBeli']     = (int) $r['totalBeli'];
        $r['jumlahPesanan'] = (int) $r['jumlahPesanan'];
        unset($r['sandi_hash']);
        return $r;
    }

    private const PILIH = 'SELECT p.id, p.nama, p.username, p.email, p.total_beli AS totalBeli,
        p.jumlah_pesanan AS jumlahPesanan, p.bergabung, p.status
        FROM pelanggan p';

    private function daftar(): void
    {
        $rows = Database::banyak(self::PILIH . ' ORDER BY p.bergabung DESC, p.id DESC');
        Bantu::sukses(array_map(fn($r) => $this->petakan($r), $rows));
    }

    private function satu(string $id): void
    {
        $baris = Database::satu(self::PILIH . ' WHERE p.id = ?', [$id]);
        if (!$baris) Bantu::gagal('Pelanggan tidak ditemukan.', 404);
        Bantu::sukses($this->petakan($baris));
    }

    private function daftarBaru(): void
    {
        // Rate limit pendaftaran publik per IP (cegah spam akun). Admin yang
        // sudah masuk (menambah pelanggan manual) tidak dibatasi.
        if (Auth::sesi() === null) {
            $ip = RateLimiter::ip();
            $laju = RateLimiter::check('daftar_pelanggan', $ip, 5, 300);
            if ($laju['limited']) {
                header('Retry-After: ' . (int) $laju['retry_after']);
                SecurityLog::catat('rate_limit', 'warn', 'Pendaftaran pelanggan dibatasi.', ['retryAfter' => $laju['retry_after']]);
                Bantu::gagal('Terlalu banyak pendaftaran. Coba lagi nanti.', 429);
            }
        }

        $email = Bantu::potong($this->teks('email'), 150);
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Bantu::gagal('Email pelanggan tidak valid.');
        }
        $nama     = Bantu::potong($this->teks('nama'), 120);
        $username = Bantu::potong($this->teks('username'), 60);

        $ada = Database::satu('SELECT id FROM pelanggan WHERE email = ?', [$email]);
        if ($ada) Bantu::gagal('Email sudah terdaftar.');

        // Sandi: bila diisi, wajib memenuhi kebijakan yang sama dengan admin
        // (8-72 karakter). Kosong tetap diizinkan untuk pendaftaran cepat, tetapi
        // akun tanpa sandi tidak dapat login (dicatat di audit).
        $sandi = (string) ($this->badan()['sandi'] ?? '');
        if ($sandi !== '') {
            if (!Bantu::sandiValid($sandi, 8)) {
                Bantu::gagal('Kata sandi minimal 8 karakter.');
            }
            if (strlen($sandi) > 72) {
                Bantu::gagal('Kata sandi maksimal 72 karakter.');
            }
        }
        $hash = $sandi !== '' ? Auth::hash($sandi) : null;

        $id = Bantu::idBaru('pel');
        Database::eksekusi(
            'INSERT INTO pelanggan (id, nama, username, email, sandi_hash) VALUES (?,?,?,?,?)',
            [$id, $nama, $username, $email, $hash]
        );

        Aktivitas::audit('daftar_pelanggan', 'pelanggan', $id, 'Berhasil', [
            'nama' => $nama,
            'email' => $email,
            'tanpaSandi' => $hash === null,
        ], "Pelanggan \"{$nama}\" mendaftar");
        Bantu::sukses(['id' => $id, 'nama' => $nama, 'email' => $email], 'Pendaftaran berhasil.', 201);
    }

    private function ubah(?string $id): void
    {
        if (!$id) Bantu::gagal('ID pelanggan wajib ada.', 400);
        $lama = Database::satu('SELECT id, nama FROM pelanggan WHERE id = ?', [$id]);
        if (!$lama) Bantu::gagal('Pelanggan tidak ditemukan.', 404);

        $status = $this->salahDari($this->teks('status', 'Aktif'), ['Aktif', 'Nonaktif'], 'Aktif');
        $nama   = Bantu::potong($this->teks('nama', $lama['nama']), 120);

        Database::eksekusi('UPDATE pelanggan SET nama=?, status=? WHERE id=?', [$nama, $status, $id]);
        Aktivitas::audit('ubah_pelanggan', 'pelanggan', $id, 'Berhasil', [
            'nama' => $nama,
            'status' => $status,
        ], "Pelanggan \"{$nama}\" diperbarui");
        Bantu::sukses(['id' => $id], 'Pelanggan diperbarui.');
    }

    private function hapus(?string $id): void
    {
        if (!$id) Bantu::gagal('ID pelanggan wajib ada.', 400);
        $baris = Database::satu('SELECT id, nama FROM pelanggan WHERE id = ?', [$id]);
        if (!$baris) Bantu::gagal('Pelanggan tidak ditemukan.', 404);
        Database::eksekusi('DELETE FROM pelanggan WHERE id = ?', [$id]);
        Aktivitas::audit('hapus_pelanggan', 'pelanggan', $id, 'Berhasil', [
            'nama' => $baris['nama'],
        ], "Pelanggan \"{$baris['nama']}\" dihapus");
        Bantu::sukses(['id' => $id], 'Pelanggan dihapus.');
    }
}
