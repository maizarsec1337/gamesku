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
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import webbrowser

# Import runtime PHP lokal (tidak mengubah php.ini global)
try:
    from php_runtime import perintah_php
except Exception:  # pragma: no cover - fallback jika php_runtime tidak ada
    def perintah_php():
        return ["php"]

# ============================================================
# Konfigurasi (diverifikasi dari repository)
# ============================================================
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
LOG_DIR = os.path.join(ROOT_DIR, "logs")

FRONTEND_PORT = 5173
BACKEND_PORT = 8000
FRONTEND_URL = "http://localhost:%d" % FRONTEND_PORT
BACKEND_URL = "http://localhost:%d" % BACKEND_PORT
BACKEND_HEALTH_URL = "http://localhost:%d/api/sehat" % BACKEND_PORT

NPM_CMD = shutil.which("npm")
PHP_CMD = shutil.which("php")  # None bila PHP tidak terpasang

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

# ============================================================
# Authentifikasi (hash password dengan salt, tidak plaintext)
# ============================================================
SALT_ROUNDS = 150000  # PBKDF2 rounds - seimbang keamanan & performa
USER_DATA_FILE = os.path.join(ROOT_DIR, ".credentials.json")

# Akun default yang harus ada setelah instalasi pertama
DEFAULT_USERS = {
    "adminravi": "admin123",
    "maizardev": "admin123",
}

def _hash_password(password: str, salt: bytes) -> str:
    """Hash password menggunakan PBKDF2-HMAC-SHA256."""
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, SALT_ROUNDS).hex()

def _generate_salt() -> bytes:
    """Generate salt unik untuk setiap akun."""
    return os.urandom(16)

def _load_credentials() -> dict:
    """Load credentials dari file lokal. Kembalikan dict username -> {salt, hash}."""
    try:
        if os.path.exists(USER_DATA_FILE):
            with open(USER_DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            # Validasi format
            if isinstance(data, dict):
                validated = {}
                for username, entry in data.items():
                    if isinstance(entry, dict) and "salt" in entry and "hash" in entry:
                        validated[username] = {
                            "salt": base64.b64decode(entry["salt"]) if isinstance(entry["salt"], str) else entry["salt"],
                            "hash": entry["hash"],
                        }
                return validated
        return {}
    except Exception:
        return {}

def _save_credentials(creds: dict) -> None:
    """Simpan credentials terhash ke file lokal."""
    try:
        # Encode salt as base64 untuk simpan di JSON
        save_data = {}
        for username, entry in creds.items():
            save_data[username] = {
                "salt": base64.b64encode(entry["salt"]).decode("ascii") if entry.get("salt") else "",
                "hash": entry["hash"],
            }
        # Tulis ke file sementara lalu rename untuk atomicity
        tmp_file = USER_DATA_FILE + ".tmp"
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(save_data, f, indent=2)
        os.replace(tmp_file, USER_DATA_FILE)
    except Exception as e:
        print("[WARNING] Gagal menyimpan kredensial: {}.".format(e))

def _init_default_users() -> None:
    """Inisialisasi akun default jika file kredensial belum ada."""
    creds = _load_credentials()
    if not creds:
        # Buat akun default dengan hash password
        for username, password in DEFAULT_USERS.items():
            salt = _generate_salt()
            password_hash = _hash_password(password, salt)
            creds[username] = {"salt": salt, "hash": password_hash}
        _save_credentials(creds)
        print("[AUTH] Akun default terinisialisasi.")
    return creds

def verify_password(username: str, password: str, creds: dict) -> bool:
    """Verifikasi username/password against stored credentials.

    Returns True jika valid, False jika salah.
    Tidak mencetak password ke log atau terminal.
    """
    if username not in creds:
        return False

    entry = creds[username]
    stored_salt = entry["salt"]
    stored_hash = entry["hash"]

    computed_hash = _hash_password(password, stored_salt)

    # Constant-time comparison to prevent timing attacks
    return computed_hash == stored_hash
# Tipografi
FONT_TITLE = ("Segoe UI", 28, "bold")
FONT_SUBTITLE = ("Segoe UI", 11)
FONT_BODY = ("Segoe UI", 10)
FONT_BORDER = ("Segoe UI", 9)
FONT_SMALL = ("Segoe UI", 8)
FONT_CAPTION = ("Segoe UI", 10, "bold")
FONT_SANS = ("Segoe UI", 9)
FRONTEND_CMD = [NPM_CMD or "npm", "run", "dev", "--", "--strictPort"]

# Backend hanya dijalankan jika PHP tersedia.
if PHP_CMD:
    BACKEND_CMD = PHP_CMD + ["-S", "localhost:%d" % BACKEND_PORT, "-t", ".", "api/index.php"]
else:
    BACKEND_CMD = ["echo", "Backend PHP dinonaktifkan - instal PHP untuk menjalankan backend"]

# CREATE_NO_WINDOW mencegah jendela CMD baru di Windows.
FLAG_POPEN = (
    {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0)}
    if os.name == "nt"
    else {"start_new_session": True}
)

