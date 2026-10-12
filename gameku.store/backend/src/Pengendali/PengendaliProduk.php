<?php
// =====================================================================
// PengendaliProduk.php — tabel `produk`.
//   GET  /api/produk                publik: hanya status Aktif (tamu).
//                                   admin (sesi): semua status.
//   GET  /api/produk/{id|slug}      satu produk (id atau slug).
//   GET  /api/produk?kategori=..    filter kategori.
//   GET  /api/produk?cari=..        cari nama/creator/slug.
//   POST /api/produk                (admin) tambah.
//   PUT  /api/produk/{id}           (admin) ubah.
//   DELETE /api/produk/{id}         (admin) hapus.
// =====================================================================

class PengendaliProduk extends PengendaliDasar
{
    private const JENIS  = ['Skin', 'Skin Pack', 'Map', 'Texture Pack', 'Add-on', 'Mod', 'Build', 'Bundle'];
    private const STATUS = ['Draft', 'Aktif', 'Nonaktif'];

    // Kolom SELECT bersama + pemetaan nama ala frontend.
    private const PILIH = 'SELECT p.id, p.nama, p.slug, p.kategori_id AS kategoriId,
        k.nama AS kategoriNama, p.jenis, p.deskripsi_singkat AS deskripsiSingkat,
        p.deskripsi_lengkap AS deskripsiLengkap, p.harga, p.harga_diskon AS hargaDiskon,
        p.thumbnail, p.preview, p.file_produk AS fileProduk, p.versi_minecraft AS versiMinecraft,
        p.creator, p.status, p.dibuat_pada AS dibuatPada, p.diperbarui_pada AS diperbaruiPada
        FROM produk p LEFT JOIN kategori k ON k.id = p.kategori_id';

    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        switch ($metode) {
            case 'GET':
                $id === null ? $this->daftar() : $this->satu($id);
                break;
            case 'POST':
                Auth::wajib();
                $this->simpan();
                break;
            case 'PUT':
            case 'PATCH':
                Auth::wajib();
                $this->simpan($id);
                break;
            case 'DELETE':
                Auth::wajib();
                $this->hapus($id);
                break;
            default:
                $this->metodeTakDiizinkan();
        }
    }

    // Decode kolom JSON `preview` dan pastikan angka bertipe int.
    private function petakan(array $p): array
    {
        if (isset($p['preview']) && is_string($p['preview'])) {
            $p['preview'] = json_decode($p['preview'], true) ?: [];
        } elseif (!isset($p['preview'])) {
            $p['preview'] = [];
        }
        $p['harga']       = (int) $p['harga'];
        $p['hargaDiskon'] = (int) $p['hargaDiskon'];
        return $p;
    }

    private function daftar(): void
    {
        $where = [];
        $param = [];

        // Tamu hanya melihat produk Aktif.
        if (Auth::sesi() === null) {
            $where[] = 'p.status = ?';
            $param[] = 'Aktif';
        }

        $kategori = Bantu::teks('kategori');
        if ($kategori !== '') {
            $where[] = 'p.kategori_id = ?';
            $param[] = $kategori;
        }

        $jenis = Bantu::teks('jenis');
        if ($jenis !== '' && in_array($jenis, self::JENIS, true)) {
            $where[] = 'p.jenis = ?';
            $param[] = $jenis;
        }

        $cari = Bantu::teks('cari');
        if ($cari !== '') {
            $where[] = '(p.nama LIKE ? OR p.creator LIKE ? OR p.slug LIKE ?)';
            $like = '%' . $cari . '%';
            array_push($param, $like, $like, $like);
        }

        $sql = self::PILIH;
        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        $sql .= ' ORDER BY p.dibuat_pada DESC, p.id DESC';

        $batas = min(200, max(1, Bantu::angka('batas', 200)));
        $sql .= ' LIMIT ' . $batas;

        $hasil = array_map(fn($p) => $this->petakan($p), Database::banyak($sql, $param));
        Bantu::sukses($hasil);
    }

    private function satu(string $kunci): void
    {
        // Cari berdasarkan id, bila tidak ada coba slug.
        $baris = Database::satu(self::PILIH . ' WHERE p.id = ?', [$kunci]);
        if (!$baris) {
            $baris = Database::satu(self::PILIH . ' WHERE p.slug = ?', [$kunci]);
        }
        if (!$baris) Bantu::gagal('Produk tidak ditemukan.', 404);
        Bantu::sukses($this->petakan($baris));
    }

    private function simpan(?string $id = null): void
    {
        $nama = $this->teks('nama');
        if ($nama === '') Bantu::gagal('Nama produk wajib diisi.');

        $slug = $this->teks('slug');
        if ($slug === '') $slug = Bantu::slug($nama);

        $harga       = $this->angka('harga', 0);
        $hargaDiskon = $this->angka('hargaDiskon', 0);
        // Harga coret hanya sah bila lebih besar dari harga jual.
        if ($hargaDiskon <= $harga) $hargaDiskon = 0;

        // preview: terima array biasa.
        $previewMentah = $this->badan()['preview'] ?? null;
        $preview = null;
        if (is_array($previewMentah)) {
            $preview = array_values(array_filter(array_map('strval', $previewMentah)));
        }

        $data = [
            'nama'              => Bantu::potong($nama, 160),
            'slug'              => Bantu::potong($slug, 180),
            'kategori_id'       => $this->teks('kategoriId') ?: null,
            'jenis'             => $this->salahDari($this->teks('jenis', 'Skin'), self::JENIS, 'Skin'),
            'deskripsi_singkat' => Bantu::potong($this->teks('deskripsiSingkat'), 300),
            'deskripsi_lengkap' => $this->teksMentah('deskripsiLengkap'),
            'harga'             => $harga,
            'harga_diskon'      => $hargaDiskon,
            'thumbnail'         => $this->teks('thumbnail'),
            'preview'           => Bantu::keJson($preview),
            'file_produk'       => $this->teks('fileProduk'),
            'versi_minecraft'   => $this->teks('versiMinecraft'),
            'creator'           => $this->teks('creator'),
            'status'            => $this->salahDari($this->teks('status', 'Draft'), self::STATUS, 'Draft'),
        ];

        if ($id) {
            $lama = Database::satu('SELECT id, nama FROM produk WHERE id = ?', [$id]);
            if (!$lama) Bantu::gagal('Produk tidak ditemukan.', 404);

            $bentrok = Database::satu('SELECT id FROM produk WHERE slug = ? AND id <> ?', [$data['slug'], $id]);
            if ($bentrok) Bantu::gagal("Slug \"{$data['slug']}\" sudah dipakai produk lain.");

            Database::eksekusi(
                'UPDATE produk SET nama=?, slug=?, kategori_id=?, jenis=?, deskripsi_singkat=?,
                    deskripsi_lengkap=?, harga=?, harga_diskon=?, thumbnail=?, preview=?, file_produk=?,
                    versi_minecraft=?, creator=?, status=?, diperbarui_pada=NOW()
                 WHERE id=?',
                [
                    $data['nama'], $data['slug'], $data['kategori_id'], $data['jenis'],
                    $data['deskripsi_singkat'], $data['deskripsi_lengkap'], $data['harga'],
                    $data['harga_diskon'], $data['thumbnail'], $data['preview'], $data['file_produk'],
                    $data['versi_minecraft'], $data['creator'], $data['status'], $id,
                ]
            );
            Aktivitas::catat("Produk \"{$data['nama']}\" diperbarui", 'kotak', 'biru');
            Bantu::sukses($this->ambilTerpetakan($id), 'Produk diperbarui.');
        }

        $bentrok = Database::satu('SELECT id FROM produk WHERE slug = ?', [$data['slug']]);
        if ($bentrok) Bantu::gagal("Slug \"{$data['slug']}\" sudah dipakai produk lain.");

        $idBaru = Bantu::idBaru('prd');
        Database::eksekusi(
            'INSERT INTO produk (id, nama, slug, kategori_id, jenis, deskripsi_singkat, deskripsi_lengkap,
                harga, harga_diskon, thumbnail, preview, file_produk, versi_minecraft, creator, status)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [
                $idBaru, $data['nama'], $data['slug'], $data['kategori_id'], $data['jenis'],
                $data['deskripsi_singkat'], $data['deskripsi_lengkap'], $data['harga'],
                $data['harga_diskon'], $data['thumbnail'], $data['preview'], $data['file_produk'],
                $data['versi_minecraft'], $data['creator'], $data['status'],
            ]
        );
        Aktivitas::catat("Produk \"{$data['nama']}\" disimpan sebagai {$data['status']}", 'kotak', 'hijau');
        Bantu::sukses($this->ambilTerpetakan($idBaru), 'Produk ditambahkan.', 201);
    }

    // Ambil satu produk (terpetakan) untuk dikembalikan setelah tulis.
    private function ambilTerpetakan(string $id): ?array
    {
        $baris = Database::satu(self::PILIH . ' WHERE p.id = ?', [$id]);
        return $baris ? $this->petakan($baris) : ['id' => $id];
    }

    private function hapus(?string $id): void
    {
        if (!$id) Bantu::gagal('ID produk wajib ada.', 400);
        $baris = Database::satu('SELECT id, nama FROM produk WHERE id = ?', [$id]);
        if (!$baris) Bantu::gagal('Produk tidak ditemukan.', 404);

        Database::eksekusi('DELETE FROM produk WHERE id = ?', [$id]);
        Aktivitas::catat("Produk \"{$baris['nama']}\" dihapus", 'hapus', 'merah');
        Bantu::sukses(['id' => $id], 'Produk dihapus.');
    }
}

