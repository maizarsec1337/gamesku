<?php
class PengendaliKeamanan extends PengendaliDasar
{
    private function wajibAdmin(): void
    {
        $sesi = Auth::wajib();
        $peran = (string) ($sesi['peran'] ?? '');
        if (!in_array($peran, ['admin', 'superadmin'], true)) {
            SecurityLog::catat('akses_ditolak', 'warn', 'Akses keamanan ditolak.', ['peran' => $peran]);
            Bantu::gagal('Akses ditolak.', 403);
        }
    }

    public function tangani(string $metode, ?string $id, ?string $sub): void
    {
        $this->wajibAdmin();
        $aksi = $id ?: '';

        if ($metode === 'GET' && $aksi === 'audit') {
            $filters = [];
            if (isset($_GET['action'])) {
                $filters['action'] = (string) $_GET['action'];
            }
            if (isset($_GET['outcome'])) {
                $filters['outcome'] = (string) $_GET['outcome'];
            }
            Bantu::sukses(AuditLog::search($filters, 200));
            return;
        }

        if ($metode === 'GET' && $aksi === 'incidents') {
            Bantu::sukses(IncidentManager::list($_GET['status'] ?? null));
            return;
        }

        if ($metode === 'GET' && $aksi === 'threats') {
            Bantu::sukses(ThreatDetector::analyze());
            return;
        }

        if ($metode === 'POST' && $aksi === 'incident') {
            $this->validateCsrf();
            $judul = $this->teks('title', 'Insiden keamanan');
            $sev = $this->teks('severity', 'medium');
            $newId = IncidentManager::create($judul, $sev, ['sumber' => 'api']);
            Bantu::sukses(['id' => $newId], 'Insiden dibuat.', 201);
            return;
        }

        if (in_array($metode, ['PATCH', 'PUT'], true) && $aksi === 'incident' && $sub) {
            $this->validateCsrf();
            $status = $this->teks('status', '');
            if (!IncidentManager::transition($sub, $status)) {
                Bantu::gagal('Transisi insiden gagal.', 400);
            }
            Bantu::sukses(['id' => $sub, 'status' => $status], 'Insiden diperbarui.');
            return;
        }

        if ($metode === 'POST' && $aksi === 'scan') {
            $this->validateCsrf();
            $root = dirname(__DIR__, 3); // project root
            $findings = Scanner::run($root);
            AuditLog::record('security.scan', 'success', ['jumlah' => count($findings)]);
            Bantu::sukses($findings, 'Pemindaian selesai.');
            return;
        }

        Bantu::gagal('Endpoint keamanan tidak ditemukan.', 404);
    }
}