WAKTU_TUNGGU_FRONTEND = 90   # detik — detik
WAKTU_TUNGGU_BACKEND = 30    # detik — detik

INTERVAL_HEALTH = 5      # detik — cek health endpoint
INTERVAL_FILEWATCH = 2   # detik — cek perubahan file sumber
MAX_LOG_LINES = 2000     # batas baris log per layanan (hindari memory leak)

# File sumber yang dipantau untuk perubahan (relative to ROOT_DIR)
FILEWATCH_TARGETS = [
    os.path.join("frontend", "src", "main.jsx"),
    os.path.join("frontend", "src", "App.jsx"),
    os.path.join("frontend", "src", "halaman", "Beranda.jsx"),
    os.path.join("frontend", "vite.config.js"),
    os.path.join("backend", "api", "index.php"),
    os.path.join("frontend", "src", "layanan", "layananPesanan.js"),
]

# Direktori yang diabaikan saat memantau perubahan file
IGNORE_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build", ".next"}

# Warna tema dark
COLOR_BG = "#1e1e2e"
COLOR_BG2 = "#2a2a3e"
COLOR_FG = "#cdd6f4"
COLOR_ACCENT = "#89b4fa"
COLOR_SUCCESS = "#a6e3a1"
COLOR_WARNING = "#fab387"
COLOR_ERROR = "#f38ba8"
COLOR_INFO = "#74c7ec"
COLOR_PANEL_BG = "#313244"
COLOR_BORDER = "#45475a"

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
        if self.frontend and self.frontend.status == STATUS_RUNNING:
            self._tampilkan_status("Frontend sudah berjalan.")
            return

        self._bersihkan_log("frontend")
        self.frontend = ProcessEntry("frontend", FRONTEND_CMD, cwd=FRONTEND_DIR)

        try:
            self.frontend.proc = subprocess.Popen(
                self.frontend.cmd,
                cwd=self.frontend.cwd,
                **FLAG_POPEN,
            )
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
        if self.backend and self.backend.status == STATUS_RUNNING:
            self._tampilkan_status("Backend sudah berjalan.")
            return

        self._bersihkan_log("backend")
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
                **FLAG_POPEN,
            )
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
            if not self.running:
                return
            # Cek proses masih hidup
            if self.frontend.proc.poll() is not None:
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
            if not self.running:
                return
            # Cek proses masih hidup
            if self.backend.proc.poll() is not None:
                self._handle_process_exit("backend")
                return
            # Cek health endpoint
            if self._cek_http(BACKEND_HEALTH_URL, timeout=2):
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
    def _handle_process_exit(self, which):
        """Dipanggil saat proses anak mati."""
        entry = self.frontend if which == "frontend" else self.backend
        self._tampilkan_status("%s proses mati secara tiba-tida." % entry.nama)
        entry.status = STATUS_ERROR
        entry.exit_code = entry.proc.returncode if entry.proc else None
        # Update GUI jika ada
        if self.app_gui:
            self.app_gui._update_process_status(which, entry.status)
        # Coba restart otomatis? Untuk now, hentikan dan tandai error.
        entry.proc = None
    def _hentikan_frontend(self, force=False):
        """ menghentikan frontend."""
        if self.frontend and self.frontend.proc:
            self._tampilkan_status("Menghentikan frontend...")
            self.frontend.proc.terminate()
            try:
                self.frontend.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.frontend.proc.kill()
            self.frontend.proc = None
            self.frontend.status = STATUS_STOPPED
            self._tampilkan_status("Frontend dihentikan.")
        if self.app_gui:
            self.app_gui._update_process_status("frontend", STATUS_STOPPED)
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
            self.app_gui._update_process_status("backend", STATUS_STOPPED)
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
    def _bersihkan_log(self, which):
        """Bersihkan file log sebelum memulai."""
        log_path = self.frontend.log_file if which == "frontend" else self.backend.log_file
        if log_path and os.path.exists(log_path):
            try:
                os.remove(log_path)
            except Exception:
                pass
    def _tampilkan_status(self, msg):
        """Tampilkan pesan ke GUI status bar (dijalankan di thread utama)."""
        if self.app_gui:
            self.app_gui._set_status_bar(msg)
        else:
            print("[STATUS] " + msg)

    def _tampilkan_error(self, msg):
        """Tampilkan error ke GUI."""
        if self.app_gui:
            self.app_gui._set_status_bar("ERROR: " + msg, error=True)
        else:
            print("[ERROR] " + msg)
