<?php
// CRUD creator: daftar, tambah (publik/pendaftaran), ubah status, hapus.

class PengendaliCreator extends PengendaliDasar
{
    private const STATUS = ['Aktif', 'Review', 'Ditangguhkan'];

    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        switch ($metode) {
            case 'GET':
                Auth::wajib();
                $id === null ? $this->daftar() : $this->satu($id);
                break;
            case 'POST':
                $this->validateCsrf();
                $this->tambah();
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
        $r['produk']    = (int) $r['produk'];
        $r['penjualan'] = (int) $r['penjualan'];
        $r['pendapatan']= (int) $r['pendapatan'];
        return $r;
    }

    private function daftar(): void
    {
        $rows = Database::banyak(
            'SELECT id, nama, username, produk, penjualan, pendapatan, bergabung, status
             FROM creator ORDER BY bergabung DESC, id DESC'
        );
        Bantu::sukses(array_map(fn($r) => $this->petakan($r), $rows));
    }

    private function satu(string $id): void
    {
        $baris = Database::satu(
            'SELECT id, nama, username, produk, penjualan, pendapatan, bergabung, status
             FROM creator WHERE id = ?',
            [$id]
        );
        if (!$baris) Bantu::gagal('Creator tidak ditemukan.', 404);
        Bantu::sukses($this->petakan($baris));
    }

    private function tambah(): void
    {
        $nama = Bantu::potong($this->teks('nama'), 120);
        if ($nama === '') Bantu::gagal('Nama creator wajib diisi.');

        $ada = Database::satu('SELECT id FROM creator WHERE nama = ?', [$nama]);
        if ($ada) Bantu::gagal("Creator \"{$nama}\" sudah terdaftar.");

        $username = Bantu::potong($this->teks('username'), 60);
        $id = Bantu::idBaru('cr');
        Database::eksekusi(
            'INSERT INTO creator (id, nama, username, status) VALUES (?,?,?,?)',
            [$id, $nama, $username, 'Review']
        );
        Aktivitas::audit('daftar_creator', 'creator', $id, 'Berhasil', [
            'nama' => $nama,
            'username' => $username,
            'status' => 'Review',
        ], "Creator \"{$nama}\" mendaftar");
        Bantu::sukses(['id' => $id, 'nama' => $nama, 'status' => 'Review'], 'Pendaftaran creator berhasil.', 201);
    }

    private function ubah(?string $id): void
    {
        if (!$id) Bantu::gagal('ID creator wajib ada.', 400);
        $lama = Database::satu('SELECT id, nama FROM creator WHERE id = ?', [$id]);
        if (!$lama) Bantu::gagal('Creator tidak ditemukan.', 404);

        $status = $this->salahDari($this->teks('status', 'Review'), self::STATUS, 'Review');
        Database::eksekusi('UPDATE creator SET status=? WHERE id=?', [$status, $id]);
        Aktivitas::audit('ubah_status_creator', 'creator', $id, 'Berhasil', [
            'nama' => $lama['nama'],
            'statusLama' => $lama['status'] ?? '',
            'statusBaru' => $status,
        ], "Status creator \"{$lama['nama']}\" diubah ke {$status}");
        Bantu::sukses(['id' => $id, 'status' => $status], 'Status creator diperbarui.');
    }

    private function hapus(?string $id): void
    {
        if (!$id) Bantu::gagal('ID creator wajib ada.', 400);
        $baris = Database::satu('SELECT id, nama FROM creator WHERE id = ?', [$id]);
        if (!$baris) Bantu::gagal('Creator tidak ditemukan.', 404);
        Database::eksekusi('DELETE FROM creator WHERE id = ?', [$id]);
        Aktivitas::audit('hapus_creator', 'creator', $id, 'Berhasil', [
            'nama' => $baris['nama'],
        ], "Creator \"{$baris['nama']}\" dihapus");
        Bantu::sukses(['id' => $id], 'Creator dihapus.');
    }
}
