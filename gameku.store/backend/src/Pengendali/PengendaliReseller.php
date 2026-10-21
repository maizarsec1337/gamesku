<?php
// Pengajuan reseller oleh pelanggan + panel admin Super Admin.
// Route: GET /reseller/saya (pembeli); /reseller (POST=pengajuan, GET=list admin),
// /reseller/{id} (GET detail), /reseller/{id}/status (PUT), /reseller/{id}/batal (POST).
//
// Keamanan: identitas (pelanggan_id) dari sesi pembeli, bukan request (cegah IDOR);
// aksi admin pakai Auth::wajibPeran('superadmin'); constraint UNIQUE(pelanggan_id,aktif)
// cegah pengajuan pending/approved ganda; transaksi + prepared statement; tidak
// pernah return stack trace/error internal.

class PengendaliReseller extends PengendaliDasar
{
    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        if ($id === 'saya') {
            if ($metode !== 'GET') $this->metodeTakDiizinkan();
            $this->saya();
            return;
        }

        if ($id === null) {
            switch (strtoupper($metode)) {
                case 'GET':  $this->daftar(); break;
                case 'POST': $this->buat(); break;
                default: $this->metodeTakDiizinkan();
            }
            return;
        }

        switch (strtolower((string) $sub)) {
            case 'status':
                if ($metode !== 'PUT' && $metode !== 'PATCH') $this->metodeTakDiizinkan();
                $this->ubahStatus($id);
                break;
            case 'batal':
                if ($metode !== 'POST') $this->metodeTakDiizinkan();
                $this->batal($id);
                break;
            default:
                if ($metode !== 'GET') $this->metodeTakDiizinkan();
                $this->satu($id);
        }
    }

    // ---------- Pembeli ----------

    // Identitas pembeli dari sesi (401 bila belum login). Mengembalikan sesi pembeli.
    private function identitasPembeli(): array
    {
        $sesi = Auth::sesiPembeli();
        if (!$sesi) {
            SecurityLog::catat('akses_ditolak', 'warn', 'Endpoint reseller diakses tanpa sesi pembeli.', [
                'path' => (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH),
            ]);
            Bantu::gagal('Perlu masuk terlebih dahulu.', 401);
        }
        return $sesi;
    }

    // GET /api/reseller/saya — satu pengajuan terbaru milik pembeli yang login.
    public function saya(): void
    {
        $sesi = $this->identitasPembeli();
        $baris = Database::satu(
            'SELECT id, status, alasan_penolakan, dibuat_pada, diperbarui_pada
             FROM reseller_pengajuan
             WHERE pelanggan_id = ?
             ORDER BY dibuat_pada DESC, id DESC LIMIT 1',
            [$sesi['id']]
        );
        Bantu::sukses($baris ? $this->petakan($baris) : null);
    }

    // POST /api/reseller — ajukan. Identitas & profil diambil dari DB via sesi.
    public function buat(): void
    {
        $sesi = $this->identitasPembeli();
        $this->validateCsrf();

        $ip = RateLimiter::ip();
        $laju = RateLimiter::check('daftar_reseller', $sesi['id'] . '|' . $ip, 5, 300);
        if ($laju['limited']) {
            header('Retry-After: ' . (int) $laju['retry_after']);
            Bantu::gagal('Anda sudah mengirimkan banyak pengajuan. Coba lagi nanti.', 429);
        }

        $whatsapp = Bantu::potong(trim((string) ($this->teks('whatsapp', ''))), 40);
        if ($whatsapp === '') {
            Bantu::gagal('Nomor WhatsApp wajib diisi.', 422);
        }
        if (!preg_match('/^\+?[0-9]{8,20}$/', $whatsapp)) {
            Bantu::gagal('Nomor WhatsApp tidak valid.', 422);
        }
        $catatan = Bantu::potong(trim((string) ($this->teks('catatan', ''))), 500);

        // Profil pelanggan dari DB (bukan dari request) — nama/email/username tak bisa ditipu.
        $p = Database::satu('SELECT id, nama, email, username FROM pelanggan WHERE id = ? LIMIT 1', [$sesi['id']]);
        if (!$p) {
            Bantu::gagal('Akun pelanggan tidak ditemukan.', 404);
        }

        try {
            Database::eksekusi('START TRANSACTION');
            // Unique constraint (pelanggan_id, aktif) menolak duplikat pending/approved.
            $id = Bantu::idBaru('res');
            Database::eksekusi(
                'INSERT INTO reseller_pengajuan
                  (id, pelanggan_id, nama, email, username, whatsapp, catatan, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, \'pending\')',
                [$id, $sesi['id'], $p['nama'], $p['email'], $p['username'], $whatsapp, $catatan]
            );
            Aktivitas::audit('ajukan_reseller', 'reseller_pengajuan', $id, 'Berhasil', [
                'pelanggan_id' => $sesi['id'],
                'whatsapp'     => $whatsapp !== '' ? 'ada' : '',
            ], 'Pengajuan reseller dikirim');
            Database::eksekusi('COMMIT');
            Bantu::sukses($this->dataById($id), 'Pengajuan reseller terkirim. Menunggu persetujuan.', 201);
        } catch (Throwable $e) {
            Database::eksekusi('ROLLBACK');
            if ($this->adalahDuplikat($e)) {
                Bantu::gagal('Anda sudah memiliki pengajuan yang sedang diproses atau sudah disetujui.', 409);
            }
            SecurityLog::catat('server_error', 'error', 'Gagal mengajukan reseller.', [
                'pesan' => Bantu::potong($e->getMessage(), 300),
            ]);
            Bantu::gagal('Gagal mengirimkan pengajuan.', 500);
        }
    }

    // POST /api/reseller/{id}/batal — pembatalan sendiri (status pending saja).
    public function batal(string $id): void
    {
        $sesi = $this->identitasPembeli();
        $this->validateCsrf();

        $baris = Database::satu(
            'SELECT status FROM reseller_pengajuan WHERE id = ? AND pelanggan_id = ? LIMIT 1',
            [$id, $sesi['id']]
        );
        if (!$baris) {
            Bantu::gagal('Pengajuan tidak ditemukan.', 404);
        }
        if (($baris['status'] ?? '') !== 'pending') {
            Bantu::gagal('Pengajuan yang sudah diproses tidak dapat dibatalkan.', 409);
        }

        try {
            Database::eksekusi('START TRANSACTION');
            Database::eksekusi(
                'UPDATE reseller_pengajuan SET status = \'rejected\', alasan_penolakan = ?
                 WHERE id = ? AND pelanggan_id = ?',
                ['Dibatalkan oleh pembeli.', $id, $sesi['id']]
            );
            Aktivitas::audit('batal_reseller', 'reseller_pengajuan', $id, 'Berhasil', [
                'pelanggan_id' => $sesi['id'],
            ], 'Pengajuan reseller dibatalkan');
            Database::eksekusi('COMMIT');
            Bantu::sukses(['id' => $id, 'status' => 'rejected'], 'Pengajuan dibatalkan.');
        } catch (Throwable $e) {
            Database::eksekusi('ROLLBACK');
            Bantu::gagal('Gagal membatalkan pengajuan.', 500);
        }
    }

    // ---------- Admin (Super Admin) ----------

    public function daftar(): void
    {
        Auth::wajibPeran('superadmin'); // 401/403 otomatis bila bukan superadmin.

        $hal    = max(1, (int) round((float) str_replace(',', '.', (string) ($_GET['halaman'] ?? ''))));
        $cari   = Bantu::potong(trim((string) ($_GET['cari'] ?? '')), 120);
        $status = strtolower((string) ($_GET['status'] ?? ''));
        if (!in_array($status, ['pending', 'approved', 'rejected', ''], true)) {
            $status = '';
        }

        $batas  = 20;
        $offset = ($hal - 1) * $batas;

        $sql   = 'SELECT r.id, r.pelanggan_id, r.admin_id, r.nama, r.email, r.username,
                         r.whatsapp, r.catatan, r.status, r.alasan_penolakan, r.dibuat_pada,
                        r.diperbarui_pada AS diperbarui_pada, a.nama AS admin_nama
                  FROM reseller_pengajuan r
                  LEFT JOIN admin a ON a.id = r.admin_id';
        $where = [];
        $param = [];
        if ($status !== '') {
            $where[] = 'r.status = ?';
            $param[] = $status;
        }
        if ($cari !== '') {
            $where[] = '(r.nama LIKE ? OR r.email LIKE ? OR r.username LIKE ?)';
            $param[] = '%' . $cari . '%';
            $param[] = '%' . $cari . '%';
            $param[] = '%' . $cari . '%';
        }
        $sql .= ($where ? ' WHERE ' . implode(' AND ', $where) : '')
              . ' ORDER BY r.dibuat_pada DESC, r.id DESC LIMIT ' . (int) $offset . ', ' . (int) $batas;

        $rows   = Database::banyak($sql, $param);
        $jumlah = (int) Database::satu(
            'SELECT COUNT(*) AS c FROM reseller_pengajuan r'
            . ($where ? ' WHERE ' . implode(' AND ', $where) : ''),
            $param
        )['c'];

        Bantu::sukses([
            'data'    => array_map([$this, 'petakan'], $rows),
            'jumlah'  => $jumlah,
            'halaman' => $hal,
            'batas'   => $batas,
            'offset'  => $offset,
        ]);
    }

    public function satu(string $id): void
    {
        Auth::wajibPeran('superadmin');
        $r = $this->cariId($id);
        if (!$r) Bantu::gagal('Pengajuan reseller tidak ditemukan.', 404);
        Bantu::sukses($this->petakan($r));
    }

    // PUT /api/reseller/{id}/status — setujui/tolak (hanya superadmin).
    public function ubahStatus(string $id): void
    {
        Auth::wajibPeran('superadmin');
        $this->validateCsrf();
        $admin = Auth::sesi();

        $statusBaru = strtolower((string) ($this->teks('status', '')));
        if (!in_array($statusBaru, ['approved', 'rejected'], true)) {
            Bantu::gagal('Status tidak valid. Pakai "approved" atau "rejected".', 422);
        }
        $alasan = Bantu::potong(trim((string) ($this->teks('alasan_penolakan', ''))), 500);
        if ($statusBaru === 'rejected' && $alasan === '') {
            Bantu::gagal('Alasan penolakan wajib diisi.', 422);
        }

        try {
            Database::eksekusi('START TRANSACTION');
            $lama = Database::satu(
                'SELECT id, status, pelanggan_id FROM reseller_pengajuan WHERE id = ? LIMIT 1 FOR UPDATE',
                [$id]
            );
            if (!$lama) {
                Database::eksekusi('ROLLBACK');
                Bantu::gagal('Pengajuan reseller tidak ditemukan.', 404);
            }

            Database::eksekusi(
                'UPDATE reseller_pengajuan SET status = ?, alasan_penolakan = ?, admin_id = ? WHERE id = ?',
                [$statusBaru, $alasan, (int) $admin['id'], $id]
            );
            Aktivitas::audit('ubah_status_reseller', 'reseller_pengajuan', $id, 'Berhasil', [
                'dari'     => $lama['status'],
                'ke'       => $statusBaru,
                'admin_id' => (int) $admin['id'],
            ], 'Status reseller diubah ' . $lama['status'] . ' -> ' . $statusBaru);
            Database::eksekusi('COMMIT');

            // Status reseller PELANGGAN = status approved pada pengajuannya.
            // Akses reseller di-frontend ditentukan backend lewat GET /api/reseller/saya,
            // bukan dari flag yang bisa di-set browser.
            Bantu::sukses($this->dataById($id), 'Status pengajuan diperbarui.');
        } catch (Throwable $e) {
            Database::eksekusi('ROLLBACK');
            SecurityLog::catat('server_error', 'error', 'Gagal mengubah status reseller.', ['pesan' => Bantu::potong($e->getMessage(), 300)]);
            Bantu::gagal('Gagal memperbarui status.', 500);
        }
    }

    // ---------- Query internal ----------

    private function cariId(string $id): ?array
    {
        return Database::satu(
            'SELECT r.id, r.pelanggan_id, r.admin_id, r.nama, r.email, r.username,
                    r.whatsapp, r.catatan, r.status, r.alasan_penolakan, r.dibuat_pada,
                    r.diperbarui_pada AS diperbarui_pada, a.nama AS admin_nama
             FROM reseller_pengajuan r
             LEFT JOIN admin a ON a.id = r.admin_id
             WHERE r.id = ? LIMIT 1',
            [$id]
        );
    }

    private function dataById(string $id): ?array
    {
        return $this->petakan($this->cariId($id));
    }

    // Deteksi error duplicate key (constraint aktif) untuk respon 409 yang tepat.
    private function adalahDuplikat(Throwable $e): bool
    {
        $msg = $e->getMessage();
        return (str_contains($msg, "uniq_reseller_pelanggan_aktif")
            || str_contains($msg, 'Duplicate entry')
            || $e instanceof PDOException && str_contains($msg, '23000'));
    }

    // ---------- Output ----------

    private function petakan(?array $r): ?array
    {
        if (!$r) return null;
        return [
            'id'               => (string) ($r['id'] ?? ''),
            'pelanggan_id'     => (string) ($r['pelanggan_id'] ?? ''),
            'admin_nama'       => $r['admin_nama'] ?? null,
            'nama'             => (string) ($r['nama'] ?? ''),
            'email'            => (string) ($r['email'] ?? ''),
            'username'         => (string) ($r['username'] ?? ''),
            'whatsapp'         => (string) ($r['whatsapp'] ?? ''),
            'catatan'          => (string) ($r['catatan'] ?? ''),
            'status'           => (string) ($r['status'] ?? 'pending'),
            'alasan_penolakan' => (string) ($r['alasan_penolakan'] ?? ''),
            'dibuat_pada'      => $r['dibuat_pada'] ?? null,
            'diperbarui_pada'  => $r['diperbarui_pada'] ?? null,
        ];
    }
}