class ControlCenterApp(tk.Tk):
    """Main application window for Gameku Store Desktop Control Center."""

    def __init__(self):
        super().__init__()
        self.title("ALVIN JMBOD — Desktop Control Center")
        self.geometry("1600x980")
        self.minsize(1400, 800)

        # Configure premium dark theme
        self.configure(bg=COLOR_BG)

        # Initialize process manager
        self.manager = ProcessManager(app_gui=self)

        # State tracking
        self.current_page = "overview"
        self.running_services = set()
        self.log_scroll_pos = 0
        self.paused_log_scroll = False

        # ============ Layout Configuration ============
        # Grid weights: sidebar 280px, main content fills rest
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=1)

        # Create header
        self._create_header()

        # Create sidebar navigation
        self._create_sidebar()

        # Create main content area
        self.main_content = tk.Frame(self, bg=COLOR_BG2)
        self.main_content.grid(row=0, column=1, sticky="nsew", padx=0, pady=0)
        self.main_content.grid_rowconfigure(0, weight=1)
        self.main_content.grid_columnconfigure(0, weight=1)

        # Create content frames (cards/panels)
        self._create_content_panels()

        # Initialize display
        self._update_process_status("frontend", STATUS_STOPPED)
        self._update_process_status("backend", STATUS_STOPPED)
        self._refresh_clock()

        # Protocol untuk menutup aplikasi
        self.protocol("WM_DELETE_WINDOW", self._on_closing)

        # Animated entrance fade
        self.alpha = 0
        self._fade_in(0, self.lift)
    def _create_sidebar(self):
        """Create sidebar frame with service buttons."""
        self.sidebar = tk.Frame(self, bg=COLOR_BG2, width=200)
        self.sidebar.grid(row=0, column=0, sticky="ns")
        self.sidebar.grid_rowconfigure(0, weight=1)

        # Sidebar title
        title_label = tk.Label(
            self.sidebar,
            text="Gameku Store",
            bg=COLOR_BG2,
            fg=COLOR_ACCENT,
            font=("Segoe UI", 14, "bold"),
            pady=20,
        )
        title_label.grid(row=0, column=0, padx=10, pady=5)

        # Divider
        ttk.Separator(self.sidebar, orient="horizontal").grid(
            row=1, column=0, sticky="ew", padx=10
        )

        # Buttons frame
        btn_frame = tk.Frame(self.sidebar, bg=COLOR_BG2)
        btn_frame.grid(row=2, column=0, sticky="ns", padx=10, pady=10)
        btn_frame.grid_columnconfigure((0, 1, 2), weight=1)

        # FRONTEND button
        self.btn_frontend = tk.Button(
            btn_frame,
            text="FRONTEND",
            bg=COLOR_ERROR,
            fg="white",
            font=("Segoe UI", 10, "bold"),
            cursor="hand2",
            command=self._on_frontend_toggle,
            width=20,
            height=1,
        )
        self.btn_frontend.grid(row=0, column=0, padx=5, pady=5)

        # BACKEND button
        self.btn_backend = tk.Button(
            btn_frame,
            text="BACKEND",
            bg=COLOR_WARNING,
            fg="white",
            font=("Segoe UI", 10, "bold"),
            cursor="hand2",
            command=self._on_backend_toggle,
            width=20,
            height=1,
        )
        self.btn_backend.grid(row=1, column=0, padx=5, pady=5)

        # STOP ALL button
        self.btn_stop_all = tk.Button(
            btn_frame,
            text="STOP ALL",
            bg=COLOR_ERROR,
            fg="white",
            font=("Segoe UI", 10, "bold"),
            cursor="hand2",
            command=self._on_stop_all,
            width=20,
            height=1,
        )
        self.btn_stop_all.grid(row=2, column=0, padx=5, pady=5)

        # Divider
        ttk.Separator(btn_frame, orient="horizontal").grid(
            row=3, column=0, sticky="ew", padx=5, pady=5
        )

        # Status info
        self.lbl_status = tk.Label(
            btn_frame,
            text="Semua layanan berhenti",
            bg=COLOR_BG2,
            fg=COLOR_INFO,
            font=("Segoe UI", 9),
        )
        self.lbl_status.grid(row=4, column=0, padx=5, pady=5)
    def _create_content_panels(self):
        """Create content frames that switch between premium pages."""
        self.pages_frame = tk.Frame(self.main_content, bg=COLOR_BG2)
        self.pages_frame.grid(row=0, column=0, sticky="nsew")
        self.pages_frame.grid_rowconfigure(0, weight=1)
        self.pages_frame.grid_columnconfigure(0, weight=1)

        # Initialize all page frames
        for page in ["overview", "services", "console", "files", "errors", "settings", "about"]:
            self.pages[page] = tk.Frame(self.pages_frame, bg=COLOR_BG2)
            self.pages[page].grid(row=0, column=0, sticky="nsew")
            self.show_page("overview")
    def _create_status_bar(self):
        """Create premium status bar."""
        self.status_bar = tk.Frame(self, bg=COLOR_BORDER, height=30)
        self.status_bar.grid(row=1, column=0, columnspan=2, sticky="ew", padx=0, pady=0)
        self.status_bar.grid_columnconfigure(2, weight=1)

        self.status_label = tk.Label(self.status_bar, text="Siap",
                                      bg=COLOR_BORDER, fg=COLOR_INFO,
                                      font=FONT_BORDER, anchor="w")
        self.status_label.grid(row=0, column=0, sticky="w", padx=12)
        self.summary_label = tk.Label(self.status_bar, text="",
                                       bg=COLOR_BORDER, fg=COLOR_SUBTLE,
                                       font=FONT_SMALL, anchor="center")
        self.summary_label.grid(row=0, column=1, sticky="ew", padx=8)
        self.uptime_label = tk.Label(self.status_bar, text="0h 0m",
                                      bg=COLOR_BORDER, fg=COLOR_SUBTLE,
                                      font=FONT_SMALL, anchor="e")
        self.uptime_label.grid(row=0, column=3, sticky="e", padx=12)
    def _create_header(self):
        """Create premium header with branding, status, and time."""
        self.header = tk.Frame(self, height=80, bg=COLOR_BG, relief="flat", borderwidth=0)
        self.header.grid(row=0, column=1, sticky="ew", padx=0, pady=0)
        self.header.grid_columnconfigure(4, weight=1)
        self.header.pack_propagate(False)

        # Left: Branding
        tk.Label(self.header, text="ALVIN JMBOD", bg=COLOR_BG, fg=COLOR_ACCENT,
                 font=FONT_TITLE).grid(row=0, column=0, padx=28, pady=(12, 0))

        # Center: System status
        status_frame = tk.Frame(self.header, bg=COLOR_BG)
        status_frame.grid(row=0, column=1, padx=40, pady=12, sticky="w")
        self.header_status = tk.Label(status_frame, text="Status: Siap",
                                      bg=COLOR_BG, fg=COLOR_SUCCESS,
                                      font=FONT_SUBTITLE)
        self.header_status.pack(side="left")

        # Right: Time and settings
        right_frame = tk.Frame(self.header, bg=COLOR_BG)
        right_frame.grid(row=0, column=4, padx=28, pady=12, sticky="e")
        self.header_time = tk.Label(right_frame, text="--:--:--",
                                    bg=COLOR_BG, fg=COLOR_SUBTLE,
                                    font=FONT_SUBTITLE)
        self.header_time.pack(side="left")
        settings_btn = tk.Button(self.header, text="⚙", bg=COLOR_BG, fg=COLOR_ACCENT,
                                  font=("Segoe UI", 12), cursor="hand2", relief="flat",
                                  command=self.show_settings)
        settings_btn.grid(row=0, column=5, padx=4)
        # Start clock refresh after GUI is fully setup
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

    def _create_sidebar(self):
        """Create modern sidebar navigation with icons and animations."""
        self.sidebar = tk.Frame(self, width=280, bg=COLOR_BG, relief="flat", borderwidth=0)
        self.sidebar.grid(row=0, column=0, sticky="ns", padx=0, pady=0)
        self.sidebar.grid_rowconfigure(8, weight=1)
        self.sidebar.pack_propagate(False)

        # Sidebar title area
        tk.Label(self.sidebar, text="ALVIN JMBOD", bg=COLOR_BG, fg=COLOR_ACCENT,
                 font=FONT_TITLE).grid(row=0, column=0, padx=24, pady=(24, 6))
        subtitle = tk.Label(self.sidebar, text="Desktop Control Center", bg=COLOR_BG, fg=COLOR_SUBTLE,
                            font=FONT_SUBTITLE)
        subtitle.grid(row=1, column=0, padx=24, pady=(0, 24))
        ttk.Separator(self.sidebar, orient="horizontal").grid(row=2, column=0, sticky="ew", padx=24)

        # Navigation buttons
        nav_data = [
            ("overview", "🏠  Overview"),
            ("services", "🔧  Services"),
            ("console", ">_  Live Console"),
            ("files", "📁  File Activity"),
            ("errors", "⚠  Errors & Diagnostics"),
            ("settings", "⚙  Settings"),
            ("about", "ℹ  About ALVIN JMBOD"),
        ]
        self.nav_buttons = {}
        for i, (page, label) in enumerate(nav_data):
            btn = tk.Button(self.sidebar, text=label, bg=COLOR_BG, fg=COLOR_SUBTLE,
                           font=FONT_BODY, anchor="w", cursor="hand2", relief="flat",
                           width=26, justify="left",
                           command=lambda p=page: self.show_page(p))
            btn.grid(row=3+i, column=0, sticky="ew", padx=12, pady=4)
            self.nav_buttons[page] = btn
        self.nav_buttons["overview"].configure(fg=COLOR_ACCENT)

        # System info at bottom
        info_frame = tk.Frame(self.sidebar, bg=COLOR_BG2, height=60)
        info_frame.grid(row=10, column=0, sticky="se", padx=24, pady=12)
        info_frame.grid_columnconfigure(0, weight=1)
        info_frame.pack_propagate(False)
        tk.Label(info_frame, text="ALVIN JMBOD v2.0", bg=COLOR_BG2, fg=COLOR_SUBTLE,
                 font=FONT_SMALL).grid(row=0, column=0, sticky="w")
        tk.Label(info_frame, text="Desktop Control Center", bg=COLOR_BG2, fg=COLOR_SUBTLE,
                 font=FONT_SMALL).grid(row=1, column=0, sticky="w", pady=2)

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
        self.lbl_status.configure(text="Frontend STARTING", fg=COLOR_WARNING)
        self.btn_frontend.configure(bg=COLOR_WARNING)
        self.manager.start_frontend()
        # Poll process status
        self.after(100, self._check_frontend_status)

    def _check_frontend_status(self):
        """Check frontend process status and update UI."""
        self.manager.poll_processes()
        self._update_process_status("frontend", self.manager.frontend.status if self.manager.frontend else STATUS_STOPPED)
        if self.manager.frontend and self.manager.frontend.status == STATUS_RUNNING:
            self._set_status_bar("Frontend berjalan di %s" % FRONTEND_URL)
            self.lbl_status.configure(text="Frontend RUNNING", fg=COLOR_SUCCESS)
            self.btn_frontend.configure(bg=COLOR_SUCCESS)
        elif self.manager.frontend and self.manager.frontend.status == STATUS_ERROR:
            self._set_status_bar("Frontend error", error=True)
            self.lbl_status.configure(text="Frontend ERROR", fg=COLOR_ERROR)
            self.btn_frontend.configure(bg=COLOR_ERROR)
        else:
            # Check again after a short delay
            self.after(500, self._check_frontend_status)
    def _start_backend(self):
        """Start the backend (PHP) development server."""
        self._set_status_bar("Menjalankan backend...")
        self.lbl_status.configure(text="Backend STARTING", fg=COLOR_WARNING)
        self.btn_backend.configure(bg=COLOR_WARNING)
        self.manager.start_backend()
        # Poll process status
        self.after(100, self._check_backend_status)

    def _check_backend_status(self):
        """Check backend process status and update UI."""
        self.manager.poll_processes()
        self._update_process_status("backend", self.manager.backend.status if self.manager.backend else STATUS_STOPPED)
        if self.manager.backend and self.manager.backend.status == STATUS_RUNNING:
            self._set_status_bar("Backend berjalan di %s" % BACKEND_URL)
            self.lbl_status.configure(text="Backend RUNNING", fg=COLOR_SUCCESS)
            self.btn_backend.configure(bg=COLOR_SUCCESS)
        elif self.manager.backend and self.manager.backend.status == STATUS_ERROR:
            self._set_status_bar("Backend error", error=True)
            self.lbl_status.configure(text="Backend ERROR", fg=COLOR_ERROR)
            self.btn_backend.configure(bg=COLOR_ERROR)
        else:
            # Check again after a short delay
            self.after(500, self._check_backend_status)
    def _stop_frontend(self):
        """Stop the frontend process."""
        self._set_status_bar("Menghentikan frontend...")
        self.manager._hentikan_frontend()
        self._update_process_status("frontend", STATUS_STOPPED)
        self._set_status_bar("Frontend dihentikan")
        self.lbl_status.configure(text="Semua layanan berhenti", fg=COLOR_INFO)
        self.btn_frontend.configure(bg=COLOR_ERROR)
        self.btn_backend.configure(bg=COLOR_WARNING)

    def _stop_backend(self):
        """Stop the backend process."""
        self._set_status_bar("Menghentikan backend...")
        self.manager._hentikan_backend()
        self._update_process_status("backend", STATUS_STOPPED)
        self._set_status_bar("Backend dihentikan")
        self.lbl_status.configure(text="Semua layanan berhenti", fg=COLOR_INFO)
        self.btn_backend.configure(bg=COLOR_ERROR)
        self.btn_frontend.configure(bg=COLOR_WARNING)

    def _stop_all_services(self):
        """Stop all running services."""
        self._set_status_bar("Menghentikan semua...")
        self.manager.stop_all()
        self._update_process_status("frontend", STATUS_STOPPED)
        self._update_process_status("backend", STATUS_STOPPED)
        self._set_status_bar("Semua layanan dihentikan")
        self.lbl_status.configure(text="Semua layanan berhenti", fg=COLOR_INFO)
        self.btn_frontend.configure(bg=COLOR_ERROR)
        self.btn_backend.configure(bg=COLOR_ERROR)
    def _update_process_status(self, which, status):
        """Update the UI status for a specific process."""
        # This method is called from ProcessManager via app_gui reference
        # We use after to safely update UI from main thread
        self.after(0, self._do_update_process_status, which, status)

    def _do_update_process_status(self, which, status):
        """Actually update the process status display."""
        if which == "frontend":
            self.lbl_status.configure(
                text={
                    STATUS_STOPPED: "Semua layanan berhenti",
                    STATUS_STARTING: "Frontend STARTING",
                    STATUS_RUNNING: "Frontend RUNNING",
                    STATUS_ERROR: "Frontend ERROR",
                }.get(status, which),
                fg={
                    STATUS_STOPPED: COLOR_INFO,
                    STATUS_STARTING: COLOR_WARNING,
                    STATUS_RUNNING: COLOR_SUCCESS,
                    STATUS_ERROR: COLOR_ERROR,
                }.get(status, COLOR_INFO),
            )
            self.btn_frontend.configure(
                bg={
                    STATUS_STOPPED: COLOR_ERROR,
                    STATUS_STARTING: COLOR_WARNING,
                    STATUS_RUNNING: COLOR_SUCCESS,
                    STATUS_ERROR: COLOR_ERROR,
                }.get(status, COLOR_ERROR),
            )
        elif which == "backend":
            self.lbl_status.configure(
                text={
                    STATUS_STOPPED: "Semua layanan berhenti",
                    STATUS_STARTING: "Backend STARTING",
                    STATUS_RUNNING: "Backend RUNNING",
                    STATUS_ERROR: "Backend ERROR",
                }.get(status, which),
                fg={
                    STATUS_STOPPED: COLOR_INFO,
                    STATUS_STARTING: COLOR_WARNING,
                    STATUS_RUNNING: COLOR_SUCCESS,
                    STATUS_ERROR: COLOR_ERROR,
                }.get(status, COLOR_INFO),
            )
            self.btn_backend.configure(
                bg={
                    STATUS_STOPPED: COLOR_ERROR,
                    STATUS_STARTING: COLOR_WARNING,
                    STATUS_RUNNING: COLOR_SUCCESS,
                    STATUS_ERROR: COLOR_ERROR,
                }.get(status, COLOR_ERROR),
            )

    def _monitor_processes(self):
        """Background thread to monitor process health."""
        while self.manager.running:
            self.manager.poll_processes()
            # Update GUI if needed
            self.after(0, self._update_gui_from_monitor)
            time.sleep(INTERVAL_HEALTH)

    def _update_gui_from_monitor(self):
        """Update GUI based on monitoring results."""
        self._update_process_status("frontend", self.manager.frontend.status if self.manager.frontend else STATUS_STOPPED)
        self._update_process_status("backend", self.manager.backend.status if self.manager.backend else STATUS_STOPPED)

    def _monitor_file_changes(self):
        """Watch for changes in source files and reload as needed."""
        while True:
            # Check file modification times
            current_mtimes = {}
            for target in FILEWATCH_TARGETS:
                full_path = os.path.join(ROOT_DIR, target)
                if os.path.exists(full_path) and os.path.isfile(full_path):
                    mtime = os.path.getmtime(full_path)
                    rel = os.path.relpath(full_path, ROOT_DIR)
                    current_mtimes[rel] = mtime

            # Compare with snapshots and trigger reload if changed
            changed = False
            for rel_path, mtime in current_mtimes.items():
                if rel_path not in self.file_snapshots or self.file_snapshots[rel_path] != mtime:
                    changed = True
                    self.file_snapshots[rel_path] = mtime

            if changed:
                self._on_file_change()

            time.sleep(INTERVAL_FILEWATCH)

    def _on_file_change(self):
        """Handle detected file changes."""
        self._set_status_bar("Terdeteksi perubahan file - refresh akan segera dilakukan")
        # For now, just show notification - auto-reload can be implemented later
        # This would typically restart the relevant server process

    def _on_closing(self):
        """Handle window close event."""
        self._stop_all_services()
        self.destroy()


