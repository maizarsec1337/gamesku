<?php
// =====================================================================
// PengendaliDasar.php — kelas induk semua pengendali.
// Menyediakan pembacaan badan permintaan, pemetaan metode CRUD, dan
// util validasi bersama.
// =====================================================================

abstract class PengendaliDasar
{
    /** @var array Badan permintaan (cache per-instans). */
    protected array $badan = [];

    /**
     * Titik masuk utama yang dipanggil router.
     * $metode: GET|POST|PUT|PATCH|DELETE
     * $id    : segmen path ke-2 (mis. /produk/{id})
     * $sub   : segmen path ke-3 (mis. /ulasan/produk/{id})
     */
    abstract public function tangani(string $metode, ?string $id, ?string $sub): void;

    /** Mengambil badan permintaan sebagai array. */
    protected function badan(): array
    {
        if ($this->badan === []) {
            $this->badan = Bantu::badan();
        }
        return $this->badan;
    }

    /** Membaca string dari badan permintaan (dipotong 500 karakter). */
    protected function teks(string $kunci, string $bawaan = ''): string
    {
        return Bantu::potong(trim((string) ($this->badan()[$kunci] ?? $bawaan)), 500);
    }

    /** Membaca teks panjang (mis. deskripsi lengkap / komentar) tanpa potong ketat. */
    protected function teksMentah(string $kunci, string $bawaan = '', int $maks = 60000): string
    {
        return Bantu::potong(trim((string) ($this->badan()[$kunci] ?? $bawaan)), $maks);
    }

    /** Membaca bilangan bulat >= 0 dari badan permintaan. */
    protected function angka(string $kunci, int $bawaan = 0): int
    {
        $nilai = $this->badan()[$kunci] ?? null;
        if ($nilai === null || $nilai === '') {
            return $bawaan;
        }
        return max(0, (int) round((float) str_replace(',', '.', (string) $nilai)));
    }

    /** Memastikan salah satu nilai diizinkan (mis. status enum). */
    protected function salahDari(string $nilai, array $daftar, string $bawaan): string
    {
        return in_array($nilai, $daftar, true) ? $nilai : $bawaan;
    }

    /** Membalas 405 Method Not Allowed. */
    protected function metodeTakDiizinkan(): void
    {
        Bantu::gagal('Metode HTTP tidak diizinkan untuk endpoint ini.', 405);
    }

    /**
     * Validasi token CSRF untuk request state-changing (POST/PUT/PATCH/DELETE).
     * Mengembalikan true bila valid, false bila gagal (respon 403 dikirim).
     * Memberikan prioritas dari header HTTP X-CSRF-Token, lalu body.
     */
    protected function validateCsrf(?string $token = null): bool
    {
        $metode = strtoupper(Bantu::metode());
        if (!in_array($metode, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return true; // GET/HEAD/DELETE-ONLY endpoints dibiarkan saja.
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
