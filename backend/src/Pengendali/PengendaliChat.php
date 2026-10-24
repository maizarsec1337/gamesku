<?php
// PengendaliChat: proxy asisten AI server-side (POST /api/chat).
// Kredensial provider HANYA dari config server (env GAMEKU_CHAT_*).
// Validasi panjang pesan, rate limit 20/menit per IP.
// Provider belum dikonfigurasi -> 503 jujur (bukan jawaban palsu).

class PengendaliChat extends PengendaliDasar
{
    private const MAKS_PESAN = 2000;
    private const MAKS_RIWAYAT = 10;
    private const BATAS_MENIT = 20;

    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        if ($metode === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
        if ($metode !== 'POST') {
            $this->metodeTakDiizinkan();
            return;
        }
        $this->batasLaju();
        $this->kirim();
    }

    // Rate limit per IP di FILE (konsisten dengan RateLimiter — tidak dapat
    // dibobol dengan mengganti/gugurkan session cookie).
    private function batasLaju(): void
    {
        $ip = RateLimiter::ip();
        $hasil = RateLimiter::check('chat', $ip, self::BATAS_MENIT, 60);
        if ($hasil['limited']) {
            header('Retry-After: ' . (int) $hasil['retry_after']);
            SecurityLog::catat('rate_limit', 'warn', 'Chat dibatasi.', ['retryAfter' => $hasil['retry_after']]);
            Bantu::gagal('Terlalu banyak pesan. Tunggu sebentar lalu coba lagi.', 429);
        }
    }

    private function kirim(): void
    {
        $pesan = Bantu::potong(trim((string) ($this->badan()['pesan'] ?? '')), self::MAKS_PESAN);
        if ($pesan === '') {
            Bantu::gagal('Pesan masih kosong.', 422);
            return;
        }

        $riwayatMentah = $this->badan()['riwayat'] ?? [];
        if (!is_array($riwayatMentah)) {
            $riwayatMentah = [];
        }
        $riwayat = [];
        foreach (array_slice($riwayatMentah, -self::MAKS_RIWAYAT) as $r) {
            if (!is_array($r)) {
                continue;
            }
            $peran = ($r['peran'] ?? '') === 'asisten' ? 'assistant' : 'user';
            $isi = Bantu::potong(trim((string) ($r['isi'] ?? '')), self::MAKS_PESAN);
            if ($isi === '') {
                continue;
            }
            $riwayat[] = ['role' => $peran, 'content' => $isi];
        }

        $cfg = require __DIR__ . '/../../config/config.php';
        $chat = $cfg['chat'] ?? [];
        $endpoint = trim((string) ($chat['endpoint'] ?? ''));
        $apiKey = (string) ($chat['api_key'] ?? '');
        $model = trim((string) ($chat['model'] ?? 'gpt-4o-mini'));
        $timeout = max(5, min(60, (int) ($chat['timeout'] ?? 25)));

        if ($endpoint === '' || $apiKey === '') {
            Bantu::gagal('Asisten AI belum dikonfigurasi di server.', 503);
            return;
        }
        // Batasi skema https agar tak jadi proxy terbuka (cegah SSRF).
        if (!preg_match('#^https://#i', $endpoint)) {
            error_log('[gameku][chat] endpoint tidak memakai https.');
            Bantu::gagal('Konfigurasi asisten AI tidak valid.', 500);
            return;
        }

        $messages = array_merge(
            [[
                'role' => 'system',
                'content' => 'Kamu asisten Gamesku (marketplace item Minecraft + katalog anime Streamku). '
                    . 'Jawab singkat Bahasa Indonesia. Jangan mengarang produk, harga, stok, '
                    . 'atau episode. Bila tidak tahu, arahkan ke Store/Streamku/Bantuan.',
            ]],
            $riwayat,
            [['role' => 'user', 'content' => $pesan]]
        );

        $payload = json_encode([
            'model' => $model,
            'messages' => $messages,
            'max_tokens' => 500,
            'temperature' => 0.7,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $balasan = $this->panggilProvider($endpoint, $apiKey, (string) $payload, $timeout);
        if ($balasan === null) {
            Bantu::gagal('Asisten AI sedang sibuk. Coba lagi nanti.', 502);
            return;
        }
        Bantu::sukses(['balasan' => $balasan]);
    }

    // Mengembalikan teks balasan atau null bila gagal (detail ke log saja).
    private function panggilProvider(string $endpoint, string $apiKey, string $payload, int $timeout): ?string
    {
        // Utamakan cURL; fallback ke stream bila ekstensi tidak ada.
        if (function_exists('curl_init')) {
            $ch = curl_init($endpoint);
            if ($ch === false) {
                error_log('[gameku][chat] curl_init gagal.');
                return null;
            }
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $payload,
                CURLOPT_TIMEOUT => $timeout,
                CURLOPT_CONNECTTIMEOUT => 8,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $apiKey,
                ],
            ]);
            $mentah = curl_exec($ch);
            $kode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $galatCurl = is_string(curl_error($ch)) ? curl_error($ch) : '';
            curl_close($ch);
            if (!is_string($mentah) || $mentah === '') {
                error_log('[gameku][chat] curl gagal.');
                return null;
            }
            if ($kode < 200 || $kode >= 300) {
                error_log('[gameku][chat] provider HTTP ' . $kode);
                return null;
            }
            return $this->uraiBalasan($mentah);
        }

        $konteks = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\nAuthorization: Bearer " . $apiKey . "\r\n",
                'content' => $payload,
                'timeout' => $timeout,
                'ignore_errors' => true,
            ],
        ]);
        // Fallback stream tetap membawa Authorization via header HTTPS
        // (bukan via query/URL). Hanya dipakai bila cURL tak tersedia.
        $mentah = @file_get_contents($endpoint, false, $konteks);
        if (!is_string($mentah) || $mentah === '') {
            error_log('[gameku][chat] file_get_contents gagal.');
            return null;
        }
        return $this->uraiBalasan($mentah);
    }

    // Mendukung respons OpenAI-compatible + bentuk {balasan|jawaban|message}.
    private function uraiBalasan(string $mentah): ?string
    {
        $data = json_decode($mentah, true);
        if (!is_array($data)) {
            error_log('[gameku][chat] respons bukan JSON.');
            return null;
        }
        $kandidat = [
            $data['choices'][0]['message']['content'] ?? null,
            $data['choices'][0]['text'] ?? null,
            $data['balasan'] ?? null,
            $data['jawaban'] ?? null,
            $data['message'] ?? null,
            $data['data']['balasan'] ?? null,
        ];
        foreach ($kandidat as $nilai) {
            if (is_string($nilai) && trim($nilai) !== '') {
                return Bantu::potong(trim($nilai), 4000);
            }
        }
        error_log('[gameku][chat] respons tanpa teks balasan.');
        return null;
    }
}