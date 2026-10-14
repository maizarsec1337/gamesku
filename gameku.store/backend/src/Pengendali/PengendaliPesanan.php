<?php
// Pesanan + item; semua angka checkout dihitung server dari harga di DB.

class PengendaliPesanan extends PengendaliDasar
{
    private const STATUS = ['Menunggu', 'Diproses', 'Berhasil', 'Gagal'];
    private const BIAYA_LAYANAN = 1000;

    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        switch ($metode) {
            case 'POST':
                $this->validateCsrf();
                $this->checkout();
                break;
            case 'GET':
                Auth::wajib();
                $id === null ? $this->daftar() : $this->satu($id);
                break;
            case 'PUT':
            case 'PATCH':
                Auth::wajib();
                $this->validateCsrf();
                $this->ubahStatus($id);
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
        return [
            'id'           => $r['id'],
            'pelangganId'  => $r['pelangganId'],
            'pelanggan'    => $r['pelanggan'],
            'email'        => $r['email'],
            'whatsapp'     => $r['whatsapp'],
            'produk'       => $r['produk'],
            'kategori'     => $r['kategori'],
            'metode'       => $r['metode'],
            'subtotal'     => (int) $r['subtotal'],
            'biayaLayanan' => (int) $r['biayaLayanan'],
            'potongan'     => (int) $r['potongan'],
            'total'        => (int) $r['total'],
            'promo'        => $r['promo'],
            'status'       => $r['status'],
            'catatan'      => $r['catatan'],
            'dibuatPada'   => $r['dibuatPada'],
            'diperbaruiPada' => $r['diperbaruiPada'],
        ];
    }

    private const PILIH = 'SELECT id, pelanggan_id AS pelangganId, pelanggan_nama AS pelanggan, email, whatsapp,
        produk_ringkas AS produk, kategori, metode, subtotal, biaya_layanan AS biayaLayanan, potongan, total,
        kode_promo AS promo, status, catatan, dibuat_pada AS dibuatPada, diperbarui_pada AS diperbaruiPada
        FROM pesanan';

    private function daftar(): void
    {
        $where = [];
        $param = [];

        $status = Bantu::teks('status');
        if ($status !== '' && in_array($status, self::STATUS, true)) {
            $where[] = 'status = ?';
            $param[] = $status;
        }
        $cari = Bantu::teks('cari');
        if ($cari !== '') {
            $where[] = '(id LIKE ? OR pelanggan_nama LIKE ? OR produk_ringkas LIKE ?)';
            $like = '%' . $cari . '%';
            array_push($param, $like, $like, $like);
        }

        $sql = self::PILIH;
        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        $sql .= ' ORDER BY dibuat_pada DESC, id DESC LIMIT 500';

        Bantu::sukses(array_map(fn($r) => $this->petakan($r), Database::banyak($sql, $param)));
    }

    private function satu(string $id): void
    {
        $baris = Database::satu(self::PILIH . ' WHERE id = ?', [$id]);
        if (!$baris) Bantu::gagal('Pesanan tidak ditemukan.', 404);

        $item = Database::banyak(
            'SELECT produk_id AS produkId, nama, harga, jumlah, subtotal
             FROM pesanan_item WHERE pesanan_id = ? ORDER BY id ASC',
            [$id]
        );
        $hasil = $this->petakan($baris);
        $hasil['item'] = $item;
        Bantu::sukses($hasil);
    }

