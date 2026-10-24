#!/usr/bin/env python3
"""Rebuild login UI and authentication in jalan.py"""

import re

with open(r'C:\Users\maizar\Documents\gamesku\gameku.store\jalan.py', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')

# Find and replace the SHOW_LOGIN function area
# We need to locate show_login and the attempt_login nested function

# Let's find line numbers
show_login_idx = None
for i, line in enumerate(lines):
    if 'def show_login():' in line:
        show_login_idx = i
        break

print(f"show_login starts at line {show_login_idx + 1}")

# Find where attempt_login is defined within show_login
attempt_login_idx = None
for i in range(show_login_idx, min(show_login_idx + 120, len(lines))):
    if 'def attempt_login' in lines[i]:
        attempt_login_idx = i
        break

print(f"attempt_login starts at line {attempt_login_idx + 1} (relative: {attempt_login_idx - show_login_idx})")

# Find the btn_login command line
for i in range(show_login_idx, min(show_login_idx + 120, len(lines))):
    if 'command=lambda: attempt_login()' in lines[i]:
        print(f"btn_login command at line {i + 1}: {lines[i]}")
        break

# Find the creds reference
for i in range(show_login_idx, min(show_login_idx + 120, len(lines))):
    if 'creds' in lines[i] and 'verify_password' in ' '.join(lines[max(0,i-2):i+3]):
        print(f"creds reference at line {i + 1}: {lines[i]}")
        break

# Find status_var references
for i in range(show_login_idx, min(show_login_idx + 120, len(lines))):
    if 'status_var' in lines[i]:
        print(f"status_var at line {i + 1}: {lines[i]}")