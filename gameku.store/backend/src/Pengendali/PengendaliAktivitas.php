<?php
// =====================================================================
// PengendaliAktivitas.php — tabel `aktivitas` (audit log).
//   GET    /api/aktivitas        (admin) daftar aktivitas terbaru.
//   DELETE /api/aktivitas        (admin) kosongkan jejak aktivitas.
// Pencatatan aktivitas dilakukan otomatis oleh pengendali lain lewat
// Aktivitas::catat(); di sini hanya pembacaan & pembersihan.
// =====================================================================

class PengendaliAktivitas extends PengendaliDasar
{
    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        Auth::wajib();
        switch ($metode) {
            case 'GET':
                $jumlah = min(200, max(1, Bantu::angka('batas', 50)));
                Bantu::sukses(Aktivitas::terbaru($jumlah));
                break;
            case 'DELETE':
                Aktivitas::kosongkan();
                Bantu::sukses(null, 'Aktivitas dikosongkan.');
                break;
            default:
                $this->metodeTakDiizinkan();
        }
    }
}
