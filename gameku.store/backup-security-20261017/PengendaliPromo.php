<?php
// CRUD promo; status dihitung ulang dari tanggal (mulai/berakhir) tiap dibaca.

class PengendaliPromo extends PengendaliDasar
{
    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        if ($metode === 'GET' && $id === 'cek') {
            $this->cek();
            return;
        }
        switch ($metode) {
            case 'GET':
                $id === null ? $this->daftar() : $this->satu($id);
                break;
            case 'POST':
                Auth::wajib();
                $this->validateCsrf();
                $this->simpan();
                break;
            case 'PUT':
            case 'PATCH':
                Auth::wajib();
                $this->validateCsrf();
                $this->simpan($id);
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

    private function statusDari(?string $mulai, ?string $berakhir): string
    {
        if ($mulai && $berakhir) {
            $hariIni = Bantu::hariIni();
            if ($hariIni < $mulai) return 'Terjadwal';
            if ($hariIni > $berakhir) return 'Berakhir';
            return 'Aktif';
        }
        return 'Terjadwal';
    }

    private function petakan(array $r): array
    {
        $r['diskon']   = (int) $r['diskon'];
        $r['batas']    = (int) $r['batas'];
        $r['terpakai'] = (int) $r['terpakai'];
        $r['status']   = $this->statusDari($r['mulai'], $r['berakhir']);
        return $r;
    }

    private function daftar(): void
    {
        $rows = Database::banyak(
            'SELECT id, kode, nama, diskon, mulai, berakhir, batas, terpakai, status, dibuat_pada AS dibuatPada
             FROM promo ORDER BY dibuat_pada DESC, id DESC'
        );
        $hasil = array_map(fn($r) => $this->petakan($r), $rows);
        if (Auth::sesi() === null) {
            $hasil = array_values(array_filter($hasil, fn($r) => $r['status'] === 'Aktif'));
        }
        Bantu::sukses($hasil);
    }

    private function satu(string $id): void
    {
        $baris = Database::satu(
            'SELECT id, kode, nama, diskon, mulai, berakhir, batas, terpakai, status, dibuat_pada AS dibuatPada
             FROM promo WHERE id = ?',
            [$id]
        );
        if (!$baris) Bantu::gagal('Promo tidak ditemukan.', 404);
        Bantu::sukses($this->petakan($baris));
    }

    private function cek(): void
    {
        $kode = strtoupper(Bantu::teks('kode'));
        if ($kode === '') Bantu::gagal('Kode promo wajib diisi.');
        $baris = Database::satu(
            'SELECT id, kode, nama, diskon, mulai, berakhir, batas, terpakai, status FROM promo WHERE kode = ?',
            [$kode]
        );
        if (!$baris) Bantu::gagal("Kode \"{$kode}\" tidak dikenali.", 404);
        $promo = $this->petakan($baris);
        $berlaku = $promo['status'] === 'Aktif' && $promo['terpakai'] < $promo['batas'];
        Bantu::sukses(['promo' => $promo, 'berlaku' => $berlaku]);
    }

    private function simpan(?string $id = null): void
    {
        $kode = strtoupper(Bantu::potong($this->teks('kode'), 40));
        $nama = Bantu::potong($this->teks('nama'), 120);
        if ($kode === '') Bantu::gagal('Kode promo wajib diisi.');
        if ($nama === '') Bantu::gagal('Nama promo wajib diisi.');

        $diskon   = min(100, max(0, $this->angka('diskon', 0)));
        $batas    = max(1, $this->angka('batas', 100));
        $mulai    = $this->teks('mulai') ?: null;
        $berakhir = $this->teks('berakhir') ?: null;
        $status   = $this->statusDari($mulai, $berakhir);

        if ($id) {
            $lama = Database::satu('SELECT id, nama FROM promo WHERE id = ?', [$id]);
            if (!$lama) Bantu::gagal('Promo tidak ditemukan.', 404);
            $bentrok = Database::satu('SELECT id FROM promo WHERE kode = ? AND id <> ?', [$kode, $id]);
            if ($bentrok) Bantu::gagal("Kode \"{$kode}\" sudah dipakai.");
            Database::eksekusi(
                'UPDATE promo SET kode=?, nama=?, diskon=?, mulai=?, berakhir=?, batas=?, status=? WHERE id=?',
                [$kode, $nama, $diskon, $mulai, $berakhir, $batas, $status, $id]
            );
            Aktivitas::catat("Promo \"{$nama}\" diperbarui", 'promo', 'biru');
            Bantu::sukses(['id' => $id, 'kode' => $kode, 'nama' => $nama], 'Promo diperbarui.');
        }

        $bentrok = Database::satu('SELECT id FROM promo WHERE kode = ?', [$kode]);
        if ($bentrok) Bantu::gagal("Kode \"{$kode}\" sudah dipakai.");

        $idBaru = Bantu::idBaru('prm');
        Database::eksekusi(
            'INSERT INTO promo (id, kode, nama, diskon, mulai, berakhir, batas, status) VALUES (?,?,?,?,?,?,?,?)',
            [$idBaru, $kode, $nama, $diskon, $mulai, $berakhir, $batas, $status]
        );
        Aktivitas::catat("Promo \"{$nama}\" dibuat", 'promo', 'hijau');
        Bantu::sukses(['id' => $idBaru, 'kode' => $kode, 'nama' => $nama], 'Promo dibuat.', 201);
    }

    private function hapus(?string $id): void
    {
        if (!$id) Bantu::gagal('ID promo wajib ada.', 400);
        $baris = Database::satu('SELECT id, nama FROM promo WHERE id = ?', [$id]);
        if (!$baris) Bantu::gagal('Promo tidak ditemukan.', 404);
        Database::eksekusi('DELETE FROM promo WHERE id = ?', [$id]);
        Aktivitas::catat("Promo \"{$baris['nama']}\" dihapus", 'hapus', 'merah');
        Bantu::sukses(['id' => $id], 'Promo dihapus.');
    }
}

