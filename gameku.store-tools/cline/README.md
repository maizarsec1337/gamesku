# cline/ — Workspace artefak Cline

Folder ini menampung seluruh tools sementara, laporan audit, dump, log, dan
artefak yang dibuat selama pekerjaan Cline. **Tidak ada yang di root yang
bergantung pada folder ini.**

## Struktur

| Folder | Isi |
|---|---|
| `tools/` | Skrip audit, fix sekali-pakai, dan helper sementara |
| `reports/` | Laporan audit / hasil pemeriksaan (untuk laporan baru) |
| `artifacts/` | Dump HTML/JS/txt, JSON hasil analisis, daftar file, backup checkpoint, cache Python |
| `logs/` | Log pengujian Cline (log runtime launcher TIDAK di sini — lihat catatan) |
| `prompts/` | Prompt kerja Cline yang dipertahankan |

## Inventaris pemindahan (dari root, 2026-10-19)

- `tools/`: `audit_sumber.py`, `build_file.py`, `fix_duplicate.py`,
  `fix_duplicate2.py`, `fix_duplicate3.py`, `fix_line213.py`,
  `_audit_rantai.mjs`, `ujichat.cjs`
- `artifacts/`: `audit_embed.html`, `audit_ep1.html`, `response.html`,
  `_audit_ajax.html`, `_audit_embed_343.html`, `_audit_embed_headers.txt`,
  `_audit_embed_oshi.html`, `_audit_ep_oshi.html`, `_audit_hash.txt`,
  `_audit_jwlib.js`, `_audit_shinch.html`, `_audit_telly.html`,
  `audit_rantai.json`, `backend_api_files.txt`, `backend_pengendali_files.txt`,
  `backend_src_dirs.txt`, `gamesku_dirs.txt`, `test.txt`,
  `temp_admin_dasbor.jsx`, `__pycache__/`, `backup-security-20261017/`
- `prompts/`: `promt.txt`

## Keamanan menghapus folder ini

Menghapus seluruh folder `cline/` **tidak memengaruhi aplikasi GameKU**:

- Tidak ada import, path, atau skrip runtime yang mereferensikan isi folder ini
  (diverifikasi lewat pencarian menyeluruh di seluruh source code).
- Launcher (`mulai.bat` → `jalan.py` → `jembatan-dev.mjs`), build frontend
  (`npm run build`), dan backend PHP tidak menyentuh folder ini.

Untuk membersihkan: hapus folder `cline/`, lalu jalankan `git status` dan
commit penghapusannya (file yang ter-track akan tercatat sebagai deleted).

Catatan: file yang sudah ter-track di Git tetap ter-track walau sudah masuk
`cline/artifacts/` (aturan `.gitignore` hanya menahan file BARU). Jika suatu
saat ingin melepasnya dari repo, gunakan `git rm -r --cached cline/` lalu commit.

## Catatan yang TIDAK dipindah (runtime — jangan dipindah)

- `mulai.bat`, `jalan.py`, `jembatan-dev.mjs` — launcher + bridge dev.
  `jalan.py` memanggil `jembatan-dev.mjs` via path relatif dari root, dan
  frontend menampilkan pesan *"Jalankan `python jalan.py`"*.
- `logs/` — direktori runtime; `jalan.py` menulis `logs/frontend.log` dan
  `logs/backend.log` di sini setiap kali launcher dijalankan.

## Aturan untuk pekerjaan Cline berikutnya

- Skrip pemeriksaan baru → `cline/tools/`
- Laporan audit baru → `cline/reports/`
- Dump/snapshot/ artefak diagnostik → `cline/artifacts/`
- Log pengujian → `cline/logs/`
- Prompt yang dipertahankan → `cline/prompts/`

Jangan membuat file sementara di root jika tidak diperlukan runtime.
