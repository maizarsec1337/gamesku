# -*- coding: utf-8 -*-
"""
Gameku Store — Desktop Control Center (Windows GUI)
Aplikasi desktop untuk mengelola frontend (Vite) dan backend (PHP)
secara bersamaan dengan live shell, deteksi error, dan pemantauan
perubahan file. Tidak memerlukan terminal sebagai antarmuka utama.eteksi error, dan pemantauan
perubahan file. Tidak memerlukan terminal sebagai antarmuka utama.

Ditulis ulang dari versi terminal (jalan.py lama disimpan sebagai
jalan.py.bak). Semua command frontend/backend dipertahankan sesuai
konfigurasi project asli.
"""

from __future__ import annotations

import atexit
import ctypes
import hashlib
import os
import json
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from collections import deque
import argparse
import random
import queue
import re
import platform
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import webbrowser

# Import runtime PHP lokal (tidak mengubah php.ini global)
try:
    from php_runtime import perintah_php, php_executable
except Exception:  # pragma: no cover - fallback jika php_runtime tidak ada
    def php_executable():
        return shutil.which("php")

    def perintah_php():
        return ["php"]

# ============================================================
# Konfigurasi (diverifikasi dari repository)
# ============================================================
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(ROOT_DIR, "gameku.store")
FRONTEND_DIR = os.path.join(APP_DIR, "frontend")
BACKEND_DIR = os.path.join(APP_DIR, "backend")
LOG_DIR = os.path.join(APP_DIR, "logs")

FRONTEND_PORT = 5173
BACKEND_PORT = 8000
FRONTEND_URL = "http://localhost:%d" % FRONTEND_PORT
BACKEND_URL = "http://localhost:%d" % BACKEND_PORT
BACKEND_HEALTH_URL = "http://localhost:%d/api/sehat" % BACKEND_PORT

def deteksi_ip_hotspot():
    """Deteksi otomatis IPv4 adapter hotspot Windows (tanpa hardcode IP)."""
    try:
        cmd = [
            "powershell", "-NoProfile", "-Command",
            "Get-NetIPAddress -AddressFamily IPv4 | "
            "Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | "
            "Select-Object InterfaceAlias, IPAddress | ConvertTo-Json -Compress",
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=10,
                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        data = json.loads((r.stdout or "").strip() or "[]")
        if isinstance(data, dict):
            data = [data]
        hotspot = None
        lainnya = []
        for item in data:
            alias = str(item.get("InterfaceAlias", ""))
            ip = str(item.get("IPAddress", ""))
            if not ip:
                continue
            lainnya.append(ip)
            low = alias.lower()
            if ("*" in alias or "wi-fi direct" in low or "hotspot" in low):
                hotspot = ip
                break
        if hotspot:
            return hotspot
        for ip in lainnya:
            if ip.startswith(("10.", "172.", "192.168.")):
                return ip
        return lainnya[0] if lainnya else None
    except Exception:
        return None

HOTSPOT_IP = deteksi_ip_hotspot()
FRONTEND_URL_HOTSPOT = ("http://%s:%d" % (HOTSPOT_IP, FRONTEND_PORT)) if HOTSPOT_IP else None
BACKEND_URL_HOTSPOT = ("http://%s:%d" % (HOTSPOT_IP, BACKEND_PORT)) if HOTSPOT_IP else None
HOTSPOT_SUBNET = ("%s.0/24" % ".".join(HOTSPOT_IP.split(".")[:3])) if HOTSPOT_IP else None

NPM_CMD = shutil.which("npm")
PHP_CMD = php_executable()  # Termasuk runtime lokal di luar PATH.

# ============================================================
# Warna tema premium dark (ALVIN JMBOD)
# ============================================================
# Warna utama: Hitam, Graphite, Ungu, Cyan
COLOR_BG = "#121216"      # Hitam dalam - latar utama
COLOR_BG2 = "#1e1e2e"     # Graphite - card/latar secondary
COLOR_BG3 = "#252535"     # Ungu-abu - elemen detail
COLOR_FG = "#e0e0e8"      # Teks utama
COLOR_SUBTLE = "#787888"  # Teks secondary
COLOR_ACCENT = "#00d4aa"  # Cian hijau tua - aksen utama
COLOR_ACCENT2 = "#00f5c4" # Cian terang - hover/active
COLOR_WARNING = "#ffab00" # Kuning peringatan
COLOR_ERROR = "#ff5f57"   # Merah error
COLOR_SUCCESS = "#00d4aa" # Hijau sukses
COLOR_INFO = "#7fdbff"    # Biru info
COLOR_BORDER = "#3e3e52"  # Border separator
COLOR_RING = "#664aff"    # Ungu krem - fokus/indikator

# Tipografi yang dipakai oleh layout utama.
# Didefinisikan di level modul agar semua frame Tkinter dapat
# menggunakannya saat aplikasi mulai dibuat.
FONT_TITLE = ("Segoe UI", 18, "bold")
FONT_SUBTITLE = ("Segoe UI", 10, "bold")
FONT_BODY = ("Segoe UI", 10)
FONT_SMALL = ("Segoe UI", 9)
FONT_BORDER = ("Segoe UI", 9, "bold")

# ============================================================
# Authentifikasi (hash password dengan salt, tidak plaintext)
# ============================================================
SALT_ROUNDS = 150000  # PBKDF2 rounds - seimbang keamanan & performa
USER_DATA_FILE = os.path.join(ROOT_DIR, ".credentials.json")
# Kredensial disimpan setelah hash dengan salt unik
# Diload dari .credentials.json atau generated dari DEFAULT_USERS
CREDENTIALS_FILE = os.path.join(ROOT_DIR, ".credentials.json")

def _load_credentials():
    """Load credentials from JSON file, generate from defaults if not exists."""
    if os.path.exists(CREDENTIALS_FILE):
        with open(CREDENTIALS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    # Generate from DEFAULT_USERS if file doesn't exist
    creds = {}
    for username, password in DEFAULT_USERS.items():
        salt = os.urandom(16).hex()
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), SALT_ROUNDS)
        creds[username] = {"hash": dk.hex(), "salt": salt}
    with open(CREDENTIALS_FILE, "w", encoding="utf-8") as f:
        json.dump(creds, f, indent=2)
    return creds

def _verify_password(username, password, creds):
    """Verify password using PBKDF2-HMAC-SHA256 with stored hash/salt."""
    if username not in creds:
        return False
    stored = creds[username]
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(stored["salt"]),
        SALT_ROUNDS,
    )
    return dk.hex() == stored["hash"]


# Akun default yang harus ada setelah instalasi pertama
DEFAULT_USERS = {
    "adminravi": "admin123",
    "maizardev": "admin123",
}

# Kredensial disimpan setelah hash dengan salt unik
MAX_LOG_LINES = 2000     # batas baris log per layanan (hindari memory leak)

# Direktori yang diabaikan saat memantau perubahan file
IGNORE_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build", ".next", "vendor", "logs"}
ERROR_PATTERN = re.compile(r"\b(error|failed|failure|fatal|exception|traceback|EADDRINUSE|ENOENT|SyntaxError|TypeError)\b", re.I)
ANSI_PATTERN = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")

# Parse command line arguments for project directory
parser = argparse.ArgumentParser(description='ALVIN JMBOD Desktop Control Center')
parser.add_argument('--directory', '-d', default=None, help='Project directory (default: directory containing jalan.py)')
args = parser.parse_args()

# Determine the project directory
if args.directory:
    PROJECT_DIR = os.path.abspath(args.directory)
else:
    # Use the directory containing this script
    PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

# Change to the project directory to ensure relative paths work correctly
os.chdir(PROJECT_DIR)

# Recalculate ROOT_DIR after changing directory
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

# Palet ungu gelap untuk seluruh jendela, termasuk layar login.
COLOR_BG = "#100d1e"
COLOR_BG2 = "#171329"
COLOR_BG3 = "#211a39"
COLOR_PANEL_BG = "#211a39"
COLOR_FG = "#f3efff"
COLOR_SUBTLE = "#a69dbd"
COLOR_ACCENT = "#a78bfa"
COLOR_ACCENT2 = "#c7b7ff"
COLOR_SUCCESS = "#74dec3"
COLOR_WARNING = "#f4be79"
COLOR_ERROR = "#fb839a"
COLOR_INFO = "#bbaaff"
COLOR_BORDER = "#352b50"

