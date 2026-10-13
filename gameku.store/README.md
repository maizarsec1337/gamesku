# Gamesku

Monorepo marketplace Gamesku — frontend React + backend PHP.

```text
gamesku.store/
  frontend/   React 19 + Vite (lihat frontend/README.md)
  backend/    API PHP (lihat backend/README.md)
```

## Menjalankan lokal

```bash
# Terminal 1 — backend PHP
php -S localhost:8000 -t backend

# Terminal 2 — frontend Vite
cd frontend
npm install
npm run dev
```

Buka `http://localhost:5173`. Request `/api` dari frontend
diteruskan otomatis ke backend PHP di port 8000.
