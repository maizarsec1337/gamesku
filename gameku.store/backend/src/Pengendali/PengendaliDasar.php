<?php
// Kelas induk pengendali: baca badan request, pemetaan metode CRUD, validasi.

abstract class PengendaliDasar
{
    protected array $badan = [];

    // $metode: GET|POST|PUT|PATCH|DELETE; $id: segmen ke-2; $sub: segmen ke-3.
    abstract public function tangani(string $metode, ?string $id, ?string $sub): void;

    protected function badan(): array
    {
        if ($this->badan === []) {
            $this->badan = Bantu::badan();
        }
        return $this->badan;
    }

    protected function teks(string $kunci, string $bawaan = ''): string
    {
        return Bantu::potong(trim((string) ($this->badan()[$kunci] ?? $bawaan)), 500);
    }

    // Teks panjang (deskripsi/komentar) tanpa potong ketat.
    protected function teksMentah(string $kunci, string $bawaan = '', int $maks = 60000): string
    {
        return Bantu::potong(trim((string) ($this->badan()[$kunci] ?? $bawaan)), $maks);
    }

    protected function angka(string $kunci, int $bawaan = 0): int
    {
        $nilai = $this->badan()[$kunci] ?? null;
        if ($nilai === null || $nilai === '') {
            return $bawaan;
        }
        return max(0, (int) round((float) str_replace(',', '.', (string) $nilai)));
    }

    // Memastikan salah satu nilai enum yang diizinkan.
    protected function salahDari(string $nilai, array $daftar, string $bawaan): string
    {
        return in_array($nilai, $daftar, true) ? $nilai : $bawaan;
    }

    protected function metodeTakDiizinkan(): void
    {
        Bantu::gagal('Metode HTTP tidak diizinkan untuk endpoint ini.', 405);
    }

    // Validasi CSRF untuk request state-changing; token dari header lalu body.
    protected function validateCsrf(?string $token = null): bool
    {
        $metode = strtoupper(Bantu::metode());
        if (!in_array($metode, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return true;
        }
        $token = $token ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? $this->teks('X-CSRF-Token'));
        if (!$token) {
            Bantu::gagal('Token keamanan tidak disediakan.', 403);
        }
        if (!Auth::cekCsrf($token)) {
            Bantu::gagal('Token keamanan tidak valid.', 403);
        }
        return true;
    }
}
