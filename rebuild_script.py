#!/usr/bin/env python3
"""Complete rebuild of login authentication in jalan.py"""

import os

# Read current file
with open(r'C:\Users\maizar\Documents\gamesku\gameku.store\jalan.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the line numbers we need to modify
# Line 83: USER_DATA_FILE - keep or replace
# Lines 85-89: credential section - replace
# Lines 91-115: _load_credentials and _verify_password - fix indentation

# Let's identify what needs to be replaced and create new content

# First, let's find where DEFAULT_USERS ends and _hash_password begins
# and where show_login starts

# We need to:
# 1. Fix _load_credentials and _verify_password indentation
# 2. Fix show_login to use _verify_password instead of verify_password/creds

# Let me find the exact boundaries

# Find _hash_password start
hash_pw_idx = None
for i, line in enumerate(lines):
    if 'def _hash_password' in line:
        hash_pw_idx = i
        break

print(f"_hash_password starts at line {hash_pw_idx + 1}")

# Find show_login start
show_login_idx = None
for i, line in enumerate(lines):
    if 'def show_login():' in line:
        show_login_idx = i
        break

print(f"show_login starts at line {show_login_idx + 1}")

# Let's just fix the indentation issue in _load_credentials and _verify_password
# First, find the exact lines with wrong indentation

for i in range(88, min(120, len(lines))):
    if 'def _load_credentials' in lines[i] or 'def _verify_password' in lines[i]:
        print(f"Line {i+1}: {repr(lines[i])}")