    // Checkout publik: hitung ulang dari harga di DB (bukan dari klien).
    // Terima: item[{produkId?,nama?,harga?,jumlah}], kodePromo?, pembeli{}, metode?.
    private function checkout(): void
    {
        $badan = $this->badan();
        $itemMasuk = $badan['item'] ?? [];
        if (!is_array($itemMasuk) || $itemMasuk === []) {
            Bantu::gagal('Keranjang kosong.');
        }

        // Bangun ulang baris item dari harga produk di DB.
        $barisItem = [];
        $subtotal = 0;
        $namaRingkas = [];
        $kategoriPertama = '';

        foreach ($itemMasuk as $it) {
            if (!is_array($it)) continue;
            $jumlah = max(1, min(10, (int) round((float) ($it['jumlah'] ?? 1))));
            $produkId = isset($it['produkId']) ? (string) $it['produkId'] : '';
            $nama = Bantu::potong((string) ($it['nama'] ?? ''), 160);

            $harga = 0;
            if ($produkId !== '') {
                $p = Database::satu('SELECT id, nama, harga, kategori_id FROM produk WHERE id = ?', [$produkId]);
                if ($p) {
                    $harga = (int) $p['harga'];
                    $nama = $p['nama'];
                    if ($kategoriPertama === '' && $p['kategori_id']) {
                        $kat = Database::satu('SELECT nama FROM kategori WHERE id = ?', [$p['kategori_id']]);
                        $kategoriPertama = $kat['nama'] ?? '';
                    }
                }
            } else {
                $harga = max(0, (int) round((float) ($it['harga'] ?? 0)));
            }

            $subBaris = $harga * $jumlah;
            $subtotal += $subBaris;
            $namaRingkas[] = $nama;
            $barisItem[] = [
                'produk_id' => $produkId !== '' ? $produkId : null,
                'nama'      => $nama,
                'harga'     => $harga,
                'jumlah'    => $jumlah,
                'subtotal'  => $subBaris,
            ];
        }

        if ($barisItem === []) Bantu::gagal('Item keranjang tidak valid.');

        // Potongan promo (bila berlaku).
        $kodePromo = strtoupper(Bantu::potong((string) ($badan['kodePromo'] ?? ''), 40));
        $potongan = 0;
        $promoDipakai = null;
        if ($kodePromo !== '' && $subtotal > 0) {
            $promo = Database::satu(
                "SELECT id, kode, diskon, batas, terpakai FROM promo WHERE kode = ? AND status = 'Aktif'",
                [$kodePromo]
            );
            if ($promo && (int) $promo['terpakai'] < (int) $promo['batas']) {
                $diskon = (int) $promo['diskon'];
                // Diskon 0 => gratis biaya layanan; jika ada %, batas Rp50.000.
                $potongan = $diskon === 0
                    ? self::BIAYA_LAYANAN
                    : min((int) round($subtotal * $diskon / 100), 50000);
                $promoDipakai = $promo;
            }
        }

        $biayaLayanan = self::BIAYA_LAYANAN;
        $total = max($subtotal + $biayaLayanan - $potongan, 0);

        // Data pembeli.
        $pembeli = is_array($badan['pembeli'] ?? null) ? $badan['pembeli'] : [];
        $namaPembeli = Bantu::potong((string) ($pembeli['nama'] ?? ($badan['nama'] ?? '')), 120);
        $email       = Bantu::potong((string) ($pembeli['email'] ?? ''), 150);
        $whatsapp    = Bantu::potong((string) ($pembeli['whatsapp'] ?? ''), 40);
        $metode      = Bantu::potong((string) ($badan['metode'] ?? ''), 60);
        $produkRingkas = Bantu::potong(implode(', ', array_unique($namaRingkas)), 255);

        // Nomor pesanan unik.
        $nomor = Bantu::nomorPesanan();
        while (Database::satu('SELECT id FROM pesanan WHERE id = ?', [$nomor])) {
            $nomor = Bantu::nomorPesanan();
        }

        $hasil = $this->simpanPesanan(
            $nomor, $namaPembeli, $email, $whatsapp, $metode, $produkRingkas, $kategoriPertama,
            $subtotal, $biayaLayanan, $potongan, $total, $kodePromo, $barisItem, $promoDipakai
        );

        Aktivitas::catat("Pesanan {$nomor} dibuat" . ($namaPembeli ? " oleh {$namaPembeli}" : ''), 'pesanan', 'hijau');
        Bantu::sukses($hasil, 'Pesanan dibuat.', 201);
    }