LEVEL_COLORS = {
    "INFO": COLOR_INFO,
    "WARNING": COLOR_WARNING,
    "ERROR": COLOR_ERROR,
    "DEBUG": "#b4befe",
    "FRONTEND": COLOR_ACCENT,
    "BACKEND": COLOR_SUCCESS,
    "SYSTEM": COLOR_INFO,
}

STATUS_STOPPED = "STOPPED"
STATUS_STARTING = "STARTING"
STATUS_RUNNING = "RUNNING"
STATUS_ERROR = "ERROR"
FRONTEND_CMD = [NPM_CMD or "npm", "run", "dev", "--", "--host", "0.0.0.0", "--strictPort"]
BACKEND_CMD = (perintah_php() + ["-S", f"0.0.0.0:{BACKEND_PORT}", "-t", ".", "api/index.php"]) if PHP_CMD else []
FLAG_POPEN = {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0)} if os.name == "nt" else {"start_new_session": True}
WAKTU_TUNGGU_FRONTEND = 90
WAKTU_TUNGGU_BACKEND = 30
INTERVAL_HEALTH = 5
INTERVAL_FILEWATCH = 2


class DeviceMonitor:
    """Lightweight Windows CPU/RAM sampler plus disk usage for the project drive."""

    class FileTime(ctypes.Structure):
        _fields_ = [("low", ctypes.c_ulong), ("high", ctypes.c_ulong)]

    class MemoryStatus(ctypes.Structure):
        _fields_ = [
            ("length", ctypes.c_ulong), ("load", ctypes.c_ulong),
            ("total_phys", ctypes.c_ulonglong), ("avail_phys", ctypes.c_ulonglong),
            ("total_page", ctypes.c_ulonglong), ("avail_page", ctypes.c_ulonglong),
            ("total_virtual", ctypes.c_ulonglong), ("avail_virtual", ctypes.c_ulonglong),
            ("avail_extended", ctypes.c_ulonglong),
        ]

    def __init__(self):
        self.previous_cpu = self._cpu_times()

    def _cpu_times(self):
        if os.name != "nt":
            return None
        idle, kernel, user = self.FileTime(), self.FileTime(), self.FileTime()
        if not ctypes.windll.kernel32.GetSystemTimes(ctypes.byref(idle), ctypes.byref(kernel), ctypes.byref(user)):
            return None
        value = lambda item: (item.high << 32) | item.low
        return value(idle), value(kernel), value(user)

    def snapshot(self):
        now = self._cpu_times()
        cpu = None
        if now and self.previous_cpu:
            idle = now[0] - self.previous_cpu[0]
            total = now[1] - self.previous_cpu[1] + now[2] - self.previous_cpu[2]
            if total > 0:
                cpu = max(0.0, min(100.0, 100.0 * (1.0 - idle / total)))
        self.previous_cpu = now

        memory = self.MemoryStatus()
        memory.length = ctypes.sizeof(memory)
        if os.name == "nt" and ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(memory)):
            ram_total = memory.total_phys
            ram_used = ram_total - memory.avail_phys
        else:
            ram_total = ram_used = 0
        disk = shutil.disk_usage(APP_DIR)
        return {
            "cpu": cpu,
            "ram_used": ram_used, "ram_total": ram_total,
            "disk_used": disk.used, "disk_total": disk.total,
        }
# ============================================================
# Class ProcessEntry — menyimpan informasi satu proses
# ============================================================
class ProcessEntry:
    """Mencatat detail proses yang dijalankan (frontend/backends)."""

    def __init__(self, nama, cmd, cwd=None):
        self.nama = nama
        self.cmd = cmd
        self.cwd = cwd or ROOT_DIR
        self.proc = None
        self.log_file = os.path.join(LOG_DIR, "{}.log".format(nama.lower()))
        self.start_time = None
        self.status = STATUS_STOPPED
        self.exit_code = None
        self.health = False  # apakah health check lolos
        self.mtime_snapshot = None  # untuk file watcher

    def __repr__(self):
        return "ProcessEntry(nama={}, status={})".format(self.nama, self.status)
# ============================================================
# Class ProcessManager — mengelola start/stop/monitoring
# ============================================================
class ProcessManager:
    """Mengelola siklus hidup proses frontend dan backend."""

    def __init__(self, app_gui=None):
        self.app_gui = app_gui  # referensi ke GUI untuk update antarmuka
        self.frontend = None
        self.backend = None
        self.running = False
    def start_frontend(self):
        """Menjalankan Vite dev server sebagai proses anak."""
        if self.frontend and self.frontend.proc and self.frontend.proc.poll() is None:
            self._tampilkan_status("Frontend sudah berjalan.")
            return

        self.frontend = ProcessEntry("frontend", FRONTEND_CMD, cwd=FRONTEND_DIR)

        if self._port_in_use(FRONTEND_PORT):
            self._tampilkan_error(f"Port {FRONTEND_PORT} sudah dipakai. Hentikan Vite lama sebelum memulai frontend.")
            self.frontend.status = STATUS_ERROR
            return

        try:
            self.frontend.proc = subprocess.Popen(
                self.frontend.cmd,
                cwd=self.frontend.cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                **FLAG_POPEN,
            )
            threading.Thread(target=self._read_output, args=("frontend", self.frontend.proc), daemon=True).start()
            self.frontend.start_time = time.time()
            self.frontend.status = STATUS_STARTING
            self._tampilkan_status("Frontend dimulai (proses anak PID %d)..." % self.frontend.proc.pid)
        except Exception as e:
            self._tampilkan_error("Gagal memulai frontend: %s" % e)
            self.frontend.status = STATUS_ERROR
            self.frontend = None
            return

        # Tunggu health endpoint atau timeout
        self._tunggu_awal_frontend()

    def start_backend(self):
        """Menjalankan PHP built-in server."""
        if self.backend and self.backend.proc and self.backend.proc.poll() is None:
            self._tampilkan_status("Backend sudah berjalan.")
            return

        self.backend = ProcessEntry("backend", BACKEND_CMD, cwd=BACKEND_DIR)

        if PHP_CMD is None:
            self._tampilkan_error("PHP tidak terinstal — backend tidak bisa dijalankan.")
            self.backend.status = STATUS_ERROR
            self.backend = None
            return

        try:
            self.backend.proc = subprocess.Popen(
                self.backend.cmd,
                cwd=self.backend.cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                **FLAG_POPEN,
            )
            threading.Thread(target=self._read_output, args=("backend", self.backend.proc), daemon=True).start()
            self.backend.start_time = time.time()
            self.backend.status = STATUS_STARTING
            self._tampilkan_status("Backend dimulai (proses anak PID %d)..." % self.backend.proc.pid)
        except Exception as e:
            self._tampilkan_error("Gagal memulai backend: %s" % e)
            self.backend.status = STATUS_ERROR
            self.backend = None
            return

        # Tunggu health endpoint atau timeout
        self._tunggu_awal_backend()
    def _tunggu_awal_frontend(self):
        """Menunggu Vite siap (melalui health check atau port)."""
        dari = time.time()
        while time.time() - dari < WAKTU_TUNGGU_FRONTEND:
            # Cek proses masih hidup
            if not self.frontend.proc or self.frontend.proc.poll() is not None:
                self._handle_process_exit("frontend")
                return
            # Cek HTTP port
            if self._cek_http(FRONTEND_URL, timeout=2):
                self.frontend.status = STATUS_RUNNING
                self._tampilkan_status("Frontend siap di %s" % FRONTEND_URL)
                return
            time.sleep(1)
        # Timeout
        self.frontend.status = STATUS_ERROR
        self._tampilkan_error("Frontend timeout — tidak respons dalam %d detik." % WAKTU_TUNGGU_FRONTEND)
        self._hentikan_frontend(False)
    def _tunggu_awal_backend(self):
        """Menunggu PHP server siap."""
        dari = time.time()
        while time.time() - dari < WAKTU_TUNGGU_BACKEND:
            # Cek proses masih hidup
            if not self.backend.proc or self.backend.proc.poll() is not None:
                self._handle_process_exit("backend")
                return
            # Cek health endpoint
            # Endpoint sehat juga menguji MySQL (hingga 3 detik), jadi beri
            # ruang lebih panjang daripada cek Vite agar tidak selalu timeout.
            if self._cek_http(BACKEND_HEALTH_URL, timeout=6):
                self.backend.status = STATUS_RUNNING
                self._tampilkan_status("Backend siap di %s" % BACKEND_URL)
                return
            time.sleep(1)
        # Timeout
        self.backend.status = STATUS_ERROR
        self._tampilkan_error("Backend timeout — tidak respons dalam %d detik." % WAKTU_TUNGGU_BACKEND)
        self._hentikan_backend(False)
    def _cek_http(self, url, timeout=5):
        """Cek apakah HTTP endpoint merespons 200."""
        try:
            req = Request(url)
            with urlopen(req, timeout=timeout) as resp:
                return resp.status == 200
        except Exception:
            return False

    def _port_in_use(self, port):
        for family, socktype, proto, _, address in socket.getaddrinfo("localhost", port, type=socket.SOCK_STREAM):
            with socket.socket(family, socktype, proto) as probe:
                probe.settimeout(0.25)
                if probe.connect_ex(address) == 0:
                    return True
        return False
    def _handle_process_exit(self, which):
        """Dipanggil saat proses anak mati."""
        entry = self.frontend if which == "frontend" else self.backend
        if not entry or not entry.proc:
            return
        self._tampilkan_status("%s proses mati secara tiba-tida." % entry.nama)
        entry.status = STATUS_ERROR
        entry.exit_code = entry.proc.returncode if entry.proc else None
        if self.app_gui:
            self.app_gui.events.put(("error", which, f"Proses berhenti (exit code {entry.exit_code})."))
        # Update GUI jika ada
        if self.app_gui:
            self.app_gui.events.put(("process", which, entry.status))
        # Coba restart otomatis? Untuk now, hentikan dan tandai error.
        entry.proc = None
    def _hentikan_frontend(self, force=False):
        """ menghentikan frontend."""
        if self.frontend and self.frontend.proc:
            self._tampilkan_status("Menghentikan frontend...")
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(self.frontend.proc.pid), "/T", "/F"],
                               capture_output=True, **FLAG_POPEN)
            else:
                self.frontend.proc.terminate()
                try:
                    self.frontend.proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.frontend.proc.kill()
            self.frontend.proc = None
            self.frontend.status = STATUS_STOPPED
            self._tampilkan_status("Frontend dihentikan.")
        if self.app_gui:
            self.app_gui.events.put(("process", "frontend", STATUS_STOPPED))
    def _hentikan_backend(self, force=False):
        """ menghentikan backend."""
        if self.backend and self.backend.proc:
            self._tampilkan_status("Menghentikan backend...")
            self.backend.proc.terminate()
            try:
                self.backend.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.backend.proc.kill()
            self.backend.proc = None
            self.backend.status = STATUS_STOPPED
            self._tampilkan_status("Backend dihentikan.")
        if self.app_gui:
            self.app_gui.events.put(("process", "backend", STATUS_STOPPED))
    def stop_all(self):
        """Hentikan frontend dan backend."""
        self._tampilkan_status("Menghentikan semua...")
        self._hentikan_frontend()
        self._hentikan_backend()
        self.running = False
    def poll_processes(self):
        """Cek status proses yang masih berjalan (untuk dashboard)."""
        for which, entry in [("frontend", self.frontend), ("backend", self.backend)]:
            if entry and entry.proc:
                if entry.proc.poll() is not None:
                    self._handle_process_exit(which)
    def _read_output(self, which, proc):
        """Read child output continuously so Vite/PHP cannot block on a full pipe."""
        try:
            for line in proc.stdout:
                clean = ANSI_PATTERN.sub("", line).rstrip("\r\n")
                if clean and self.app_gui:
                    self.app_gui.events.put(("log", which, clean))
        finally:
            proc.stdout.close()
    def _tampilkan_status(self, msg):
        """Tampilkan pesan ke GUI status bar (dijalankan di thread utama)."""
        if self.app_gui:
            self.app_gui.events.put(("status", msg, False))
        else:
            print("[STATUS] " + msg)

    def _tampilkan_error(self, msg):
        """Tampilkan error ke GUI."""
        if self.app_gui:
            self.app_gui.events.put(("status", "ERROR: " + msg, True))
            self.app_gui.events.put(("error", "system", msg))
        else:
            print("[ERROR] " + msg)
