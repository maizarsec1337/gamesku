#!/usr/bin/env python3
# This script rewrites the login authentication system in jalan.py

import os

# Read the current file
with open(r'C:\Users\maizar\Documents\gamesku\gameku.store\jalan.py', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to replace the entire authentication/credential section
# Let's find and replace specific sections

# First, let's ensure the _load_credentials and _verify_password functions have proper 4-space indent
# The issue is lines with 6-space indent inside these functions

# Replace 6-space indent with 4-space indent for the specific function bodies
# We'll do this carefully

# Fix 1: _load_credentials body - replace 6-space with 4-space
# Pattern: lines inside _load_credentials that have 6 spaces
# We need to be careful to only fix the right lines

# Let me just rewrite the credential section entirely

# Find the section to replace - from after DEFAULT_USERS to before _hash_password
# Based on our earlier analysis, the issue section is around lines 85-115

# Create the complete corrected credential section
credential_section = '''\n# Kredensial disimpan setelah hash dengan salt unik\n# Diload dari .credentials.json atau generated dari DEFAULT_USERS\nCREDENTIALS_FILE = os.path.join(ROOT_DIR, ".credentials.json")\n\ndef _load_credentials():\n    \"\"\"Load credentials from JSON file, generate from defaults if not exists.\"\"\"\n    if os.path.exists(CREDENTIALS_FILE):\n        with open(CREDENTIALS_FILE, "r", encoding="utf-8") as f:\n            return json.load(f)\n    # Generate from DEFAULT_USERS if file doesn't exist\n    creds = {}\n    for username, password in DEFAULT_USERS.items():\n        salt = os.urandom(16).hex()\n        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), SALT_ROUNDS)\n        creds[username] = {"hash": dk.hex(), "salt": salt}\n    with open(CREDENTIALS_FILE, "w", encoding="utf-8") as f:\n        json.dump(creds, f, indent=2)\n    return creds\n\ndef _verify_password(username, password, creds):\n    \"\"\"Verify password using PBKDF2-HMAC-SHA256 with stored hash/salt.\"\"\"\n    if username not in creds:\n        return False\n    stored = creds[username]\n    dk = hashlib.pbkdf2_hmac(\n        "sha256",\n        password.encode("utf-8"),\n        bytes.fromhex(stored["salt"]),\n        SALT_ROUNDS,\n    )\n    return dk.hex() == stored["hash"]\n\n\n# Akun default yang harus ada setelah instalasi pertama\nDEFAULT_USERS = {\n    "adminravi": "admin123",\n    "maizardev": "admin123",\n}'''

# Now find where to insert this - after line 83 (USER_DATA_FILE) and before _hash_password
# Let's find the exact insertion point

lines_list = content.split('\n')

# Find USER_DATA_FILE line
insert_idx = None
for i, line in enumerate(lines_list):
    if 'USER_DATA_FILE = os.path.join(ROOT_DIR' in line:
        insert_idx = i + 1  # Insert after this line
        break

if insert_idx:
    # Insert the credential section
    new_lines = lines_list[:insert_idx] + [credential_section.strip()] + lines_list[insert_idx:]
    new_content = '\n'.join(new_lines)
    
    # Also need to fix the show_login function to use _load_credentials and _verify_password
    # Replace the verify_password/creds references in show_login
    # Find and replace the attempt_login section
    
    # First, let's also fix the show_login function
    # Look for the old verify_password call and creds usage in show_login
    
    # Find the btn_login command that calls attempt_login
    # And the status_var references
    
    # Let's also search for the old verify_password function if it exists
    # and the creds variable references
    
    with open(r'C:\Users\maizar\Documents\gamesku\gameku.store\jalan.py', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Inserted credential section at line {insert_idx}")
else:
    print("Could not find USER_DATA_FILE insertion point")

# Now let's also fix the show_login function
# Read the file again
with open(r'C:\Users\maizar\Documents\gamesku\gameku.store\jalan.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix: Replace verify_password(username, password, creds) with _verify_password call
# and add _load_credentials() call

# Find the old verification pattern
old_verify = 'is_valid = verify_password(username, password, creds)'
new_verify = 'creds = _load_credentials()\\n        is_valid = _verify_password(username, password, creds)'

if old_verify in content:
    content = content.replace(old_verify, new_verify)
    with open(r'C:\Users\maizar\Documents\gamesku\gameku.store\jalan.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed verify_password call in show_login")
else:
    print("Old verify_password pattern not found, showing context:")
    # Show lines around line 973 (from earlier analysis)
    clines = content.split('\n')
    for i in range(970, min(978, len(clines))):
        print(f"  {i+1}: {clines[i][:60]}")