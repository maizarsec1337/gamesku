# gameku.store-tools

Pusat tools audit, pengecekan, testing, debugging, dan maintenance untuk GameKU.

## Struktur

- `cline/` — tools, laporan, log, dan artefak audit yang sudah ada.
- `maintenance/` — script perbaikan/pemeliharaan yang dipindahkan dari root.
- `logs/` — log eksekusi tools.
- `reports/` — laporan audit (lihat `cline/reports/`).
- `run.bat` — entry point workflow.

## Workflow

Jalankan dari folder ini (atau gunakan path absolut):

```bat
run.bat audit
run.bat check
run.bat test
run.bat build
run.bat security
```

- `audit` — periksa struktur project dan status git.
- `check` — periksa keberadaan runtime (node/php) dan file penting.
- `test` — jalankan test backend dan frontend.
- `build` — jalankan production build frontend terpadu.
- `security` — jalankan pemeriksaan keamanan backend dasar.

Semua path project mengarah ke `../gameku.store/`. Tidak ada file sementara yang dibuat di root repository.
```