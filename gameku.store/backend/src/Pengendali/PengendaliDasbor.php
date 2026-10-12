<?php
// =====================================================================
// PengendaliDasbor.php — ringkasan statistik admin (agregat SQL).
//   GET /api/dasbor   (admin) statistik, grafik penjualan, produk terlaris.
//
// Semua angka dihitung dari data nyata. Database kosong => semua nol
// (bukan angka contoh), meniru layananDasbor frontend.
// =====================================================================

class PengendaliDasbor extends PengendaliDasar
{
    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        Auth::wajib();
        if ($metode !== 'GET') $this->metodeTakDiizinkan();

        // --- Hitungan dasar ---
        $jumlahProduk    = (int) (Database::nilai('SELECT COUNT(*) FROM produk') ?? 0);
        $jumlahPesanan   = (int) (Database::nilai('SELECT COUNT(*) FROM pesanan') ?? 0);
        $jumlahPelanggan = (int) (Database::nilai('SELECT COUNT(*) FROM pelanggan') ?? 0);
        $pendapatan      = (int) (Database::nilai("SELECT COALESCE(SUM(total),0) FROM pesanan WHERE status = 'Berhasil'") ?? 0);

        // --- Ringkasan isi tiap tabel ---
        $ringkasan = [
            'produk'    => $jumlahProduk,
            'kategori'  => (int) (Database::nilai('SELECT COUNT(*) FROM kategori') ?? 0),
            'pesanan'   => $jumlahPesanan,
            'pelanggan' => $jumlahPelanggan,
            'creator'   => (int) (Database::nilai('SELECT COUNT(*) FROM creator') ?? 0),
            'promo'     => (int) (Database::nilai('SELECT COUNT(*) FROM promo') ?? 0),
            'ulasan'    => (int) (Database::nilai('SELECT COUNT(*) FROM ulasan') ?? 0),
            'media'     => (int) (Database::nilai('SELECT COUNT(*) FROM media') ?? 0),
        ];

        // --- Kartu statistik (bentuk sama dengan statistikDasbor frontend) ---
        $statistik = [
            ['id' => 'produk',     'judul' => 'Total Produk',     'nilai' => (string) $jumlahProduk,    'ket' => 'produk di katalog'],
            ['id' => 'pesanan',    'judul' => 'Total Pesanan',    'nilai' => (string) $jumlahPesanan,   'ket' => 'transaksi masuk'],
            ['id' => 'pelanggan',  'judul' => 'Total Pelanggan',  'nilai' => (string) $jumlahPelanggan, 'ket' => 'akun terdaftar'],
            ['id' => 'pendapatan', 'judul' => 'Total Pendapatan', 'nilai' => Bantu::rupiah($pendapatan),'ket' => 'dari pesanan berhasil'],
        ];

        // --- Grafik penjualan 14 hari terakhir (dari pesanan Berhasil) ---
        $grafik = $this->grafikPenjualan(14);

        // --- Produk terlaris (dari item pesanan Berhasil) ---
        $terlaris = $this->produkTerlaris(5);

        // --- Pesanan per status ---
        $perStatus = [];
        foreach (['Menunggu', 'Diproses', 'Berhasil', 'Gagal'] as $st) {
            $perStatus[$st] = (int) (Database::nilai('SELECT COUNT(*) FROM pesanan WHERE status = ?', [$st]) ?? 0);
        }

        Bantu::sukses([
            'statistik' => $statistik,
            'ringkasan' => $ringkasan,
            'grafik'    => $grafik,
            'terlaris'  => $terlaris,
            'perStatus' => $perStatus,
        ]);
    }

    // Deret total penjualan per hari (14 hari terakhir) termasuk hari kosong.
    private function grafikPenjualan(int $hari): array
    {
        $hari = max(1, min(90, $hari));
        $mundur = $hari - 1;
        // INTERVAL tidak menerima placeholder prepared statement, jadi integer
        // yang sudah divalidasi disisipkan langsung (aman dari injeksi).
        $rows = Database::banyak(
            "SELECT DATE(dibuat_pada) AS tanggal, SUM(total) AS total
             FROM pesanan WHERE status = 'Berhasil'
               AND dibuat_pada >= (CURDATE() - INTERVAL {$mundur} DAY)
             GROUP BY DATE(dibuat_pada)"
        );

        $peta = [];
        foreach ($rows as $r) {
            $peta[$r['tanggal']] = (int) $r['total'];
        }

        $hasil = [];
        for ($mundur = $hari - 1; $mundur >= 0; $mundur--) {
            $tgl = date('Y-m-d', strtotime("-{$mundur} day"));
            $hasil[] = [
                'tanggal' => $tgl,
                'label'   => date('j M', strtotime($tgl)),
                'total'   => $peta[$tgl] ?? 0,
            ];
        }
        return $hasil;
    }

    // Peringkat produk berdasarkan pendapatan dari item pesanan Berhasil.
    private function produkTerlaris(int $jumlah): array
    {
        $rows = Database::banyak(
            "SELECT pi.nama, SUM(pi.jumlah) AS terjual, SUM(pi.subtotal) AS pendapatan
             FROM pesanan_item pi
             JOIN pesanan p ON p.id = pi.pesanan_id
             WHERE p.status = 'Berhasil'
             GROUP BY pi.nama
             ORDER BY pendapatan DESC
             LIMIT " . max(1, min(50, $jumlah))
        );

        $hasil = [];
        foreach ($rows as $i => $r) {
            $hasil[] = [
                'nama'       => $r['nama'],
                'terjual'    => (int) $r['terjual'],
                'pendapatan' => (int) $r['pendapatan'],
                'peringkat'  => str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT),
            ];
        }
        return $hasil;
    }
}
