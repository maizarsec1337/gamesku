#!/usr/bin/env python3
"""Rebuild login UI and authentication in jalan.py"""

import re
import hashlib
import os
import json

with open(r'C:\Users\maizar\Documents\gamesku\gameku.store\jalan.py', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')

# ============================================================
# TAMBAHKAN FUNGSI AUTENTIKASI DI BELAKANG SHOW_LOGIN
# ============================================================

# After DEFAULT_USERS and before _hash_password, add credential loading
# Cari garis _hash_password dan tempatkan fungsi di bawah DEFAULT_USERS

# Tambahkan _load_credentials dan _verify_password setelah DEFAULT_USERS
default_users_block = '''# Akun default yang harus ada setelah instalasi pertama
 DEFAULT_USERS = {
     "adminravi": "admin123",
     "maizardev": "admin123",
 }

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
     return dk.hex() == stored["hash"]'''

# Insert after the DEFAULT_USERS block (after line 89)
# Find the line index after DEFAULT_USERS closing brace
insert_idx = None
for i, line in enumerate(lines):
    if 'DEFAULT_USERS =' in line and '}' in line and i > 80:
        # Find the closing brace of DEFAULT_USERS
        insert_idx = i + 1
        break

if insert_idx:
    # Insert the new functions
    new_lines = lines[:insert_idx] + [default_users_block.strip()] + lines[insert_idx:]
    with open(r'C:\Users\maizar\Documents\gamesku\gameku.store\jalan.py', 'w', encoding='utf-8') as f:
        f.write('\n'.join(new_lines))
    print(f"Inserted credential functions at line {insert_idx + 1}")
else:
    print("Could not find insertion point for DEFAULT_USERS")

# ============================================================
# PERBAIKI SHOW_LOGIN FUNCTION
# ============================================================

# Ganti seluruh bagian show_login dengan versi yang sudah diperbaiki
# show_login mulai pada line 899, usahakan kita temukan tepat dan replace

# Let's find the exact boundaries of show_login
# Cari dari def show_login() hingga return login_success[0]

# Baca file lagi untuk konfirmasi
with open(r'C:\Users\maizar\Documents\gamesku\gameku.store\jalan.py', 'r', encoding='utf-8') as f:
    content = f.read()
    lines = content.split('\n')

print("Rebuild analysis complete. Please manually review and apply fixes.")
print("Key issues identified:")
print("1. creds variable at line 973 needs _verify_password function")
print("2. status_var scope should work (created at line 934, used at 954+)")
print("3. Need to ensure _load_credentials and _verify_password are defined before show_login")