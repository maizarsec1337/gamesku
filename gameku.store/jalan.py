#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Launcher satu-terminal untuk Gameku.store.

Menjalankan frontend (Vite) dan backend (PHP) dari SATU proses Python tanpa
membuka jendela CMD tambahan:

    python jalan.py

Konfigurasi (sesuai repository):
    - Frontend : npm run dev                              di frontend/ -> http://localhost:5173
    - Backend  : php -S localhost:8000 -t . api/index.php di backend/  -> http://localhost:8000
    - Health   : http://localhost:8000/api/sehat

Rancangan:
    - subprocess.Popen dengan CREATE_NO_WINDOW (Windows): tanpa jendela CMD baru.
    - Output kedua server diarahkan ke logs/frontend.log dan logs/backend.log
      sehingga terminal utama hanya menampilkan status, bukan log Vite/PHP.
    - Kesiapan frontend & backend dicek secara INDEPENDEN (timeout terpisah,
      kegagalan satu layanan tidak membatalkan pengecekan layanan lain).
    - Pantauan proses: bila salah satu mati tak terduga, pesan error jelas
      disertai ekor log untuk diagnosis.
    - Ctrl+C menghentikan seluruh pohon proses (npm -> node, php) tanpa yatim.

Hanya memakai Python standard library. Tidak mengubah file proyek lain.
"""

import atexit
import ctypes
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import webbrowser
from datetime import datetime
from urllib.request import Request, urlopen

# ============================================================
# Konfigurasi (diverifikasi dari repository)
# ============================================================
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
LOG_DIR = os.path.join(ROOT_DIR, "logs")

FRONTEND_PORT = 5173
BACKEND_PORT = 8000
FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"
BACKEND_URL = f"http://localhost:{BACKEND_PORT}"
BACKEND_HEALTH_URL = f"http://localhost:{BACKEND_PORT}/api/sehat"

# shutil.which ikut mendeteksi skrip .cmd di Windows (lewat PATHEXT).
NPM_CMD = shutil.which("npm")
PHP_CMD = shutil.which("php")          # None bila PHP tidak terpasang

# --strictPort: bila port 5173 tidak tersedia, Vite langsung GAGAL (terbaca
# jelas di log) alih-alih diam-diam pindah ke port lain.
FRONTEND_CMD = [NPM_CMD or "npm", "run", "dev", "--", "--strictPort"]
BACKEND_CMD = [PHP_CMD or "php", "-S", f"localhost:{BACKEND_PORT}", "-t", ".", "api/index.php"]

# CREATE_NO_WINDOW mencegah munculnya jendela CMD baru saat menjalankan
# npm.cmd / node.exe / php.exe di Windows. Di POSIX dipakai sesi baru agar
# seluruh grup proses mudah dihentikan sekaligus.
FLAG_POPEN = (
    {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0)}
    if os.name == "nt"
    else {"start_new_session": True}
)

WAKTU_TUNGGU_FRONTEND = 90   # detik; npm + vite pada run pertama bisa lambat
WAKTU_TUNGGU_BACKEND = 30    # detik; php -S biasanya siap < 2 detik

# ============================================================
# ANSI Warna & Animasi
# ============================================================
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
CYAN = "\033[96m"
MAGENTA = "\033[95m"

SYMBOL_OK = "✓"
SYMBOL_WARN = "⚠"
SYMBOL_ERROR = "✗"
SYMBOL_INFO = "●"
SYMBOL_LOADING = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

BANNER = r"""
   _____      _                  ____  _               _
  / ____|    | |                |  _ \| |             | |
 | |     __ _| | ___ _ __ ___   | |_) | |__   ___   __| |
 | |    / _` | |/ _ \ '_ ` _ \  |  _ <| '_ \ / _ \ / _` |
 | |___| (_| | |  __/ | | | | | | |_) | | | | (_) | (_| |
  \_____\__,_|_|\___|_| |_| |_| |____/|_| |_|\___| \__,_|
                                                      
          G A M E K U . S T O R E   L A U N C H E R
"""

# ============================================================
# Konsol: UTF-8 + mode ANSI VT di Windows
# ============================================================
def siapkan_konsol():
    """Pakai UTF-8 (errors=replace) agar simbol spinner tidak membuat launcher
    crash pada konsol Windows berkode halaman non-UTF-8; aktifkan ANSI VT."""
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    if os.name != "nt":
        return
    try:
        kernel32 = ctypes.windll.kernel32
        hOut = kernel32.GetStdHandle(-11)          # STD_OUTPUT_HANDLE
        if hOut:
            mode = ctypes.c_uint32()
            if kernel32.GetConsoleMode(hOut, ctypes.byref(mode)):
                ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
                kernel32.SetConsoleMode(hOut, mode.value | ENABLE_VIRTUAL_TERMINAL_PROCESSING)
    except Exception:
        pass

# ============================================================
# Utilitas
# ============================================================
def cek_port(port):
    """Cek apakah port sedang listening di IPv4 (127.0.0.1) MAUPUN IPv6 (::1).

    Node/Vite di Windows bisa hanya mengikat ::1, jadi salah satu stack yang
    terpakai sudah dianggap 'port sudah dipakai'.
    """
    for fam, alamat in ((socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")):
        try:
            with socket.socket(fam, socket.SOCK_STREAM) as s:
                s.settimeout(0.3)
                if s.connect_ex((alamat, port)) == 0:
                    return True
        except OSError:
            continue
    return False

def cek_http(url, timeout=2.0):
    """Cek apakah endpoint HTTP merespons 200 OK."""
    try:
        req = Request(url, headers={"User-Agent": "gameku-launcher/1.0"})
        with urlopen(req, timeout=timeout) as resp:
            return resp.status == 200
    except Exception:
        return False

def format_detik(seconds):
    m, s = divmod(int(seconds), 60)
    return f"{m:02d}:{s:02d}"

def ekor_log(jalur, jumlah=8):
    """Tampilkan beberapa baris terakhir dari log untuk diagnosis cepat."""
    try:
        with open(jalur, "r", encoding="utf-8", errors="replace") as f:
            baris = f.readlines()[-jumlah:]
        for b in baris:
            teks = b.rstrip()
            if teks:
                print(f"    {DIM}{teks}{RESET}")
    except Exception:
        pass


# ============================================================
# Manajemen Proses Anak (dengan pembunuhan pohon proses)
# ============================================================
proses_anak = []            # berisi {"nama", "proc", "log"}
_sedang_bersih = False

def hentikan_pohon(proc, timeout=8):
    """Hentikan proses BESERTA seluruh anaknya.

    Windows : taskkill /T /F mematikan npm.cmd + node.exe + esbuild miliknya.
    POSIX   : os.killpg pada grup proses (start_new_session=True).
    """
    if proc is None or proc.poll() is not None:
        return
    if os.name == "nt":
        try:
            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                           capture_output=True, timeout=timeout, **FLAG_POPEN)
        except Exception:
            pass
    else:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        except (ProcessLookupError, PermissionError, OSError):
            try:
                proc.terminate()
            except Exception:
                pass
    try:
        proc.wait(timeout=timeout)
        return
    except subprocess.TimeoutExpired:
        pass
    # Paksa bila masih bandel.
    if os.name == "nt":
        try:
            proc.kill()
        except Exception:
            pass
    else:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
    try:
        proc.wait(timeout=3)
    except Exception:
        pass

def bersihkan_proses():
    """Hentikan semua proses anak dan tutup berkas log (idempoten)."""
    global _sedang_bersih
    if _sedang_bersih:
        return
    _sedang_bersih = True
    for entri in reversed(proses_anak):
        hentikan_pohon(entri["proc"])
        try:
            entri["log"].close()
        except Exception:
            pass

def handler_ctrl_c(signum=None, frame=None):
    print(f"\n\n{YELLOW}[!] Ctrl+C diterima — menghentikan semua server...{RESET}")
    bersihkan_proses()
    print(f"{GREEN}{SYMBOL_OK} Frontend, backend, dan seluruh proses anaknya sudah dihentikan.{RESET}")
    sys.exit(0)

signal.signal(signal.SIGINT, handler_ctrl_c)
atexit.register(bersihkan_proses)

# ============================================================
# Animasi Loading
# ============================================================
def animasi_loading(pesan, durasi=2.0):
    """Tampilkan animasi loading dengan karakter spinner."""
    akhir = time.time() + durasi
    i = 0
    while time.time() < akhir:
        frame = SYMBOL_LOADING[i % len(SYMBOL_LOADING)]
        sys.stdout.write(f"\r{CYAN}{frame}{RESET} {BOLD}{pesan}{RESET}   ")
        sys.stdout.flush()
        time.sleep(0.1)
        i += 1
    sys.stdout.write(f"\r{GREEN}{SYMBOL_OK}{RESET} {BOLD}{pesan}{RESET}      \n")
    sys.stdout.flush()

# ============================================================
# Pemeriksaan Dependensi
# ============================================================
def versi_program(cmd):
    """Jalankan program untuk menampilkan versi. Hasil: (ada?, keterangan)."""
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=8, **FLAG_POPEN)
        keluaran = (r.stdout or r.stderr or "").strip()
        baris = keluaran.splitlines()[0] if keluaran else "terinstall"
        return (r.returncode == 0, baris)
    except FileNotFoundError:
        return (False, "tidak ditemukan")
    except Exception:
        return (False, "tidak dapat dijalankan")

def cek_dependensi():
    """Cek Node.js, npm, dan PHP secara independen."""
    hasil = {"node": versi_program(["node", "--version"])}
    hasil["npm"] = (versi_program([NPM_CMD, "--version"]) if NPM_CMD
                    else (False, "tidak ditemukan di PATH"))
    hasil["php"] = (versi_program([PHP_CMD, "-v"]) if PHP_CMD
                    else (False, "tidak ditemukan di PATH"))
    return hasil

# ============================================================
# Jalankan Server (output -> log file, tanpa jendela CMD baru)
# ============================================================
def buka_log(nama):
    os.makedirs(LOG_DIR, exist_ok=True)
    return open(os.path.join(LOG_DIR, nama), "a", encoding="utf-8", errors="replace")

def jalankan_frontend():
    """npm run dev di frontend/ -> http://localhost:5173 (Vite)."""
    log = buka_log("frontend.log")
    log.write(f"\n===== {datetime.now():%Y-%m-%d %H:%M:%S} | "
              f"{' '.join(FRONTEND_CMD)} (cwd: {FRONTEND_DIR}) =====\n")
    log.flush()
    env = os.environ.copy()
    env["API_PROXY"] = BACKEND_URL     # dipakai vite.config.js untuk proxy /api
    env["NO_COLOR"] = "1"              # log bersih tanpa kode warna
    proc = subprocess.Popen(FRONTEND_CMD, cwd=FRONTEND_DIR, env=env,
                            stdout=log, stderr=subprocess.STDOUT, **FLAG_POPEN)
    proses_anak.append({"nama": "frontend", "proc": proc, "log": log})
    return proc

def jalankan_backend():
    """php -S localhost:8000 -t . api/index.php di backend/ -> port 8000."""
    log = buka_log("backend.log")
    log.write(f"\n===== {datetime.now():%Y-%m-%d %H:%M:%S} | "
              f"{' '.join(BACKEND_CMD)} (cwd: {BACKEND_DIR}) =====\n")
    log.flush()
    proc = subprocess.Popen(BACKEND_CMD, cwd=BACKEND_DIR,
                            stdout=log, stderr=subprocess.STDOUT, **FLAG_POPEN)
    proses_anak.append({"nama": "backend", "proc": proc, "log": log})
    return proc

# ============================================================
# Cek Kesiapan (INDEPENDEN per layanan)
# ============================================================
def _spinner_tunggu(label, sisa):
    frame = SYMBOL_LOADING[int(time.time() * 10) % len(SYMBOL_LOADING)]
    sys.stdout.write(f"\r  {CYAN}{frame}{RESET} Menunggu {label} siap "
                     f"({format_detik(max(0, sisa))} tersisa)   ")
    sys.stdout.flush()

def tunggu_frontend_siap(proc, timeout=WAKTU_TUNGGU_FRONTEND):
    """Tunggu frontend sendiri: HTTP 200 di http://localhost:5173.

    Tidak tergantung backend — kegagalan backend tidak menggagalkan frontend.
    """
    mulai = time.time()
    while time.time() - mulai < timeout:
        if proc.poll() is not None:
            return False, f"proses berhenti dengan kode keluar {proc.returncode}"
        if cek_http(FRONTEND_URL):
            return True, f"siap dalam {time.time() - mulai:.1f} detik"
        _spinner_tunggu("frontend", timeout - (time.time() - mulai))
        time.sleep(0.4)
    return False, f"tidak siap dalam {timeout} detik"

def tunggu_backend_siap(proc, timeout=WAKTU_TUNGGU_BACKEND):
    """Tunggu backend sendiri: HTTP 200 di http://localhost:8000/api/sehat.

    Tidak tergantung frontend — kegagalan frontend tidak menggagalkan backend.
    """
    mulai = time.time()
    while time.time() - mulai < timeout:
        if proc.poll() is not None:
            return False, f"proses berhenti dengan kode keluar {proc.returncode}"
        if cek_http(BACKEND_HEALTH_URL):
            return True, f"siap dalam {time.time() - mulai:.1f} detik"
        _spinner_tunggu("backend", timeout - (time.time() - mulai))
        time.sleep(0.4)
    return False, f"tidak siap dalam {timeout} detik"

# ============================================================
# Tampilan
# ============================================================
def tampilkan_banner():
    print(f"{MAGENTA}{BOLD}{BANNER}{RESET}")
    print(f"{CYAN}Launcher Satu-Terminal Gameku.store{RESET}")
    print(f"{DIM}Root: {ROOT_DIR}{RESET}")
    print()

def tampilkan_status_dependensi(deps):
    print(f"{BLUE}[1/4]{RESET} Pemeriksaan Dependensi")
    print(f"  {DIM}────────────────────────────────────────{RESET}")

    for nama in ["node", "npm", "php"]:
        tersedia, versi = deps[nama]
        simbol = SYMBOL_OK if tersedia else SYMBOL_ERROR
        warna = GREEN if tersedia else RED
        print(f"  {warna}{simbol}{RESET} {nama.capitalize():5s} → {versi}")

    node_npm_ok = deps["node"][0] and deps["npm"][0]
    php_ada = deps["php"][0]

    if not node_npm_ok:
        print(f"\n  {RED}{SYMBOL_ERROR} Node.js / npm tidak tersedia. Frontend tidak dapat dijalankan.{RESET}")
    if not php_ada:
        print(f"\n  {YELLOW}{SYMBOL_WARN} PHP tidak ditemukan di PATH. Backend TIDAK akan dijalankan.{RESET}")

    print(f"  {DIM}────────────────────────────────────────{RESET}")
    print()
    return node_npm_ok, php_ada

def tampilkan_status_frontend(port_digunakan):
    print(f"{BLUE}[2/4]{RESET} Frontend (React + Vite)")
    print(f"  {DIM}────────────────────────────────────────{RESET}")
    print(f"  {DIM}Perintah:{RESET} npm run dev -- --strictPort")
    print(f"  {DIM}Direktori:{RESET} frontend/")
    print(f"  {DIM}Port:{RESET} {FRONTEND_PORT}")
    print(f"  {DIM}Log:{RESET} logs/frontend.log")
    if port_digunakan:
        print(f"  {YELLOW}{SYMBOL_WARN}{RESET} Port {FRONTEND_PORT} sudah dipakai proses lain (akan dilewati).")
    print(f"  {DIM}────────────────────────────────────────{RESET}")
    print()

def tampilkan_status_backend(php_ada, port_digunakan):
    print(f"{BLUE}[3/4]{RESET} Backend (PHP API)")
    print(f"  {DIM}────────────────────────────────────────{RESET}")
    print(f"  {DIM}Perintah:{RESET} php -S localhost:{BACKEND_PORT} -t . api/index.php")
    print(f"  {DIM}Direktori:{RESET} backend/")
    print(f"  {DIM}Port:{RESET} {BACKEND_PORT}")
    print(f"  {DIM}Log:{RESET} logs/backend.log")
    if not php_ada:
        print(f"  {RED}{SYMBOL_ERROR}{RESET} PHP tidak terinstall — backend tidak bisa dijalankan.")
        print(f"    {DIM}Contoh instalasi: winget install PHP.PHP{RESET}")
    if port_digunakan:
        print(f"  {YELLOW}{SYMBOL_WARN}{RESET} Port {BACKEND_PORT} sudah dipakai proses lain (akan dilewati).")
    print(f"  {DIM}────────────────────────────────────────{RESET}")
    print()

# ============================================================
# Pantauan Proses
# ============================================================
def pantau_layanan(layanan):
    """Pantau semua proses yang dikelola launcher.

    Mengembalikan (nama, kode_keluar) begitu ada layanan yang mati tak terduga.
    Selama semua hidup, baris status diperbarui langsung di terminal utama.
    """
    while True:
        for l in layanan:
            kode = l["proc"].poll()
            if kode is not None:
                sys.stdout.write("\r" + " " * 100 + "\r")
                sys.stdout.flush()
                return l["nama"], kode
        frame = SYMBOL_LOADING[int(time.time() * 8) % len(SYMBOL_LOADING)]
        bagian = []
        for l in layanan:
            hidup = l["proc"].poll() is None
            warna = GREEN if hidup else RED
            bagian.append(f"{l['label']}: {warna}{'HIDUP' if hidup else 'MATI'}{RESET}")
        sys.stdout.write(f"\r{CYAN}{frame}{RESET} {'  |  '.join(bagian)}  |  "
                         f"{DIM}Ctrl+C untuk berhenti{RESET}   ")
        sys.stdout.flush()
        time.sleep(0.4)

# ============================================================
# Main
# ============================================================
def main():
    tampilkan_banner()
    animasi_loading("Menyiapkan launcher Gameku.store...", 1.0)

    # [1/4] Dependensi
    deps = cek_dependensi()
    node_npm_ok, php_ada = tampilkan_status_dependensi(deps)

    if not node_npm_ok:
        print(f"{RED}{SYMBOL_ERROR} Tidak dapat melanjutkan: Node.js dan npm wajib terpasang.{RESET}")
        sys.exit(1)

    # Port yang mungkin sudah dipakai proses lain
    fe_dipakai = cek_port(FRONTEND_PORT)
    be_dipakai = cek_port(BACKEND_PORT)

    # [2/4] & [3/4] Info frontend dan backend
    tampilkan_status_frontend(fe_dipakai)
    tampilkan_status_backend(php_ada, be_dipakai)

    # [4/4] Jalankan server
    print(f"{BLUE}[4/4]{RESET} Menjalankan Server (satu terminal, tanpa jendela CMD baru)")
    print(f"  {DIM}────────────────────────────────────────{RESET}")

    frontend_proc = None
    backend_proc = None

    if fe_dipakai:
        print(f"  {YELLOW}{SYMBOL_WARN}{RESET} Frontend dilewati: port {FRONTEND_PORT} sudah dipakai proses lain.")
    else:
        print(f"  {CYAN}{SYMBOL_INFO}{RESET} Memulai frontend: npm run dev  {DIM}(log: logs/frontend.log){RESET}")
        frontend_proc = jalankan_frontend()

    if not php_ada:
        print(f"  {RED}{SYMBOL_ERROR}{RESET} Backend TIDAK dijalankan: PHP tidak ditemukan di PATH.")
    elif be_dipakai:
        print(f"  {YELLOW}{SYMBOL_WARN}{RESET} Backend dilewati: port {BACKEND_PORT} sudah dipakai proses lain.")
    else:
        print(f"  {CYAN}{SYMBOL_INFO}{RESET} Memulai backend: php -S localhost:{BACKEND_PORT}  "
              f"{DIM}(log: logs/backend.log){RESET}")
        backend_proc = jalankan_backend()

    print()

    # ---- Cek kesiapan INDEPENDEN (setiap layanan punya hasil sendiri) ----
    hasil = {}

    if frontend_proc:
        print(f"  {DIM}Frontend:{RESET} menunggu {FRONTEND_URL} ...")
        ok, ket = tunggu_frontend_siap(frontend_proc)
        hasil["frontend"] = (ok, ket)
        simbol = f"{GREEN}{SYMBOL_OK}{RESET}" if ok else f"{RED}{SYMBOL_ERROR}{RESET}"
        print(f"\r  {DIM}Frontend:{RESET} {simbol} {ket}" + " " * 40)
    elif fe_dipakai:
        siap = cek_http(FRONTEND_URL)
        hasil["frontend"] = (siap, "dijalankan proses lain")
        simbol = f"{GREEN}{SYMBOL_OK}{RESET}" if siap else f"{RED}{SYMBOL_ERROR}{RESET}"
        print(f"  {DIM}Frontend:{RESET} {simbol} "
              f"{'merespons' if siap else 'tidak merespons'} (proses lain)")
    else:
        hasil["frontend"] = (False, "tidak dijalankan")

    if backend_proc:
        print(f"  {DIM}Backend :{RESET} menunggu {BACKEND_HEALTH_URL} ...")
        ok, ket = tunggu_backend_siap(backend_proc)
        hasil["backend"] = (ok, ket)
        simbol = f"{GREEN}{SYMBOL_OK}{RESET}" if ok else f"{RED}{SYMBOL_ERROR}{RESET}"
        print(f"\r  {DIM}Backend :{RESET} {simbol} {ket}" + " " * 40)
    elif not php_ada:
        hasil["backend"] = (False, "PHP tidak ditemukan di PATH")
        print(f"  {DIM}Backend :{RESET} {RED}{SYMBOL_ERROR}{RESET} tidak aktif (PHP tidak ditemukan)")
    elif be_dipakai:
        siap = cek_http(BACKEND_HEALTH_URL)
        hasil["backend"] = (siap, "dijalankan proses lain")
        simbol = f"{GREEN}{SYMBOL_OK}{RESET}" if siap else f"{RED}{SYMBOL_ERROR}{RESET}"
        print(f"  {DIM}Backend :{RESET} {simbol} "
              f"{'merespons' if siap else 'tidak merespons'} (proses lain)")
    else:
        hasil["backend"] = (False, "tidak dijalankan")

    print(f"  {DIM}────────────────────────────────────────{RESET}")

    # Bila layanan yang kita jalankan gagal siap -> hentikan semuanya, keluar.
    gagal = []
    if frontend_proc and not hasil["frontend"][0]:
        gagal.append("frontend")
        print(f"\n{RED}{SYMBOL_ERROR} Frontend gagal siap. Isi log logs/frontend.log:{RESET}")
        ekor_log(os.path.join(LOG_DIR, "frontend.log"))
    if backend_proc and not hasil["backend"][0]:
        gagal.append("backend")
        print(f"\n{RED}{SYMBOL_ERROR} Backend gagal siap. Isi log logs/backend.log:{RESET}")
        ekor_log(os.path.join(LOG_DIR, "backend.log"))
    if gagal:
        print(f"\n{RED}{SYMBOL_ERROR} Gagal memulai: {', '.join(gagal)}.{RESET}")
        bersihkan_proses()
        sys.exit(1)

    fe_hidup = hasil["frontend"][0]
    be_hidup = hasil["backend"][0]

    # Tidak ada satu pun layanan yang dikelola launcher.
    if frontend_proc is None and backend_proc is None:
        print(f"\n{YELLOW}{SYMBOL_WARN} Tidak ada layanan yang dijalankan launcher "
              f"(semua port sudah dipakai proses lain).{RESET}")
        return

    # ---- Kotak status + URL ----
    if fe_hidup and be_hidup:
        print(f"\n{GREEN}{BOLD}{SYMBOL_OK} SEMUA LAYANAN SIAP{RESET}\n")
    elif fe_hidup:
        print(f"\n{GREEN}{BOLD}{SYMBOL_OK} FRONTEND SIAP{RESET}  "
              f"{YELLOW}(backend tidak aktif: {hasil['backend'][1]}){RESET}\n")
    else:
        print(f"\n{YELLOW}{BOLD}{SYMBOL_WARN} HANYA BACKEND YANG AKTIF{RESET}\n")

    label_fe = f"{GREEN}[HIDUP]{RESET}" if fe_hidup else f"{RED}[MATI]{RESET}"
    print(f"{CYAN}┌──────────────────────────────────────────────────┐{RESET}")
    print(f"{CYAN}│{RESET}  Frontend : {FRONTEND_URL}   {label_fe}")
    if php_ada:
        label_be = f"{GREEN}[HIDUP]{RESET}" if be_hidup else f"{RED}[MATI]{RESET}"
        print(f"{CYAN}│{RESET}  Backend  : {BACKEND_URL}   {label_be}")
        print(f"{CYAN}│{RESET}  Health   : {BACKEND_HEALTH_URL}")
    else:
        print(f"{CYAN}│{RESET}  Backend  : {BACKEND_URL}   "
              f"{YELLOW}[TIDAK AKTIF — PHP tidak ditemukan]{RESET}")
    print(f"{CYAN}└──────────────────────────────────────────────────┘{RESET}\n")

    # ---- Susun daftar untuk dipantau ----
    layanan = []
    if frontend_proc:
        layanan.append({"nama": "frontend", "label": "Frontend", "proc": frontend_proc})
    if backend_proc:
        layanan.append({"nama": "backend", "label": "Backend", "proc": backend_proc})

    print(f"{DIM}Tekan Ctrl+C untuk menghentikan semua server.{RESET}\n")

    # Buka browser ke layanan yang hidup (nonaktifkan dengan GAMEKU_BUKA_BROWSER=0).
    if os.environ.get("GAMEKU_BUKA_BROWSER", "1") == "1":
        tujuan = FRONTEND_URL if fe_hidup else BACKEND_URL
        try:
            webbrowser.open(tujuan)
            print(f"{GREEN}{SYMBOL_OK}{RESET} Browser dibuka: {tujuan}\n")
        except Exception as e:
            print(f"{YELLOW}{SYMBOL_WARN}{RESET} Tidak dapat membuka browser: {e}\n")

    # ---- Pantau sampai ada yang mati atau user menekan Ctrl+C ----
    try:
        mati, kode = pantau_layanan(layanan)
    except KeyboardInterrupt:
        handler_ctrl_c()
        return

    print(f"\n{RED}{SYMBOL_ERROR} {mati} berhenti secara tidak terduga "
          f"(kode keluar: {kode}).{RESET}")
    if mati == "frontend":
        print(f"{DIM}Ekor log logs/frontend.log:{RESET}")
        ekor_log(os.path.join(LOG_DIR, "frontend.log"))
    else:
        print(f"{DIM}Ekor log logs/backend.log:{RESET}")
        ekor_log(os.path.join(LOG_DIR, "backend.log"))
    print(f"\n{CYAN}Menghentikan layanan lain agar tidak ada proses yatim...{RESET}")
    bersihkan_proses()
    print(f"{GREEN}{SYMBOL_OK} Semua proses dihentikan. Log lengkap: {LOG_DIR}{RESET}")
    sys.exit(1)


if __name__ == "__main__":
    siapkan_konsol()
    main()