    // Simpan pesanan + item + efek samping (pelanggan, promo) dalam transaksi.
    private function simpanPesanan(
        string $nomor, string $namaPembeli, string $email, string $whatsapp, string $metode,
        string $produkRingkas, string $kategori, int $subtotal, int $biayaLayanan, int $potongan,
        int $total, string $kodePromo, array $barisItem, ?array $promoDipakai
    ): array {
        return Database::transaksi(function () use (
            $nomor, $namaPembeli, $email, $whatsapp, $metode, $produkRingkas, $kategori,
            $subtotal, $biayaLayanan, $potongan, $total, $kodePromo, $barisItem, $promoDipakai
        ) {
            // Cari/buat pelanggan berdasarkan email.
            $pelangganId = null;
            if ($email !== '') {
                $pel = Database::satu('SELECT id FROM pelanggan WHERE email = ?', [$email]);
                if ($pel) {
                    $pelangganId = $pel['id'];
                } else {
                    $pelangganId = Bantu::idBaru('pel');
                    Database::eksekusi('INSERT INTO pelanggan (id, nama, email) VALUES (?,?,?)',
                        [$pelangganId, $namaPembeli, $email]);
                }
            }

            Database::eksekusi(
                'INSERT INTO pesanan (id, pelanggan_id, pelanggan_nama, email, whatsapp, produk_ringkas,
                    kategori, metode, subtotal, biaya_layanan, potongan, total, kode_promo, status)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                [$nomor, $pelangganId, $namaPembeli, $email, $whatsapp, $produkRingkas,
                 $kategori, $metode, $subtotal, $biayaLayanan, $potongan, $total, $kodePromo, 'Menunggu']
            );

            foreach ($barisItem as $b) {
                Database::eksekusi(
                    'INSERT INTO pesanan_item (pesanan_id, produk_id, nama, harga, jumlah, subtotal)
                     VALUES (?,?,?,?,?,?)',
                    [$nomor, $b['produk_id'], $b['nama'], $b['harga'], $b['jumlah'], $b['subtotal']]
                );
            }

            if ($promoDipakai) {
                Database::eksekusi('UPDATE promo SET terpakai = terpakai + 1 WHERE id = ?', [$promoDipakai['id']]);
            }
            if ($pelangganId) {
                Database::eksekusi(
                    'UPDATE pelanggan SET jumlah_pesanan = jumlah_pesanan + 1, total_beli = total_beli + ? WHERE id = ?',
                    [$total, $pelangganId]
                );
            }

            return [
                'id' => $nomor, 'subtotal' => $subtotal, 'biayaLayanan' => $biayaLayanan,
                'potongan' => $potongan, 'total' => $total, 'status' => 'Menunggu',
            ];
        });
    }

    private function ubahStatus(?string $id): void
    {
        if (!$id) Bantu::gagal('ID pesanan wajib ada.', 400);
        $lama = Database::satu('SELECT id, status FROM pesanan WHERE id = ?', [$id]);
        if (!$lama) Bantu::gagal('Pesanan tidak ditemukan.', 404);

        $status = $this->salahDari($this->teks('status', $lama['status']), self::STATUS, $lama['status']);
        Database::eksekusi('UPDATE pesanan SET status=?, diperbarui_pada=NOW() WHERE id=?', [$status, $id]);
        Aktivitas::catat("Status pesanan {$id} diubah ke {$status}", 'label', 'biru');
        Bantu::sukses(['id' => $id, 'status' => $status], 'Status pesanan diperbarui.');
    }

    private function hapus(?string $id): void
    {
        if (!$id) Bantu::gagal('ID pesanan wajib ada.', 400);
        $baris = Database::satu('SELECT id FROM pesanan WHERE id = ?', [$id]);
        if (!$baris) Bantu::gagal('Pesanan tidak ditemukan.', 404);
        // pesanan_item ikut terhapus (ON DELETE CASCADE).
        Database::eksekusi('DELETE FROM pesanan WHERE id = ?', [$id]);
        Aktivitas::catat("Pesanan {$id} dihapus", 'hapus', 'merah');
        Bantu::sukses(['id' => $id], 'Pesanan dihapus.');
    }
}

