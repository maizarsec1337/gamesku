<?php
// Pembacaan & pembersihan tabel `aktivitas` (admin); pencatatan via Aktivitas::catat().

class PengendaliAktivitas extends PengendaliDasar
{
    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        Auth::wajib();
        // Hanya superadmin yang boleh membaca dan mengelola jejak aktivitas.
        Auth::wajibPeran('superadmin');
        switch ($metode) {
            case 'GET':
                $jumlah = min(200, max(1, Bantu::angka('batas', 50)));
                Bantu::sukses(Aktivitas::terbaru($jumlah));
                break;
            case 'DELETE':
                $this->validateCsrf();
                Aktivitas::kosongkan();
                Aktivitas::audit('kosongkan_aktivitas', 'aktivitas', '', 'Berhasil', [], 'Semua jejak aktivitas dikosongkan.');
                Bantu::sukses(null, 'Aktivitas dikosongkan.');
                break;
            default:
                $this->metodeTakDiizinkan();
        }
    }
}
