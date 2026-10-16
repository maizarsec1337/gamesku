<?php
// CRUD pelanggan; totalBeli & jumlahPesanan dihitung dari tabel pesanan.

class PengendaliPelanggan extends PengendaliDasar
{
    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
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
        $email = Bantu::potong($this->teks('email'), 150);
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Bantu::gagal('Email pelanggan tidak valid.');
        }
        $nama     = Bantu::potong($this->teks('nama'), 120);
        $username = Bantu::potong($this->teks('username'), 60);

        $ada = Database::satu('SELECT id FROM pelanggan WHERE email = ?', [$email]);
        if ($ada) Bantu::gagal('Email sudah terdaftar.');

        // Sandi opsional (pendaftaran cepat tanpa sandi).
        $sandi = (string) ($this->badan()['sandi'] ?? '');
        $hash = $sandi !== '' ? Auth::hash($sandi) : null;

        $id = Bantu::idBaru('pel');
        Database::eksekusi(
            'INSERT INTO pelanggan (id, nama, username, email, sandi_hash) VALUES (?,?,?,?,?)',
            [$id, $nama, $username, $email, $hash]
        );

        Aktivitas::catat("Pelanggan \"{$nama}\" mendaftar", 'pelanggan', 'biru');
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
        Aktivitas::catat("Pelanggan \"{$nama}\" diperbarui", 'edit', 'biru');
        Bantu::sukses(['id' => $id], 'Pelanggan diperbarui.');
    }

    private function hapus(?string $id): void
    {
        if (!$id) Bantu::gagal('ID pelanggan wajib ada.', 400);
        $baris = Database::satu('SELECT id, nama FROM pelanggan WHERE id = ?', [$id]);
        if (!$baris) Bantu::gagal('Pelanggan tidak ditemukan.', 404);
        Database::eksekusi('DELETE FROM pelanggan WHERE id = ?', [$id]);
        Aktivitas::catat("Pelanggan \"{$baris['nama']}\" dihapus", 'hapus', 'merah');
        Bantu::sukses(['id' => $id], 'Pelanggan dihapus.');
    }
}