class ControlCenterApp(tk.Tk):
    """Main application window for Gameku Store Desktop Control Center."""

    def __init__(self):
        super().__init__()
        self.title("ALVIN JMBOD — Desktop Control Center")
        self.geometry("1280x820")
        self.minsize(980, 680)

        # Configure premium dark theme
        self.configure(bg=COLOR_BG)

        # Initialize process manager
        self.events = queue.Queue()
        self.manager = ProcessManager(app_gui=self)
        self.device_monitor = DeviceMonitor()

        # State tracking
        self.current_page = "overview"
        self.running_services = set()
        self.log_scroll_pos = 0
        self.paused_log_scroll = False
        self.pages = {}
        self.file_snapshots = {}
        self.error_count = 0
        self.file_change_count = 0
        self.command_running = False
        self.shell_proc = None
        self.started_at = time.monotonic()
        self.rain_enabled = True
        self.rain_job = None
        self._pulse_on = False

        # ============ Layout Configuration ============
        # Grid weights: sidebar 280px, main content fills rest
        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(1, weight=1)

        # Create header
        self._create_header()

        # Create sidebar navigation
        self._create_sidebar()

        # Create main content area
        self.main_content = tk.Frame(self, bg=COLOR_BG2)
        self.main_content.grid(row=1, column=1, sticky="nsew", padx=0, pady=0)
        self.main_content.grid_rowconfigure(0, weight=1)
        self.main_content.grid_columnconfigure(0, weight=1)

        # Create content frames (cards/panels)
        self._create_content_panels()
        self._create_status_bar()

        # Initialize display
        self._update_process_status("frontend", STATUS_STOPPED)
        self._update_process_status("backend", STATUS_STOPPED)

        # Protocol untuk menutup aplikasi
        self.protocol("WM_DELETE_WINDOW", self._on_closing)

        self.attributes("-alpha", 0.0)
        self._fade_started = time.monotonic()
        self.after(16, self._fade_in)
        self.after(1000, self._poll_services)
        self.after(1000, self._refresh_device_stats)
        self.after(100, self._drain_events)
        self.file_snapshots = self._scan_source_files()
        self.after(2000, self._watch_source_files)
        self.after(100, self._animate_rain)
        self.after(650, self._animate_indicator)
    def _create_sidebar(self):
        self.sidebar = tk.Frame(self, bg=COLOR_BG2, width=224)
        self.sidebar.grid(row=0, column=0, rowspan=2, sticky="nsew")
        self.sidebar.grid_propagate(False)
        self.sidebar.grid_columnconfigure(0, weight=1)
        self.sidebar.grid_rowconfigure(3, weight=1)

        brand = tk.Frame(self.sidebar, bg=COLOR_BG2)
        brand.grid(row=0, column=0, sticky="ew", padx=22, pady=(29, 26))
        tk.Label(brand, text="◆  GAMEKU", bg=COLOR_BG2, fg=COLOR_ACCENT2,
                 font=("Segoe UI", 16, "bold")).pack(anchor="w")
        tk.Label(brand, text="CONTROL CENTER", bg=COLOR_BG2, fg=COLOR_SUBTLE,
                 font=("Segoe UI", 9, "bold")).pack(anchor="w", pady=(3, 0))

        tk.Label(self.sidebar, text="WORKSPACE", bg=COLOR_BG2, fg=COLOR_SUBTLE,
                 font=("Segoe UI", 9, "bold")).grid(row=1, column=0, sticky="w", padx=22)
        nav = tk.Frame(self.sidebar, bg=COLOR_BG2)
        nav.grid(row=2, column=0, sticky="ew", padx=12, pady=(10, 0))
        self.nav_buttons = {}
        for page, label in (("overview", "◈   Overview"), ("statistics", "▥   Statistik"),
                            ("services", "▣   Services"),
                            ("console", ">_   Console"), ("files", "▤   Files"),
                            ("errors", "◇   Diagnostics"),
                            ("about", "○   About")):
            button = tk.Button(nav, text=label, bg=COLOR_BG2, fg=COLOR_SUBTLE,
                               activebackground=COLOR_BG3, activeforeground=COLOR_FG,
                               font=("Segoe UI", 10), anchor="w", relief="flat",
                               cursor="hand2", padx=15, pady=11,
                               command=lambda p=page: self.show_page(p))
            button.pack(fill="x", pady=2)
            button.bind("<Enter>", lambda event, name=page: event.widget.configure(
                bg=COLOR_BG3, fg=COLOR_ACCENT2))
            button.bind("<Leave>", lambda event, name=page: event.widget.configure(
                bg=COLOR_BG3 if name == self.current_page else COLOR_BG2,
                fg=COLOR_ACCENT2 if name == self.current_page else COLOR_SUBTLE))
            self.nav_buttons[page] = button

        controls = tk.Frame(self.sidebar, bg=COLOR_BG2)
        controls.grid(row=4, column=0, sticky="ew", padx=18, pady=(8, 20))
        tk.Frame(controls, bg=COLOR_BORDER, height=1).pack(fill="x", pady=(0, 18))
        tk.Label(controls, text="QUICK CONTROL", bg=COLOR_BG2, fg=COLOR_SUBTLE,
                 font=("Segoe UI", 9, "bold")).pack(anchor="w", pady=(0, 10))
        self.btn_frontend = self._action_button(controls, "Start Frontend", self._on_frontend_toggle)
        self.btn_backend = self._action_button(controls, "Start Backend", self._on_backend_toggle)
        self.btn_stop_all = self._action_button(controls, "Stop All", self._on_stop_all, danger=True)
        self.lbl_status = tk.Label(controls, text="Semua layanan berhenti", bg=COLOR_BG2,
                                   fg=COLOR_SUBTLE, font=FONT_SMALL, wraplength=185)
        self.lbl_status.pack(anchor="w", pady=(12, 0))

    def _action_button(self, parent, text, command, danger=False):
        button = tk.Button(parent, text=text, command=command, relief="flat", cursor="hand2",
                           bg=COLOR_BG3 if danger else COLOR_ACCENT,
                           fg=COLOR_ERROR if danger else COLOR_BG,
                           activebackground=COLOR_ACCENT2, activeforeground=COLOR_BG,
                           font=("Segoe UI", 10, "bold"), pady=9)
        button.pack(fill="x", pady=4)
        resting = COLOR_BG3 if danger else COLOR_ACCENT
        button.bind("<Enter>", lambda event: event.widget.configure(bg=COLOR_ACCENT2, fg=COLOR_BG))
        button.bind("<Leave>", lambda event: event.widget.configure(
            bg=resting, fg=COLOR_ERROR if danger else COLOR_BG))
        return button
    def _create_content_panels(self):
        """Build a lightweight dashboard; rain is drawn only in the hero canvas."""
        self.pages_frame = tk.Frame(self.main_content, bg=COLOR_BG)
        self.pages_frame.grid(row=0, column=0, sticky="nsew")
        self.pages_frame.grid_rowconfigure(0, weight=1)
        self.pages_frame.grid_columnconfigure(0, weight=1)
        for page in ["overview", "statistics", "services", "console", "files", "errors", "about"]:
            self.pages[page] = tk.Frame(self.pages_frame, bg=COLOR_BG)
            self.pages[page].grid(row=0, column=0, sticky="nsew")

        overview = self.pages["overview"]
        self.rain_canvas = tk.Canvas(overview, height=200, bg="#18122d", highlightthickness=0)
        self.rain_canvas.pack(fill="x", padx=26, pady=(25, 0))
        self.rain_canvas.bind("<Configure>", self._reset_rain)
        self.rain_drops = []
        self.hero_title = self.rain_canvas.create_text(34, 62, text="Your workspace, in motion.",
                              fill=COLOR_FG, anchor="w", font=("Segoe UI", 24, "bold"))
        self.rain_canvas.create_text(36, 103, text="Kelola development server dengan tenang dari satu tempat.",
                                     fill=COLOR_SUBTLE, anchor="w", font=FONT_BODY)
        self.rain_canvas.create_text(36, 165, text="●  LIVE CONTROL   /   GAMEKU STORE",
                                     fill=COLOR_ACCENT2, anchor="w", font=("Segoe UI", 9, "bold"))

        content = tk.Frame(overview, bg=COLOR_BG)
        content.pack(fill="both", expand=True, padx=26, pady=24)
        tk.Label(content, text="System overview", bg=COLOR_BG, fg=COLOR_FG,
                 font=("Segoe UI", 18, "bold")).pack(anchor="w")
        tk.Label(content, text="Pantau layanan dan buka proyek dengan cepat.", bg=COLOR_BG,
                 fg=COLOR_SUBTLE, font=FONT_BODY).pack(anchor="w", pady=(3, 18))
        cards = tk.Frame(content, bg=COLOR_BG)
        cards.pack(fill="x")
        cards.grid_columnconfigure((0, 1), weight=1, uniform="cards")
        self.frontend_card, self.frontend_value = self._service_card(cards, 0, "FRONTEND", "Vite development server", FRONTEND_URL)
        self.backend_card, self.backend_value = self._service_card(cards, 1, "BACKEND", "PHP API server", BACKEND_URL)

        quick = tk.Frame(content, bg=COLOR_BG3, padx=20, pady=18)
        quick.pack(fill="x", pady=(20, 0))
        tk.Label(quick, text="Quick links", bg=COLOR_BG3, fg=COLOR_FG,
                 font=FONT_SUBTITLE).pack(anchor="w")
        tk.Label(quick, text="Buka layanan yang sedang aktif di browser.", bg=COLOR_BG3,
                 fg=COLOR_SUBTLE, font=FONT_SMALL).pack(anchor="w", pady=(3, 10))
        row = tk.Frame(quick, bg=COLOR_BG3)
        row.pack(anchor="w")
        for label, url in (("↗  Frontend", FRONTEND_URL), ("↗  Backend API", BACKEND_URL)):
            tk.Button(row, text=label, command=lambda target=url: webbrowser.open(target),
                      bg=COLOR_BG2, fg=COLOR_ACCENT2, activebackground=COLOR_ACCENT,
                      relief="flat", cursor="hand2", padx=14, pady=8,
                      font=FONT_BODY).pack(side="left", padx=(0, 10))
        tk.Button(row, text="▥  Statistik Perangkat", command=lambda: self.show_page("statistics"),
                  bg=COLOR_BG2, fg=COLOR_ACCENT2, activebackground=COLOR_ACCENT,
                  relief="flat", cursor="hand2", padx=14, pady=8,
                  font=FONT_BODY).pack(side="left")

        if HOTSPOT_IP and FRONTEND_URL_HOTSPOT:
            tk.Label(quick, text="Hotspot LAN: %s" % FRONTEND_URL_HOTSPOT, bg=COLOR_BG3,
                     fg=COLOR_WARNING, font=FONT_SMALL).pack(anchor="w", pady=(10, 4))
            tk.Button(quick, text="Salin URL Hotspot",
                      command=lambda: (self.clipboard_clear(), self.clipboard_append(FRONTEND_URL_HOTSPOT)),
                      bg=COLOR_ACCENT, fg=COLOR_BG, relief="flat", cursor="hand2",
                      padx=14, pady=6, font=FONT_SMALL).pack(anchor="w")

        self._create_statistics_page(self.pages["statistics"])

        for page, title, detail in (
            ("services", "Services", "Gunakan Quick Control di kiri untuk mengelola server."),
            ("console", "Live Shell", "Output Vite/PHP tampil langsung. Tiap perintah dijalankan dari folder yang dipilih di bawah."),
            ("files", "File Activity", "File baru, perubahan, dan penghapusan dalam frontend/src dan backend."),
            ("errors", "Diagnostics", "Error dari server dan perintah shell terdeteksi otomatis."),
            ("about", "About", "Gameku Store · Desktop Control Center"),
        ):
            frame = self.pages[page]
            tk.Label(frame, text=title, bg=COLOR_BG, fg=COLOR_FG,
                     font=("Segoe UI", 24, "bold")).pack(anchor="w", padx=34, pady=(34, 6))
            tk.Label(frame, text=detail, bg=COLOR_BG, fg=COLOR_SUBTLE,
                     font=FONT_BODY, wraplength=680, justify="left").pack(anchor="w", padx=34)
            if page == "console":
                self.console_text = self._output_panel(frame)
                command_bar = tk.Frame(frame, bg=COLOR_BG3, padx=14, pady=12)
                command_bar.pack(fill="x", padx=34, pady=(0, 24))
                self.shell_cwd = tk.StringVar(value="project")
                folder_menu = tk.OptionMenu(command_bar, self.shell_cwd, "project", "frontend", "backend")
                folder_menu.configure(bg=COLOR_BG2, fg=COLOR_FG, activebackground=COLOR_ACCENT,
                                      relief="flat", highlightthickness=0, font=FONT_BODY)
                folder_menu.pack(side="left", padx=(0, 8))
                self.shell_entry = tk.Entry(command_bar, bg=COLOR_BG2, fg=COLOR_FG,
                                            insertbackground=COLOR_FG, relief="flat", font=("Consolas", 10))
                self.shell_entry.pack(side="left", fill="x", expand=True, ipady=8)
                self.shell_entry.bind("<Return>", lambda event: self._run_shell_command())
                self.shell_button = tk.Button(command_bar, text="Run  ▶", command=self._run_shell_command,
                                              bg=COLOR_ACCENT, fg=COLOR_BG, relief="flat", cursor="hand2",
                                              font=FONT_SUBTITLE, padx=14, pady=6)
                self.shell_button.pack(side="left", padx=(8, 0))
            elif page == "files":
                self.file_text = self._output_panel(frame)
                self._append_text(self.file_text, "Watching frontend/src and backend for new and edited files.\n", "info")
            elif page == "errors":
                self.error_text = self._output_panel(frame)
                self._append_text(self.error_text, "No errors detected yet.\n", "info")
            else:
                panel = tk.Frame(frame, bg=COLOR_BG3, padx=24, pady=20)
                panel.pack(fill="x", padx=34, pady=25)
                if page == "services":
                    tk.Label(panel, text=f"Frontend  {FRONTEND_URL}\nBackend   {BACKEND_URL}\nHotspot   {FRONTEND_URL_HOTSPOT or '-'}",
                             bg=COLOR_BG3, fg=COLOR_FG, font=FONT_BODY,
                             justify="left").pack(anchor="w")
                else:
                    tk.Label(panel, text=detail, bg=COLOR_BG3, fg=COLOR_FG,
                             font=FONT_BODY, wraplength=640, justify="left").pack(anchor="w")
        self.show_page("overview")

    def _create_statistics_page(self, frame):
        tk.Label(frame, text="Statistik Perangkat", bg=COLOR_BG, fg=COLOR_FG,
                 font=("Segoe UI", 24, "bold")).pack(anchor="w", padx=34, pady=(34, 6))
        tk.Label(frame, text="Performa perangkat ini diperbarui setiap detik.",
                 bg=COLOR_BG, fg=COLOR_SUBTLE, font=FONT_BODY).pack(anchor="w", padx=34)

        cards = tk.Frame(frame, bg=COLOR_BG)
        cards.pack(fill="x", padx=34, pady=(27, 20))
        self.metric_widgets = {}
        for column, (key, title) in enumerate((("cpu", "CPU"), ("ram", "RAM"), ("disk", "DISK"))):
            cards.grid_columnconfigure(column, weight=1, uniform="metrics")
            card = tk.Frame(cards, bg=COLOR_BG3, padx=18, pady=18)
            card.grid(row=0, column=column, sticky="nsew", padx=(0, 12) if column < 2 else (0, 0))
            tk.Label(card, text=title, bg=COLOR_BG3, fg=COLOR_SUBTLE,
                     font=("Segoe UI", 10, "bold")).pack(anchor="w")
            value = tk.Label(card, text="--%", bg=COLOR_BG3, fg=COLOR_ACCENT2,
                             font=("Segoe UI", 26, "bold"))
            value.pack(anchor="w", pady=(12, 2))
            detail = tk.Label(card, text="Mengukur...", bg=COLOR_BG3, fg=COLOR_SUBTLE,
                              font=FONT_SMALL)
            detail.pack(anchor="w")
            bar = tk.Canvas(card, height=9, bg=COLOR_BORDER, highlightthickness=0)
            bar.pack(fill="x", pady=(18, 0))
            fill = bar.create_rectangle(0, 0, 0, 9, fill=COLOR_ACCENT, outline="")
            self.metric_widgets[key] = (value, detail, bar, fill)

        info = tk.Frame(frame, bg=COLOR_BG3, padx=24, pady=20)
        info.pack(fill="x", padx=34, pady=(0, 18))
        tk.Label(info, text="DEVICE INFO", bg=COLOR_BG3, fg=COLOR_ACCENT2,
                 font=("Segoe UI", 10, "bold")).pack(anchor="w")
        device_text = (f"Nama perangkat   {platform.node()}\n"
                       f"Sistem operasi   {platform.system()} {platform.release()}\n"
                       f"Logical CPU      {os.cpu_count() or '—'} core\n"
                       f"Disk proyek      {Path(APP_DIR).anchor}")
        tk.Label(info, text=device_text, bg=COLOR_BG3, fg=COLOR_FG,
                 font=("Consolas", 10), justify="left").pack(anchor="w", pady=(13, 0))
        self.stats_timestamp = tk.Label(frame, text="", bg=COLOR_BG,
                                        fg=COLOR_SUBTLE, font=FONT_SMALL)
        self.stats_timestamp.pack(anchor="w", padx=34)

    def _refresh_device_stats(self):
        stats = self.device_monitor.snapshot()
        gib = 1024 ** 3
        cpu = stats["cpu"]
        values = {
            "cpu": (cpu, f"{os.cpu_count() or '—'} logical core"),
            "ram": (100 * stats["ram_used"] / stats["ram_total"] if stats["ram_total"] else None,
                    f"{stats['ram_used'] / gib:.1f} / {stats['ram_total'] / gib:.1f} GiB"),
            "disk": (100 * stats["disk_used"] / stats["disk_total"] if stats["disk_total"] else None,
                     f"{stats['disk_used'] / gib:.1f} / {stats['disk_total'] / gib:.1f} GiB"),
        }
        for key, (percent, description) in values.items():
            value, detail, bar, fill = self.metric_widgets[key]
            color = COLOR_ERROR if percent is not None and percent >= 90 else (
                COLOR_WARNING if percent is not None and percent >= 75 else COLOR_ACCENT2)
            value.configure(text=f"{percent:.0f}%" if percent is not None else "--%", fg=color)
            detail.configure(text=description)
            bar.coords(fill, 0, 0, max(0, bar.winfo_width() - 1) * (percent or 0) / 100, 9)
            bar.itemconfigure(fill, fill=color)
        self.stats_timestamp.configure(text="Terakhir diperbarui: " + datetime.now().strftime("%H:%M:%S"))
        self.after(1000, self._refresh_device_stats)

    def _output_panel(self, parent):
        holder = tk.Frame(parent, bg=COLOR_BG3, padx=10, pady=10)
        holder.pack(fill="both", expand=True, padx=34, pady=(24, 12))
        scroll = tk.Scrollbar(holder, bg=COLOR_BG3)
        scroll.pack(side="right", fill="y")
        output = tk.Text(holder, bg="#0d0a1c", fg=COLOR_FG, insertbackground=COLOR_FG,
                         font=("Consolas", 10), relief="flat", wrap="word", state="disabled",
                         yscrollcommand=scroll.set, padx=14, pady=12)
        output.pack(side="left", fill="both", expand=True)
        scroll.configure(command=output.yview)
        output.tag_configure("error", foreground=COLOR_ERROR)
        output.tag_configure("file", foreground=COLOR_SUCCESS)
        output.tag_configure("info", foreground=COLOR_SUBTLE)
        output.tag_configure("frontend", foreground=COLOR_ACCENT2)
        output.tag_configure("backend", foreground=COLOR_WARNING)
        return output

    def _append_text(self, widget, line, tag=None):
        widget.configure(state="normal")
        widget.insert("end", line, tag)
        line_count = int(widget.index("end-1c").split(".")[0])
        if line_count > MAX_LOG_LINES:
            widget.delete("1.0", f"{line_count - MAX_LOG_LINES}.0")
        widget.see("end")
        widget.configure(state="disabled")

    def _service_card(self, parent, column, title, subtitle, url):
        card = tk.Frame(parent, bg=COLOR_BG3, padx=20, pady=17)
        card.grid(row=0, column=column, sticky="nsew", padx=(0, 9) if column == 0 else (9, 0))
        tk.Label(card, text=title, bg=COLOR_BG3, fg=COLOR_SUBTLE,
                 font=("Segoe UI", 9, "bold")).pack(anchor="w")
        value = tk.Label(card, text="●  STOPPED", bg=COLOR_BG3, fg=COLOR_SUBTLE,
                         font=("Segoe UI", 19, "bold"))
        value.pack(anchor="w", pady=(14, 5))
        tk.Label(card, text=subtitle, bg=COLOR_BG3, fg=COLOR_FG,
                 font=FONT_BODY).pack(anchor="w")
        tk.Label(card, text=url, bg=COLOR_BG3, fg=COLOR_ACCENT2,
                 font=FONT_SMALL).pack(anchor="w", pady=(10, 0))
        return card, value

    def _reset_rain(self, event=None):
        if not self.rain_enabled or not hasattr(self, "rain_canvas"):
            return
        for item, *_ in self.rain_drops:
            self.rain_canvas.delete(item)
        self.rain_drops.clear()
        width = max(self.rain_canvas.winfo_width(), 600)
        height = max(self.rain_canvas.winfo_height(), 200)
        for _ in range(34):
            x = random.randrange(width)
            y = random.randrange(height)
            length = random.randrange(8, 20)
            item = self.rain_canvas.create_line(x, y, x - 4, y + length,
                                                fill=random.choice(("#41345f", "#51416f", "#624f85")), width=1)
            self.rain_drops.append((item, x, y, length, random.randrange(3, 7)))
        self.rain_canvas.tag_raise(self.hero_title)

    def _animate_rain(self):
        if self.rain_enabled and self.current_page == "overview":
            width = self.rain_canvas.winfo_width()
            height = self.rain_canvas.winfo_height()
            updated = []
            for item, x, y, length, speed in self.rain_drops:
                y += speed
                if y > height:
                    y = -length
                    x = random.randrange(max(width, 1))
                self.rain_canvas.coords(item, x, y, x - 4, y + length)
                updated.append((item, x, y, length, speed))
            self.rain_drops = updated
        self.rain_job = self.after(50, self._animate_rain)

    def _animate_indicator(self):
        self._pulse_on = not self._pulse_on
        if not self.header_status.cget("text").startswith("●  0"):
            self.header_status.configure(fg=COLOR_SUCCESS if self._pulse_on else "#4cae9a")
        self.after(650, self._animate_indicator)

    def _fade_in(self):
        progress = min(1.0, (time.monotonic() - self._fade_started) / 0.35)
        self.attributes("-alpha", progress)
        if progress < 1.0:
            self.after(30, self._fade_in)

    def show_page(self, page):
        self.current_page = page
        self.pages[page].tkraise()
        for name, button in getattr(self, "nav_buttons", {}).items():
            button.configure(bg=COLOR_BG3 if name == page else COLOR_BG2,
                             fg=COLOR_ACCENT2 if name == page else COLOR_SUBTLE)

    def _set_status_bar(self, message, error=False):
        if hasattr(self, "status_label"):
            self.status_label.configure(text=message, fg=COLOR_ERROR if error else COLOR_INFO)

    def _drain_events(self):
        for _ in range(200):
            try:
                kind, *data = self.events.get_nowait()
            except queue.Empty:
                break
            stamp = datetime.now().strftime("%H:%M:%S")
            if kind == "log":
                source, line = data
                tag = "error" if not line.startswith("> ") and ERROR_PATTERN.search(line) else source
                self._append_text(self.console_text, f"[{stamp}] [{source}] {line}\n", tag)
                if tag == "error":
                    self.events.put(("error", source, line))
            elif kind == "error":
                source, message = data
                self.error_count += 1
                self._append_text(self.error_text, f"[{stamp}] [{source}] {message}\n", "error")
                self.nav_buttons["errors"].configure(text=f"◇   Diagnostics ({self.error_count})")
            elif kind == "file":
                action, path = data
                self.file_change_count += 1
                self._append_text(self.file_text, f"[{stamp}] {action:<8} {path}\n", "file")
                self.nav_buttons["files"].configure(text=f"▤   Files ({self.file_change_count})")
            elif kind == "status":
                message, is_error = data
                self._set_status_bar(message, error=is_error)
            elif kind == "process":
                source, status = data
                self._do_update_process_status(source, status)
            elif kind == "command_end":
                code = data[0]
                self.command_running = False
                self.shell_button.configure(state="normal", text="Run  ▶")
                self._append_text(self.console_text, f"[{stamp}] [shell] Exit code: {code}\n",
                                  "error" if code else "info")
                if code:
                    self.events.put(("error", "shell", f"Perintah selesai dengan exit code {code}."))
        self.after(20 if not self.events.empty() else 100, self._drain_events)

    def _run_shell_command(self):
        command = self.shell_entry.get().strip()
        if not command or self.command_running:
            return
        folder = {"project": APP_DIR, "frontend": FRONTEND_DIR,
                  "backend": BACKEND_DIR}[self.shell_cwd.get()]
        self.command_running = True
        self.shell_button.configure(state="disabled", text="Running...")
        self.shell_entry.delete(0, "end")
        self.events.put(("log", "shell", f"> {command}  (cwd: {folder})"))
        threading.Thread(target=self._shell_worker, args=(command, folder), daemon=True).start()

    def _shell_worker(self, command, folder):
        try:
            self.shell_proc = subprocess.Popen(command, shell=True, cwd=folder,
                                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                               text=True, encoding="utf-8", errors="replace",
                                               bufsize=1, **FLAG_POPEN)
            for line in self.shell_proc.stdout:
                clean = ANSI_PATTERN.sub("", line).rstrip("\r\n")
                if clean:
                    self.events.put(("log", "shell", clean))
            code = self.shell_proc.wait()
        except Exception as exc:
            self.events.put(("error", "shell", str(exc)))
            code = -1
        finally:
            self.shell_proc = None
            self.events.put(("command_end", code))

    def _scan_source_files(self):
        snapshot = {}
        for relative in ("frontend/vite.config.js", "frontend/package.json", "backend/composer.json"):
            path = os.path.join(APP_DIR, relative)
            try:
                info = os.stat(path)
                snapshot[os.path.relpath(path, APP_DIR)] = (info.st_mtime_ns, info.st_size)
            except OSError:
                pass
        for root in (os.path.join(FRONTEND_DIR, "src"), BACKEND_DIR):
            if not os.path.isdir(root):
                continue
            for folder, dirs, files in os.walk(root):
                dirs[:] = [name for name in dirs if name not in IGNORE_DIRS and not name.startswith(".")]
                for name in files:
                    if name.startswith(".") or name.endswith((".log", ".tmp", ".swp")):
                        continue
                    path = os.path.join(folder, name)
                    try:
                        info = os.stat(path)
                        snapshot[os.path.relpath(path, APP_DIR)] = (info.st_mtime_ns, info.st_size)
                    except OSError:
                        pass
        return snapshot

    def _watch_source_files(self):
        current = self._scan_source_files()
        for path, signature in current.items():
            old = self.file_snapshots.get(path)
            if old is None:
                self.events.put(("file", "NEW", path))
            elif old != signature:
                self.events.put(("file", "EDIT", path))
        for path in self.file_snapshots.keys() - current.keys():
            self.events.put(("file", "DELETE", path))
        self.file_snapshots = current
        self.after(INTERVAL_FILEWATCH * 1000, self._watch_source_files)

    def _poll_services(self):
        self.manager.poll_processes()
        elapsed = int(time.monotonic() - self.started_at)
        self.uptime_label.configure(text=f"Uptime {elapsed // 3600:02d}:{(elapsed // 60) % 60:02d}:{elapsed % 60:02d}")
        self.after(1000, self._poll_services)
    def _create_status_bar(self):
        """Compact activity strip."""
        self.status_bar = tk.Frame(self, bg=COLOR_BG2, height=38)
        self.status_bar.grid(row=2, column=0, columnspan=2, sticky="ew", padx=0, pady=0)
        self.status_bar.grid_columnconfigure(0, weight=1)

        self.status_label = tk.Label(self.status_bar, text="Siap",
                                      bg=COLOR_BG2, fg=COLOR_INFO,
                                      font=FONT_BORDER, anchor="w")
        self.status_label.grid(row=0, column=0, sticky="ew", padx=22, pady=9)
        self.summary_label = tk.Label(self.status_bar, text="",
                                       bg=COLOR_BG2, fg=COLOR_SUBTLE,
                                       font=FONT_SMALL, anchor="center")
        self.summary_label.grid(row=0, column=1, sticky="e", padx=8)
        self.uptime_label = tk.Label(self.status_bar, text="0h 0m",
                                      bg=COLOR_BG2, fg=COLOR_SUBTLE,
                                      font=FONT_SMALL, anchor="e")
        self.uptime_label.grid(row=0, column=2, sticky="e", padx=22)
    def _create_header(self):
        """Top toolbar."""
        self.header = tk.Frame(self, height=72, bg=COLOR_BG, relief="flat", borderwidth=0)
        self.header.grid(row=0, column=1, sticky="ew", padx=0, pady=0)
        self.header.grid_columnconfigure(1, weight=1)
        tk.Label(self.header, text="Dashboard  /  Development", bg=COLOR_BG, fg=COLOR_SUBTLE,
                 font=FONT_BODY).grid(row=0, column=0, sticky="w", padx=28, pady=22)
        self.header_status = tk.Label(self.header, text="●  READY", bg=COLOR_BG,
                                      fg=COLOR_SUCCESS, font=FONT_SUBTITLE)
        self.header_status.grid(row=0, column=1, sticky="e", padx=15)
        self.header_time = tk.Label(self.header, text="--:--:--",
                                    bg=COLOR_BG, fg=COLOR_SUBTLE, font=FONT_SUBTITLE)
        self.header_time.grid(row=0, column=2, sticky="e", padx=(0, 28))
        self._refresh_clock()
    
    def _refresh_clock(self):
        """Update the header time label with current system time."""
        try:
            now = datetime.now()
            formatted = now.strftime("%H:%M:%S")
            self.header_time.config(text=formatted)
        except Exception:
            self.header_time.config(text="--:--:--")
        # Schedule next update in 1 second
        self.after(1000, self._refresh_clock)

    def _on_frontend_toggle(self):
        """Toggle frontend start/stop."""
        if self.manager.frontend and self.manager.frontend.status == STATUS_RUNNING:
            self._stop_frontend()
        else:
            self._start_frontend()

    def _on_backend_toggle(self):
        """Toggle backend start/stop."""
        if self.manager.backend and self.manager.backend.status == STATUS_RUNNING:
            self._stop_backend()
        else:
            self._start_backend()

    def _on_stop_all(self):
        """Stop all running services."""
        self._stop_all_services()
    def _start_frontend(self):
        """Start the frontend (Vite) development server."""
        self._set_status_bar("Menjalankan frontend...")
        self._update_process_status("frontend", STATUS_STARTING)
        threading.Thread(target=self.manager.start_frontend, daemon=True).start()
        # Poll process status
        self.after(100, self._check_frontend_status)

    def _check_frontend_status(self):
        """Check frontend process status and update UI."""
        self.manager.poll_processes()
        if self.manager.frontend is None:
            self._update_process_status("frontend", STATUS_ERROR)
            return
        self._update_process_status("frontend", self.manager.frontend.status if self.manager.frontend else STATUS_STOPPED)
        if self.manager.frontend and self.manager.frontend.status == STATUS_RUNNING:
            self._set_status_bar("Frontend berjalan di %s" % FRONTEND_URL)
        elif self.manager.frontend and self.manager.frontend.status == STATUS_ERROR:
            self._set_status_bar("Frontend error", error=True)
        else:
            # Check again after a short delay
            self.after(500, self._check_frontend_status)
    def _start_backend(self):
        """Start the backend (PHP) development server."""
        self._set_status_bar("Menjalankan backend...")
        self._update_process_status("backend", STATUS_STARTING)
        threading.Thread(target=self.manager.start_backend, daemon=True).start()
        # Poll process status
        self.after(100, self._check_backend_status)

    def _check_backend_status(self):
        """Check backend process status and update UI."""
        self.manager.poll_processes()
        if self.manager.backend is None:
            self._update_process_status("backend", STATUS_ERROR)
            return
        self._update_process_status("backend", self.manager.backend.status if self.manager.backend else STATUS_STOPPED)
        if self.manager.backend and self.manager.backend.status == STATUS_RUNNING:
            self._set_status_bar("Backend berjalan di %s" % BACKEND_URL)
        elif self.manager.backend and self.manager.backend.status == STATUS_ERROR:
            self._set_status_bar("Backend error", error=True)
        else:
            # Check again after a short delay
            self.after(500, self._check_backend_status)
    def _stop_frontend(self):
        """Stop the frontend process."""
        self._set_status_bar("Menghentikan frontend...")
        self.manager._hentikan_frontend()
        self._update_process_status("frontend", STATUS_STOPPED)
        self._set_status_bar("Frontend dihentikan")

    def _stop_backend(self):
        """Stop the backend process."""
        self._set_status_bar("Menghentikan backend...")
        self.manager._hentikan_backend()
        self._update_process_status("backend", STATUS_STOPPED)
        self._set_status_bar("Backend dihentikan")

    def _stop_all_services(self):
        """Stop all running services."""
        self._set_status_bar("Menghentikan semua...")
        self.manager.stop_all()
        self._update_process_status("frontend", STATUS_STOPPED)
        self._update_process_status("backend", STATUS_STOPPED)
        self._set_status_bar("Semua layanan dihentikan")
    def _update_process_status(self, which, status):
        """Update the UI status for a specific process."""
        self.events.put(("process", which, status))

    def _do_update_process_status(self, which, status):
        """Keep the card and quick action in sync with each process."""
        color = {STATUS_STOPPED: COLOR_SUBTLE, STATUS_STARTING: COLOR_WARNING,
                 STATUS_RUNNING: COLOR_SUCCESS, STATUS_ERROR: COLOR_ERROR}.get(status, COLOR_SUBTLE)
        card = self.frontend_value if which == "frontend" else self.backend_value
        button = self.btn_frontend if which == "frontend" else self.btn_backend
        card.configure(text=f"●  {status}", fg=color)
        button.configure(text=("Stop " if status == STATUS_RUNNING else "Start ") + which.title())
        statuses = (self.manager.frontend.status if self.manager.frontend else STATUS_STOPPED,
                    self.manager.backend.status if self.manager.backend else STATUS_STOPPED)
        active = sum(s == STATUS_RUNNING for s in statuses)
        self.header_status.configure(text=f"●  {active} ACTIVE", fg=COLOR_SUCCESS if active else COLOR_SUBTLE)
        self.summary_label.configure(text=f"{active}/2 services online")
        self.lbl_status.configure(text=f"{active} layanan berjalan", fg=COLOR_SUCCESS if active else COLOR_SUBTLE)

    def _on_closing(self):
        """Handle window close event."""
        if self.shell_proc and self.shell_proc.poll() is None:
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(self.shell_proc.pid), "/T", "/F"],
                               capture_output=True, **FLAG_POPEN)
            else:
                self.shell_proc.terminate()
        self._stop_all_services()
        self.destroy()