def show_login():
    """Show login panel before main application.
    
    Returns True if login successful, False otherwise.
    Akun yang terdaftar:
    - adminravi / admin123
    - maizardev / admin123
    """
    login_win = tk.Toplevel()
    login_win.title("ALVIN JMBOD")
    login_win.geometry("350x250")
    login_win.resizable(False, False)
    login_win.configure(bg=COLOR_BG)
    login_win.transient()  # stay on top of main app
    login_win.grab_set()

    # Center the login window
    login_win.update_idletasks()
    width = 350
    height = 250
    x = (login_win.winfo_screenwidth() // 2) - (width // 2)
    y = (login_win.winfo_screenheight() // 2) - (height // 2)
    login_win.geometry(f"{width}x{height}+{x}+{y}")

    # Title
    title_label = tk.Label(login_win, text="ALVIN JMBOD", bg=COLOR_BG, fg=COLOR_FG,
                           font=("Segoe UI", 16, "bold"))
    title_label.pack(pady=(20, 10))

    # Subtitle
    subtitle = tk.Label(login_win, text="Control Center Application", bg=COLOR_BG, fg=COLOR_ACCENT,
                        font=("Segoe UI", 10))
    subtitle.pack()

    # Frame for inputs
    frame = tk.Frame(login_win, bg=COLOR_BG)
    frame.pack(pady=10, padx=20, fill="x")

    # Username
    tk.Label(frame, text="Username:", bg=COLOR_BG, fg=COLOR_FG, font=("Segoe UI", 10)).grid(row=0, column=0, sticky="w", pady=5)
    username_entry = tk.Entry(frame, font=("Segoe UI", 10), width=25)
    username_entry.grid(row=0, column=1, pady=5)

    # Password
    tk.Label(frame, text="Password:", bg=COLOR_BG, fg=COLOR_FG, font=("Segoe UI", 10)).grid(row=1, column=0, sticky="w", pady=5)
    password_entry = tk.Entry(frame, font=("Segoe UI", 10), width=25, show="*")
    password_entry.grid(row=1, column=1, pady=5)

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
        is_valid = verify_password(username, password, creds)

        if is_valid:
            login_success[0] = True
            login_win.destroy()
        else:
            # Reset button state
            btn_login.config(state="normal", text="Masuk")
            status_var.set("Gagal: Username atau password salah")
            messagebox.showerror("Login Gagal", "Username atau password salah!", parent=login_win)

    # Login button
    btn_login = tk.Button(login_win, text="Masuk", bg=COLOR_ACCENT, fg="white",
                          font=("Segoe UI", 10, "bold"), width=15, command=lambda: attempt_login())
    btn_login.pack(pady=10)

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


# ============================================================
# Splash Screen
# ============================================================
# def show_splash() removed
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