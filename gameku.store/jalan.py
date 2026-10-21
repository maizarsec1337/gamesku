#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Launcher & Monitor terpadu Gameku.store — satu terminal untuk frontend + backend.

Menjalankan frontend (Vite dev server) dan backend (PHP built-in server)
secara concurrent dalam satu proses Python, dengan dashboard terminal
berwarna ANSI, panel log real-time, pemantauan perubahan file, dan kontrol
interaktif tanpa membuka jendela CMD tambahan.

    python jalan.py

Kontrol interaktif:
    Q / q  -> Keluar (graceful shutdown seluruh proses)
    R / r  -> Restart semua layanan yang dikelola
    C / c  -> Bersihkan layar terminal
    1      -> Tampilkan hanya log frontend
    2      -> Tampilkan hanya log backend
    3      -> Tampilkan keduanya (default)
    ^C     -> Paksa keluar (SIGINT)

Konfigurasi (sesuai repository):
    - Frontend : npm run dev              di frontend/ -> http://localhost:5173
    - Backend  : php -S localhost:8000    di backend/  -> http://localhost:8000
    - Health   : http://localhost:8000/api/sehat

Hanya memakai Python standard library. Tidak mengubah file proyek lain.
"""

import atexit
import ctypes
import errno
import os
import shutil
import signal
import socket
import subprocess
import sys
import termios
import threading
import time
import tty
import webbrowser
from collections import deque
from datetime import datetime
from urllib.error import HTTPError, URLError
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

NPM_CMD = shutil.which("npm")
PHP_CMD = shutil.which("php")  # None bila PHP tidak terpasang

# --strictPort: Vite gagal kalau port 5173 tidak tersedia (terbaca jelas di log).
FRONTEND_CMD = [NPM_CMD or "npm", "run", "dev", "--", "--strictPort"]
BACKEND_CMD = [PHP_CMD or "php", "-S", f"localhost:{BACKEND_PORT}", "-t", ".", "api/index.php"]

# CREATE_NO_WINDOW mencegah jendela CMD baru di Windows. POSIX pakai start_new_session.
FLAG_POPEN = (
    {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0)}
    if os.name == "nt"
    else {"start_new_session": True}
)

WAKTU_TUNGGU_FRONTEND = 90   # detik; npm + vite run pertama bisa lambat
WAKTU_TUNGGU_BACKEND = 30    # detik; php -S biasanya siap < 2 detik

# Interval pemantauan
INTERVAL_HEALTH = 5      # detik — cek health endpoint
INTERVAL_FILEWATCH = 2   # detik — cek perubahan file sumber
INTERVAL_DRAW = 0.2      # detik — redraw dashboard

# Maksimal baris log yang disimpan per layanan (untuk scrolling)
MAX_LOG_LINES = 500

# File sumber yang dipantau untuk perubahan (relative to ROOT_DIR)
FILEWATCH_TARGETS = [
    os.path.join("frontend", "src", "main.jsx"),
    os.path.join("frontend", "src", "App.jsx"),
    os.path.join("frontend", "src", "halaman", "Beranda.jsx"),
    os.path.join("frontend", "vite.config.js"),
    os.path.join("backend", "api", "index.php"),
]
# ============================================================
# ANSI Warna & Simbol
# ============================================================
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
MAGENTA = "\033[95m"
CYAN = "\033[96m"
WHITE = "\033[97m"

SYMBOL_OK = "✓"
SYMBOL_WARN = "⚠"
SYMBOL_ERROR = "✗"
SYMBOL_INFO = "●"
SYMBOL_LOADING = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

# ============================================================
# State global
# ============================================================
prosesaktif = {}       # nama -> subprocess.Popen
status_proses = {}     # nama -> {"pid": int, "siap": bool, "uptime": float, "health": str}
log_buffer = {}        # nama -> deque of (waktu, teks)
log_lock = threading.Lock()
log_filter = "both"    # "frontend" | "backend" | "both"
scroll_offset = 0      # baris yang di-scroll dari bawah
filewatch_mtime = {}   # path -> mtime terakhir
filewatch_changed = [] # daftar file yang berubah
running = True         # flag utama loop
draw_lock = threading.Lock() # untuk redrawn

# ============================================================
# BANNER
# ============================================================
BANNER = r"""
   _____      _        
  / ____|    | |       
 | |  __ _  _| | ___ ___ 
 | | / _` || | | / _ \ '_ \
 | || (_| || |_| |  __/ | |
  \____\__,_|\___/ \___|_| 
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
    """php -S localhost:8000 -t . api/index.php di backend/ -> port 8000.

    Menjalankan backend PHP SEBENARNYA (backend/api/index.php + MySQL). Tidak
    ada backend pengganti/mock: bila PHP tidak terpasang, backend tidak
    dijalankan dan launcher menampilkan pesan jelas.
    """
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
        print(f"\n  {RED}{SYMBOL_ERROR} PHP tidak ditemukan di PATH. Backend PHP TIDAK akan dijalankan.{RESET}")

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


# Dashboard & Interaktif
import select, tty, termios

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def draw_header():
    clear_screen()
    print(CYAN + BOLD + '  GAMEKU STORE LAUNCHER v2.0' + RESET)
    print(DIM + '  Root: ' + ROOT_DIR)
    print(DIM + '  Frontend: ' + FRONTEND_URL + '  |  Backend: ' + BACKEND_URL)
    print()

def draw_log_panel(nama, buffer):
    print(CYAN + chr(218) + chr(219)*70 + CYAN + '──' + RESET)
    items = list(buffer)[-MAX_LOG_LINES:]
    for _ in range(MAX_LOG_LINES - len(items)):
        print(DIM + '│' + RESET + ' ' * 66, end='')
    print(DIM + '│' + RESET)
    for w, t in items:
        line = DIM + '│' + RESET + ' ' + w + ' ' + t
        print(line[:68] + DIM + '│' + RESET)
    print(CYAN + chr(192) + chr(192)*70 + CYAN + '──' + RESET)

def draw_status_panel():
    print(CYAN + chr(218) + chr(219)*70 + CYAN + '──' + RESET)
    for nama in ['frontend', 'backend']:
        stat = status_proses.get(nama, {})
        alive = stat.get('siap', False)
        pid = stat.get('pid', 0)
        uptime = stat.get('uptime', 0.0)
        health = stat.get('health', 'N/A')
        color = GREEN if alive else RED
        print(color + '│' + RESET + ' ' + nama.ljust(10) + ': ' + color + ('HIDUP' if alive else 'MATI') + RESET + ' ')
        print(DIM + '│' + RESET + DIM + '  PID:' + str(pid) + '  Uptime:' + format_detik(uptime) + '  Health:' + health + RESET)
    print(DIM + '│' + RESET)
    print(CYAN + chr(192) + chr(192)*70 + CYAN + '──' + RESET)

def handle_input():
    try:
        fd = sys.stdin.fileno()
        old = termios.tcgetattr(fd)
        tty.setraw(fd)
        ch = sys.stdin.read(1)
        termios.tcsetattr(fd, termios.TCSADRAIN, old)
        return ch
    except Exception:
        return None

def poll_processes():
    global running
    now = time.time()
    for nama in ['frontend', 'backend']:
        proc = prosesaktif.get(nama)
        if proc is None:
            continue
        if proc.poll() is not None:
            status_proses[nama]['siap'] = False
            print(RED + nama.upper() + ' died (code ' + str(proc.returncode) + ')' + RESET)
            running = False
            continue
        stat = status_proses.setdefault(nama, {'pid': proc.pid, 'siap': True, 'uptime': 0, 'health': 'N/A'})
        stat['pid'] = proc.pid
        stat['uptime'] = now - stat.get('start_time', now)
        if nama == 'backend':
            if cek_http(BACKEND_HEALTH_URL):
                stat['health'] = 'HEALTHY'
            else:
                stat['health'] = 'CHECK'

def watch_files(last_mtimes):
    changed = False
    for path in FILEWATCH_TARGETS:
        try:
            if os.path.exists(path):
                mt = os.path.getmtime(path)
                if path not in last_mtimes:
                    last_mtimes[path] = mt
                elif last_mtimes[path] != mt:
                    last_mtimes[path] = mt
                    print('FILE_CHANGED: ' + path)
                    changed = True
        except Exception:
            pass
    return changed


# Main (Dashboard versi 2.0)
def main():
    globals()['filewatch_mtime'] = {}
    globals()['running'] = True
    draw_header()
    animasi_loading('Menyiapkan launcher Gameku.store...', 1.0)
    
    # Dependensi
    deps = cek_dependensi()
    node_npm_ok, php_ada = tampilkan_status_dependensi(deps)
    if not node_npm_ok:
        print(RED + SYMBOL_ERROR + ' Tidak dapat melanjutkan: Node.js dan npm wajib terpasang.' + RESET)
        sys.exit(1)
    
    fe_dipakai = cek_port(FRONTEND_PORT)
    be_dipakai = cek_port(BACKEND_PORT)
    
    tampilkan_status_frontend(fe_dipakai)
    tampilkan_status_backend(php_ada, be_dipakai)
    
    print(BLUE + '[4/4]' + RESET + ' Menjalankan Server (satu terminal, tanpa jendela CMD baru)')
    
    frontend_proc = None
    backend_proc = None
    
    if fe_dipakai:
        print(YELLOW + SYMBOL_WARN + ' Frontend dilewati: port ' + str(FRONTEND_PORT) + ' sudah dipakai proses lain.' + RESET)
    else:
        print(CYAN + SYMBOL_INFO + ' Memulai frontend: npm run dev (log: logs/frontend.log)')
        frontend_proc = jalankan_frontend()
    
    if not php_ada:
        print(RED + SYMBOL_ERROR + ' Backend TIDAK dijalankan: PHP tidak ditemukan di PATH.' + RESET)
    elif be_dipakai:
        print(YELLOW + SYMBOL_WARN + ' Backend dilewati: port ' + str(BACKEND_PORT) + ' sudah dipakai proses lain.' + RESET)
    else:
        print(CYAN + SYMBOL_INFO + ' Memulai backend: php -S localhost:' + str(BACKEND_PORT) + ' (log: logs/backend.log)')
        backend_proc = jalankan_backend()
    
    print()
    
    # Cek kesiapan
    hasil = {}
    if frontend_proc:
        print('  Frontend: menunggu ' + FRONTEND_URL + ' ...')
        ok, ket = tunggu_frontend_siap(frontend_proc)
        hasil['frontend'] = (ok, ket)
        print('  Frontend: ' + ('OK' if ok else 'GAGAL') + ' ' + ket)
    elif fe_dipakai:
        siap = cek_http(FRONTEND_URL)
        hasil['frontend'] = (siap, 'dijalankan proses lain')
        print('  Frontend: ' + ('OK' if siap else 'GAGAL') + ' (proses lain)')
    else:
        hasil['frontend'] = (False, 'tidak dijalankan')
    
    if backend_proc:
        print('  Backend: menunggu ' + BACKEND_HEALTH_URL + ' ...')
        ok, ket = tunggu_backend_siap(backend_proc)
        hasil['backend'] = (ok, ket)
        print('  Backend: ' + ('OK' if ok else 'GAGAL') + ' ' + ket)
    elif not php_ada:
        hasil['backend'] = (False, 'PHP tidak ditemukan')
        print('  Backend: GAGAL (PHP tidak ditemukan)')
    elif be_dipakai:
        siap = cek_http(BACKEND_HEALTH_URL)
        hasil['backend'] = (siap, 'dijalankan proses lain')
        print('  Backend: ' + ('OK' if siap else 'GAGAL') + ' (proses lain)')
    else:
        hasil['backend'] = (False, 'tidak dijalankan')
    
    print()
    
    # Cek kegagalan
    gagal = []
    if frontend_proc and not hasil['frontend'][0]:
        gagal.append('frontend')
        print('Frontend gagal siap. Isi log logs/frontend.log:')
        ekor_log(os.path.join(LOG_DIR, 'frontend.log'))
    if backend_proc and not hasil['backend'][0]:
        gagal.append('backend')
        print('Backend gagal siap. Isi log logs/backend.log:')
        ekor_log(os.path.join(LOG_DIR, 'backend.log'))
    if gagal:
        print('Gagal memulai: ' + ', '.join(gagal) + '.')
        bersihkan_proses()
        sys.exit(1)
    
    fe_hidup = hasil['frontend'][0]
    be_hidup = hasil['backend'][0]
    
    if frontend_proc is None and backend_proc is None:
        print('Tidak ada layanan yang dijalankan launcher (semua port sudah dipakai).')
        return
    
    # Status panel
    if fe_hidup and be_hidup:
        print('SEMUA LAYANAN SIAP')
    elif fe_hidup:
        print('FRONTEND SIAP (backend tidak aktif)')
    else:
        print('HANYA BACKEND YANG AKTIF')
    
    print('Frontend: ' + FRONTEND_URL + ' ' + ('[HIDUP]' if fe_hidup else '[MATI]'))
    if php_ada:
        print('Backend: ' + BACKEND_URL + ' ' + ('[HIDUP]' if be_hidup else '[MATI]'))
        print('Health: ' + BACKEND_HEALTH_URL)
    
    # Susun layanan
    layanan = []
    if frontend_proc:
        layanan.append({'nama': 'frontend', 'proc': frontend_proc})
    if backend_proc:
        layanan.append({'nama': 'backend', 'proc': backend_proc})
    
    print('Tekan Ctrl+C untuk menghentikan semua server.')
    
    # Buka browser
    if os.environ.get('GAMEKU_BUKA_BROWSER', '1') == '1':
        tujuan = FRONTEND_URL if fe_hidup else BACKEND_URL
        try:
            webbrowser.open(tujuan)
            print('Browser dibuka: ' + tujuan)
        except Exception as e:
            print('Tidak dapat membuka browser: ' + str(e))
    
    # Dashboard loop
    print('Berikan perintah untuk mengendalikan launcher.')
    while running:
        poll_processes()
        clear_screen()
        draw_header()
        draw_log_panel('frontend', log_buffer.get('frontend', deque()))
        draw_log_panel('backend', log_buffer.get('backend', deque()))
        draw_status_panel()
        print()
        print('Menu: 1=Frontend | 2=Backend | 3=All | C=Clear | R=Restart | Q=Keluar')
        print('Filewatch: ' + str(len(globals().get('filewatch_mtime', {}))) + ' file dipantau')
        
        ch = handle_input()
        if ch:
            if ch in ('q', 'Q'):
                running = False
            elif ch in ('r', 'R'):
                print('Restart diprogram...')
                bersihkan_proses()
            elif ch in ('c', 'C'):
                clear_screen()
            elif ch in ('1', '2', '3'):
                log_filter = 'frontend' if ch == '1' else ('backend' if ch == '2' else 'both')
                print('Log filter: ' + log_filter)
        
        if watch_files(globals().get('filewatch_mtime', {})):
            print('File berubah terdeteksi.')
        
        time.sleep(INTERVAL_DRAW)
    
    print('Shutdown dimulai...')
    bersihkan_proses()
    print('Semua proses dihentikan.')


if __name__ == '__main__':
    siapkan_konsol()
    main()

