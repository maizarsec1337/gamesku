#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Launcher otomatis untuk Gameku.store
Menjalankan frontend (React/Vite) dan backend (PHP) secara bersamaan.

Dibuat berdasarkan konfigurasi nyata repository Gameku.store:
  - Frontend: npm run dev  (Vite, port 5173, proxy /api -> http://localhost:8000)
  - Backend:  php -S localhost:8000 -t . api/index.php  (port 8000)
  - Health:   http://localhost:8000/api/sehat

Hanya menggunakan Python standard library. Tidak mengubah file project apa pun.
"""

import atexit
import ctypes
import os
import signal
import socket
import subprocess
import sys
import time
import webbrowser
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

# ============================================================
# Konfigurasi (diverifikasi dari repository)
# ============================================================
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

FRONTEND_PORT = 5173
BACKEND_PORT = 8000
FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"
BACKEND_URL = f"http://localhost:{BACKEND_PORT}"
BACKEND_HEALTH_URL = f"http://localhost:{BACKEND_PORT}/api/sehat"

def resolve_cmd(cmd):
    """Pada Windows, beberapa berkas berskrip (seperti npm) hanya ada sebagai
    .cmd. Python subprocess tanpa shell=True tidak selalu me-resolve .cmd,
    jadi coba cmd dulu, lalu cmd + '.cmd' di Windows."""
    if os.name == "nt":
        for c in [cmd, cmd + ".cmd"]:
            try:
                subprocess.run([c, "--version"], capture_output=True, timeout=3)
                return c
            except FileNotFoundError:
                continue
            except Exception:
                continue
    return cmd

NPM_CMD = resolve_cmd("npm")
PHP_CMD = resolve_cmd("php")

FRONTEND_CMD = [NPM_CMD, "run", "dev"]
BACKEND_CMD = [PHP_CMD, "-S", f"localhost:{BACKEND_PORT}", "-t", ".", "api/index.php"]

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
# Aktifkan ANSI VT mode di Windows (PowerShell / CMD)
# ============================================================
def enable_ansi_windows():
    if os.name != "nt":
        return
    try:
        kernel32 = ctypes.windll.kernel32
        STD_OUTPUT_HANDLE = -11
        hOut = kernel32.GetStdHandle(STD_OUTPUT_HANDLE)
        if hOut == 0:
            return
        mode = ctypes.c_uint32()
        if kernel32.GetConsoleMode(hOut, ctypes.byref(mode)):
            ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
            kernel32.SetConsoleMode(hOut, mode.value | ENABLE_VIRTUAL_TERMINAL_PROCESSING)
    except Exception:
        pass

enable_ansi_windows()

# ============================================================
# Utilitas
# ============================================================
def cek_port(port):
    """Cek apakah port sedang digunakan."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0

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

# ============================================================
# Manajemen Proses Anak
# ============================================================
proses_anak = []

def bersihkan_proses():
    """Hentikan semua proses anak saat keluar."""
    for p in proses_anak:
        if p and p.poll() is None:
            try:
                p.terminate()
                p.wait(timeout=5)
            except Exception:
                try:
                    p.kill()
                except Exception:
                    pass

def handler_ctrl_c(signum, frame):
    print(f"\n\n{YELLOW}[!] Menerima sinyal penghentian (Ctrl+C){RESET}")
    print(f"{CYAN}Menghentikan semua server...{RESET}")
    bersihkan_proses()
    print(f"{GREEN}{SYMBOL_OK} Semua proses telah dihentikan.{RESET}")
    sys.exit(0)

signal.signal(signal.SIGINT, handler_ctrl_c)
atexit.register(bersihkan_proses)

# ============================================================
# Animasi Loading
# ============================================================
def animasi_loading(pesan, durasi=2.0):
    """Tampilkan animasi loading dengan karakter ASCII spinner."""
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
def cek_dependensi():
    """Cek ketersediaan Node.js, npm, dan PHP."""
    hasil = {}

    for nama, cmd in [("node", ["node", "--version"]),
                      ("npm", [NPM_CMD, "--version"]),
                      ("php", [PHP_CMD, "-v"])]:
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            if r.returncode == 0:
                versi = r.stdout.strip().split("\n")[0] if r.stdout.strip() else "terinstall"
                hasil[nama] = (True, versi)
            else:
                hasil[nama] = (False, "tidak dapat dijalankan")
        except FileNotFoundError:
            hasil[nama] = (False, "tidak terinstall")
        except Exception:
            hasil[nama] = (False, "error")

    return hasil

# ============================================================
# Tampilan
# ============================================================
def tampilkan_banner():
    print(f"{MAGENTA}{BOLD}{BANNER}{RESET}")
    print(f"{CYAN}Launcher Otomatis Gameku.store{RESET}")
    print(f"{DIM}Root: {ROOT_DIR}{RESET}")
    print()

def tampilkan_status_dependensi(deps):
    print(f"{BLUE}[1/4]{RESET} Pemeriksaan Dependensi")
    print(f"  {DIM}────────────────────────────────────────{RESET}")

    for nama in ["node", "npm", "php"]:
        tersedia, versi = deps[nama]
        simbol = SYMBOL_OK if tersedia else SYMBOL_ERROR
        warna = GREEN if tersedia else RED
        print(f"  {warna}{simbol}{RESET} {nama.capitalize():8s} → {versi}")

    node_npm_ok = deps["node"][0] and deps["npm"][0]
    php_ada = deps["php"][0]

    if not node_npm_ok:
        print(f"\n  {RED}{SYMBOL_ERROR} Node.js / npm tidak tersedia. Frontend tidak dapat dijalankan.{RESET}")
    if not php_ada:
        print(f"\n  {YELLOW}{SYMBOL_WARN} PHP tidak tersedia. Backend akan dilewati (hanya frontend).{RESET}")

    print(f"  {DIM}────────────────────────────────────────{RESET}")
    print()
    return node_npm_ok, php_ada

def tampilkan_status_frontend(port_digunakan):
    print(f"{BLUE}[2/4]{RESET} Frontend (React + Vite)")
    print(f"  {DIM}────────────────────────────────────────{RESET}")
    print(f"  {DIM}Perintah:{RESET} npm run dev")
    print(f"  {DIM}Direktori:{RESET} frontend/")
    print(f"  {DIM}Port:{RESET} {FRONTEND_PORT}")
    if port_digunakan:
        print(f"  {YELLOW}{SYMBOL_WARN}{RESET} Port {FRONTEND_PORT} sudah digunakan.")
    print(f"  {DIM}────────────────────────────────────────{RESET}")
    print()

def tampilkan_status_backend(php_ada, port_digunakan):
    print(f"{BLUE}[3/4]{RESET} Backend (PHP API)")
    print(f"  {DIM}────────────────────────────────────────{RESET}")
    print(f"  {DIM}Perintah:{RESET} php -S localhost:8000 -t . api/index.php")
    print(f"  {DIM}Direktori:{RESET} backend/")
    print(f"  {DIM}Port:{RESET} {BACKEND_PORT}")
    if not php_ada:
        print(f"  {RED}{SYMBOL_ERROR}{RESET} PHP tidak terinstall.")
    if port_digunakan:
        print(f"  {YELLOW}{SYMBOL_WARN}{RESET} Port {BACKEND_PORT} sudah digunakan.")
    print(f"  {DIM}────────────────────────────────────────{RESET}")
    print()

# ============================================================
# Jalankan Server
# ============================================================
def jalankan_frontend():
    env = os.environ.copy()
    env["API_PROXY"] = BACKEND_URL

    proc = subprocess.Popen(
        FRONTEND_CMD,
        cwd=FRONTEND_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    proses_anak.append(proc)
    return proc

def jalankan_backend():
    proc = subprocess.Popen(
        BACKEND_CMD,
        cwd=BACKEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    proses_anak.append(proc)
    return proc

# ============================================================
# Tunggu hingga siap
# ============================================================
def tunggu_sampai_siap(frontend_proc, backend_proc, frontend_aktif, backend_aktif, timeout=60):
    """Tunggu hingga semua server yang aktif siap atau timeout."""
    mulai = time.time()
    frontend_siap = False
    backend_siap = False

    while time.time() - mulai < timeout:
        if frontend_aktif and not frontend_siap:
            if cek_port(FRONTEND_PORT):
                frontend_siap = True
            elif frontend_proc.poll() is not None:
                print(f"\n  {RED}{SYMBOL_ERROR} Frontend berhenti dengan kode keluar: {frontend_proc.returncode}{RESET}")
                return False, False

        if backend_aktif and not backend_siap:
            if cek_http(BACKEND_HEALTH_URL):
                backend_siap = True
            elif backend_proc.poll() is not None:
                print(f"\n  {RED}{SYMBOL_ERROR} Backend berhenti dengan kode keluar: {backend_proc.returncode}{RESET}")
                return False, False

        if (not frontend_aktif or frontend_siap) and (not backend_aktif or backend_siap):
            return True, True

        elapsed = int(time.time() - mulai)
        sisa = max(0, timeout - elapsed)
        status_parts = []
        if frontend_aktif:
            status_parts.append(f"Frontend: {'siap' if frontend_siap else 'memuat...'}")
        if backend_aktif:
            status_parts.append(f"Backend: {'siap' if backend_siap else 'memuat...'}")

        frame = SYMBOL_LOADING[int(time.time() * 10) % len(SYMBOL_LOADING)]
        sys.stdout.write(f"\r{CYAN}{frame}{RESET} Menunggu server siap | {' | '.join(status_parts)} | {format_detik(sisa)} tersisa   ")
        sys.stdout.flush()
        time.sleep(0.5)

    print()
    return (not frontend_aktif or frontend_siap), (not backend_aktif or backend_siap)

# ============================================================
# Main
# ============================================================
def main():
    tampilkan_banner()

    animasi_loading("Memulai launcher Gameku.store...", 1.5)

    # 1. Pemeriksaan dependensi
    deps = cek_dependensi()
    node_npm_ok, php_ada = tampilkan_status_dependensi(deps)

    if not node_npm_ok:
        print(f"{RED}{SYMBOL_ERROR} Tidak dapat melanjutkan: Node.js dan npm diperlukan.{RESET}")
        sys.exit(1)

    # 2. Cek port yang sudah digunakan
    frontend_port_digunakan = cek_port(FRONTEND_PORT)
    backend_port_digunakan = cek_port(BACKEND_PORT)

    if frontend_port_digunakan:
        print(f"  {YELLOW}{SYMBOL_WARN}{RESET} Port {FRONTEND_PORT} sudah digunakan oleh proses lain.")
    if backend_port_digunakan:
        print(f"  {YELLOW}{SYMBOL_WARN}{RESET} Port {BACKEND_PORT} sudah digunakan oleh proses lain.")

    print()

    # 3. Status frontend & backend
    tampilkan_status_frontend(frontend_port_digunakan)
    tampilkan_status_backend(php_ada, backend_port_digunakan)

    # 4. Animasi memulai
    animasi_loading("Menyalankan server pengembangan...", 1.0)

    print(f"{BLUE}[4/4]{RESET} Status Server")
    print(f"  {DIM}────────────────────────────────────────{RESET}")

    frontend_proc = None
    backend_proc = None

    # Jalankan frontend
    if not frontend_port_digunakan:
        print(f"  {CYAN}{SYMBOL_INFO}{RESET} Memulai frontend (Vite) pada port {FRONTEND_PORT}...")
        frontend_proc = jalankan_frontend()
    else:
        print(f"  {YELLOW}{SYMBOL_WARN}{RESET} Frontend dilewati (port {FRONTEND_PORT} sudah digunakan).")

    # Jalankan backend
    if php_ada and not backend_port_digunakan:
        print(f"  {CYAN}{SYMBOL_INFO}{RESET} Memulai backend (PHP) pada port {BACKEND_PORT}...")
        backend_proc = jalankan_backend()
    elif not php_ada:
        print(f"  {YELLOW}{SYMBOL_WARN}{RESET} Backend dilewati (PHP tidak tersedia).")
    else:
        print(f"  {YELLOW}{SYMBOL_WARN}{RESET} Backend dilewati (port {BACKEND_PORT} sudah digunakan).")

    # Tunggu sampai siap
    frontend_aktif = frontend_proc is not None
    backend_aktif = backend_proc is not None

    frontend_siap, backend_siap = tunggu_sampai_siap(
        frontend_proc, backend_proc, frontend_aktif, backend_aktif
    )

    print(f"  {DIM}────────────────────────────────────────{RESET}")

    semua_siap = (not frontend_aktif or frontend_siap) and (not backend_aktif or backend_siap)

    if semua_siap:
        print(f"\n{GREEN}{BOLD}{SYMBOL_OK} ALL SERVICES READY{RESET}\n")

        print(f"{CYAN}┌─────────────────────────────────────────┐{RESET}")
        print(f"{CYAN}│{RESET}  {GREEN}Frontend:{RESET}      {FRONTEND_URL}")
        if backend_aktif:
            print(f"{CYAN}│{RESET}  {GREEN}Backend/API:{RESET}   {BACKEND_URL}")
            print(f"{CYAN}│{RESET}  {GREEN}Health Check:{RESET}  {BACKEND_HEALTH_URL}")
        print(f"{CYAN}└─────────────────────────────────────────┘{RESET}\n")

        print(f"{DIM}Tekan Ctrl+C untuk menghentikan semua server.{RESET}\n")

        # Buka browser ke frontend
        try:
            webbrowser.open(FRONTEND_URL)
            print(f"{GREEN}{SYMBOL_OK}{RESET} Browser dibuka: {FRONTEND_URL}")
        except Exception as e:
            print(f"{YELLOW}{SYMBOL_WARN}{RESET} Tidak dapat membuka browser: {e}")

        # Pantau proses sampai salah satu mati atau user tekan Ctrl+C
        try:
            while True:
                time.sleep(1)
                if frontend_proc and frontend_proc.poll() is not None:
                    print(f"\n{RED}{SYMBOL_ERROR} Frontend berhenti tidak terduga (kode: {frontend_proc.returncode}){RESET}")
                    break
                if backend_proc and backend_proc.poll() is not None:
                    print(f"\n{RED}{SYMBOL_ERROR} Backend berhenti tidak terduga (kode: {backend_proc.returncode}){RESET}")
                    break
        except KeyboardInterrupt:
            pass
    else:
        print(f"\n{RED}{SYMBOL_ERROR} Gagal memulai semua layanan.{RESET}")
        if frontend_aktif and not cek_port(FRONTEND_PORT):
            print(f"  {RED}Frontend tidak merespons pada port {FRONTEND_PORT}.{RESET}")
        if backend_aktif and not cek_http(BACKEND_HEALTH_URL):
            print(f"  {RED}Backend tidak merespons pada {BACKEND_HEALTH_URL}.{RESET}")
        bersihkan_proses()
        sys.exit(1)


if __name__ == "__main__":
    main()