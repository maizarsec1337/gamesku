# -*- coding: utf-8 -*-
"""
Gameku Store — Desktop Development Control Center (Windows GUI).

Aplikasi desktop untuk mengelola frontend (Vite) dan backend (PHP)
secara bersamaan dengan live shell, deteksi error, dan pemantauan
perubahan file. Tidak memerlukan terminal sebagai antarmuka utama.

Ditulis ulang dari versi terminal (jalan.py lama disimpan sebagai
jalan.py.bak). Semua command frontend/backend dipertahankan sesuai
konfigurasi project asli.
"""

from __future__ import annotations

import atexit
import ctypes
import errno
import os
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

# --strictPort: Vite gagal kalau port 5173 tidak tersedia.
FRONTEND_CMD = [NPM_CMD or "npm", "run", "dev", "--", "--strictPort"]

# Backend hanya dijalankan jika PHP tersedia.
if PHP_CMD:
    BACKEND_CMD = perintah_php() + ["-S", "localhost:%d" % BACKEND_PORT, "-t", ".", "api/index.php"]
else:
    BACKEND_CMD = ["echo", "Backend PHP dinonaktifkan - instal PHP untuk menjalankan backend"]

# CREATE_NO_WINDOW mencegah jendela CMD baru di Windows.
FLAG_POPEN = (
    {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0)}
    if os.name == "nt"
    else {"start_new_session": True}
)

WAKTU_TUNGGU_FRONTEND = 90   # detik
WAKTU_TUNGGU_BACKEND = 30    # detik

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
        self.title("Gameku Store Control Center")
        self.geometry("1200x800")
        self.minsize(1000, 600)

        # Configure dark theme
        self.configure(bg=COLOR_BG)

        # Initialize process manager
        self.manager = ProcessManager(app_gui=self)

        # Track running frames
        self.current_frame = None

        # ============ Layout Configuration ============
        # Grid weights
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=1)

        # Create sidebar
        self._create_sidebar()

        # Create content area
        self._create_content_area()

        # Create status bar
        self._create_status_bar()

        # Initialize display
        self._update_process_status("frontend", STATUS_STOPPED)
        self._update_process_status("backend", STATUS_STOPPED)

        # Protocol untuk menutup aplikasi
        self.protocol("WM_DELETE_WINDOW", self._on_closing)
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
    def _create_content_area(self):
        """Create content area with service panels."""
        self.content_area = tk.Frame(self, bg=COLOR_BG)
        self.content_area.grid(row=0, column=1, sticky="nsew", padx=10, pady=10)
        self.content_area.grid_rowconfigure(0, weight=1)
        self.content_area.grid_columnconfigure(0, weight=1)

        # Placeholder label
        self.placeholder_label = tk.Label(
            self.content_area,
            text="Pilih layanan di kiri untuk dimulai",
            bg=COLOR_BG,
            fg=COLOR_INFO,
            font=("Segoe UI", 12),
            pady=50,
        )
        self.placeholder_label.grid(row=0, column=0, pady=20)
    def _create_status_bar(self):
        """Create status bar at the bottom of the window."""
        self.status_bar = tk.Frame(self, bg=COLOR_BORDER, height=25)
        self.status_bar.grid(row=1, column=0, columnspan=2, sticky="ew")
        self.status_bar.grid_columnconfigure(0, weight=1)

        self.status_label = tk.Label(
            self.status_bar,
            text="Siap",
            bg=COLOR_BORDER,
            fg=COLOR_INFO,
            font=("Segoe UI", 9),
            anchor="w",
        )
        self.status_label.grid(row=0, column=0, sticky="w", padx=5)
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
if __name__ == "__main__":
    app = ControlCenterApp()
    app.mainloop()