class ArcadeLoginCanvas(tk.Canvas):
    """Small self-contained arcade scene; only a few existing items move per frame."""

    def __init__(self, parent):
        super().__init__(parent, width=500, height=180, bg="#0d0a1c", highlightthickness=0)
        self.pack(fill="x")
        self.position = 50
        self.frame_no = 0
        self.dots = []

        self.create_text(24, 19, text="1UP    GAMEKU ARCADE", fill=COLOR_ACCENT2,
                         anchor="w", font=("Consolas", 10, "bold"))
        self.create_text(476, 19, text="LEVEL 01", fill=COLOR_WARNING,
                         anchor="e", font=("Consolas", 10, "bold"))

        # Four open maze rails frame the moving characters without covering the form.
        for y in (39, 143):
            self.create_line(18, y, 160, y, fill="#5d42b2", width=3)
            self.create_line(185, y, 315, y, fill="#5d42b2", width=3)
            self.create_line(340, y, 482, y, fill="#5d42b2", width=3)
        for x in (18, 482):
            self.create_line(x, 39, x, 143, fill="#5d42b2", width=3)
        for x in range(40, 475, 22):
            dot = self.create_oval(x - 2, 90, x + 2, 94, fill="#d9c9ff", outline="")
            self.dots.append((x, dot))

        self.pac = self.create_arc(0, 0, 0, 0, start=28, extent=304,
                                   fill="#ffd36f", outline="", style="pieslice")
        self.eye = self.create_oval(0, 0, 0, 0, fill="#211431", outline="")
        self.ghosts = []
        for color in ("#fb7da8", "#71d8e8"):
            body = self.create_polygon(0, 0, fill=color, outline="")
            eyes = [self.create_oval(0, 0, 0, 0, fill="#fff8ff", outline="") for _ in range(2)]
            pupils = [self.create_oval(0, 0, 0, 0, fill="#32224f", outline="") for _ in range(2)]
            self.ghosts.append((body, eyes, pupils))
        self.after(50, self._animate)

    def _draw_ghost(self, ghost, x, y):
        body, eyes, pupils = ghost
        self.coords(body, x - 14, y + 13, x - 14, y - 4, x - 9, y - 12,
                    x, y - 15, x + 9, y - 12, x + 14, y - 4, x + 14, y + 13,
                    x + 8, y + 9, x + 3, y + 13, x - 3, y + 9, x - 8, y + 13)
        for offset, eye, pupil in zip((-6, 6), eyes, pupils):
            self.coords(eye, x + offset - 4, y - 6, x + offset + 4, y + 3)
            self.coords(pupil, x + offset, y - 2, x + offset + 3, y + 2)

    def _animate(self):
        self.frame_no += 1
        self.position = 36 + ((self.position - 36 + 3) % 430)
        mouth = 7 + (self.frame_no % 8) * 4
        self.itemconfigure(self.pac, start=mouth, extent=360 - 2 * mouth)
        self.coords(self.pac, self.position - 15, 76, self.position + 15, 106)
        self.coords(self.eye, self.position + 2, 81, self.position + 5, 84)
        for x, dot in self.dots:
            self.itemconfigure(dot, state="hidden" if x < self.position else "normal")
        if self.position < 40:
            for _, dot in self.dots:
                self.itemconfigure(dot, state="normal")
        self._draw_ghost(self.ghosts[0], 280 + (self.frame_no % 45) - 22,
                         91 + (self.frame_no % 8 > 3) * 2)
        self._draw_ghost(self.ghosts[1], 392 - (self.frame_no % 35),
                         91 + (self.frame_no % 10 > 4) * 2)
        self.after(50, self._animate)


def show_login():
    """Show login panel before main application.
    
    Returns True if login successful, False otherwise.
    Akun yang terdaftar:
    - adminravi / admin123
    - maizardev / admin123
    """
    login_win = tk.Tk()
    login_win.title("Gameku Store · Sign in")
    login_win.geometry("500x555")
    login_win.resizable(False, False)
    login_win.configure(bg=COLOR_BG)

    # Center the login window
    login_win.update_idletasks()
    width = 500
    height = 555
    x = (login_win.winfo_screenwidth() // 2) - (width // 2)
    y = (login_win.winfo_screenheight() // 2) - (height // 2)
    login_win.geometry(f"{width}x{height}+{x}+{y}")

    tk.Frame(login_win, bg=COLOR_ACCENT, height=4).pack(fill="x")
    ArcadeLoginCanvas(login_win)
    tk.Label(login_win, text="◆  GAMEKU", bg=COLOR_BG, fg=COLOR_ACCENT2,
             font=("Segoe UI", 20, "bold")).pack(anchor="w", padx=38, pady=(20, 2))
    tk.Label(login_win, text="READY PLAYER ONE  /  CONTROL CENTER", bg=COLOR_BG,
             fg=COLOR_SUBTLE, font=("Consolas", 9)).pack(anchor="w", padx=38)

    # Status variable for login feedback
    status_var = tk.StringVar()
    status_var.set("")

    # Frame for inputs
    frame = tk.Frame(login_win, bg=COLOR_BG)
    frame.pack(pady=(18, 7), padx=38, fill="x")
    frame.grid_columnconfigure(0, weight=1)

    # Username
    tk.Label(frame, text="USERNAME", bg=COLOR_BG, fg=COLOR_SUBTLE,
             font=FONT_SMALL).grid(row=0, column=0, sticky="w", pady=(0, 5))
    username_entry = tk.Entry(frame, font=FONT_BODY, bg=COLOR_BG3, fg=COLOR_FG,
                              insertbackground=COLOR_FG, relief="flat")
    username_entry.grid(row=1, column=0, sticky="ew", ipady=7, pady=(0, 10))

    # Password
    tk.Label(frame, text="PASSWORD", bg=COLOR_BG, fg=COLOR_SUBTLE,
             font=FONT_SMALL).grid(row=2, column=0, sticky="w", pady=(0, 5))
    password_entry = tk.Entry(frame, font=FONT_BODY, bg=COLOR_BG3, fg=COLOR_FG,
                              insertbackground=COLOR_FG, relief="flat", show="*")
    password_entry.grid(row=3, column=0, sticky="ew", ipady=7)

    # Result flag
    login_success = [False]

    def attempt_login():
        """Attempt login with proper authentication."""
        username = username_entry.get().strip()
        password = password_entry.get().strip()

        # Input validation
        if not username:
            status_var.set("Username wajib diisi")
            return

        if not password:
            status_var.set("Password wajib diisi")
            return

        # Disable button during authentication
        btn_login.config(state="disabled", text="Mengautentikasi...")
        status_var.set("Mengautentikasi...")

        # Verify credentials using hash-based authentication
        creds = _load_credentials()
        is_valid = _verify_password(username, password, creds)

        if is_valid:
            login_success[0] = True
            login_win.destroy()
        else:
            # Reset button state
            btn_login.config(state="normal", text="Masuk")
            status_var.set("Gagal: Username atau password salah")
            messagebox.showerror("Login Gagal", "Username atau password salah!", parent=login_win)

    # Login button
    btn_login = tk.Button(login_win, text="Masuk  →", bg=COLOR_ACCENT, fg=COLOR_BG,
                          activebackground=COLOR_ACCENT2, activeforeground=COLOR_BG,
                          relief="flat", cursor="hand2", font=FONT_SUBTITLE,
                          command=attempt_login)
    btn_login.pack(fill="x", padx=38, pady=(10, 5), ipady=7)
    tk.Label(login_win, textvariable=status_var, bg=COLOR_BG, fg=COLOR_WARNING,
             font=FONT_SMALL).pack(anchor="w", padx=38)

    # Focus on username field
    username_entry.focus_set()
    username_entry.select_range(0, tk.END)

    # Wait for window to close, then check result
    login_win.wait_window()

    return login_success[0]


def show_splash():
    """Show brief splash screen with ALVIN JMBOD logo and light loading animation."""
    splash = tk.Tk()
    splash.overrideredirect(True)  # Remove window decorations
    splash.configure(bg=COLOR_BG)
    
    # Centered on screen
    splash.update_idletasks()
    w, h = 400, 200
    x = (splash.winfo_screenwidth() // 2) - (w // 2)
    y = (splash.winfo_screenheight() // 2) - (h // 2)
    splash.geometry(f"{w}x{h}+{x}+{y}")
    
    # ALVIN JMBOD text with animation effect
    title = tk.Label(splash, text="ALVIN JMBOD", bg=COLOR_BG, fg=COLOR_ACCENT,
                     font=("Segoe UI", 28, "bold"))
    title.pack(pady=(40, 10))
    
    # Subtitle
    subtitle = tk.Label(splash, text="Desktop Control Center", bg=COLOR_BG, fg=COLOR_SUBTLE,
                        font=("Segoe UI", 12))
    subtitle.pack()
    
    # Loading animation
    frame = tk.Frame(splash, bg=COLOR_BG)
    frame.pack(pady=20)
    
    dots = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠫"]
    dot_idx = [0]
    
    def update_dots():
        dot_label.configure(text=f"  {dots[dot_idx[0]]}")
        dot_idx[0] = (dot_idx[0] + 1) % len(dots)
        splash.after(100, update_dots)
    
    dot_label = tk.Label(frame, text="  ", bg=COLOR_BG, fg=COLOR_ACCENT,
                         font=("Segoe UI", 10))
    dot_label.pack()
    update_dots()
    
    # Auto-close after 3 seconds
    splash.after(3000, splash.destroy)
    splash.mainloop()

if __name__ == "__main__":
    # Show login panel
    if not show_login():
        # User cancelled or failed login - exit gracefully
        sys.exit(0)
    
    # Proceed to main application with premium design
    app = ControlCenterApp()
    app.mainloop()
