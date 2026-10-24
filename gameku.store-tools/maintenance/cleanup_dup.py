# Remove duplicate credential function definitions and keep only module-level ones

# Keep _load_credentials at line 88 (module level, before class)
# Keep _verify_password at line 103 (module level)

# Remove the duplicate at lines 127-140 (_load_credentials duplicate)
# Remove the duplicate at lines 142-153 (_verify_password duplicate)
# Remove the one at line 169 with type annotation

# The show_login at line 969 calls _load_credentials() and _verify_password()
# These module-level functions should be accessible

# Delete lines 123-168 (the duplicate credential definitions)
# This includes:
# - Lines 123-126: CREDENTIALS_FILE duplicate
# - Lines 127-140: _load_credentials duplicate (with 6-space indent issue)
# - Lines 142-153: _verify_password duplicate (with 6-space indent issue)
# - Lines 155-158: DEFAULT_USERS duplicate
# - Lines 156-159: Another DEFAULT_USERS
# - Lines 161-163: _hash_password (might be needed, check)
# - Lines 165-167: _generate_salt
# - Lines 169-170: _load_credentials with type annotation

# Actually, let me be more careful. Let me check what's needed.

# The module-level functions at lines 88-114 are the good ones:
# - _load_credentials (lines 88-101)
# - _verify_password (lines 103-114)
# - DEFAULT_USERS (lines 117-121) - but this is after _verify_password

# The show_login function needs these to work. Let me just remove the duplicates
# by deleting lines 123-170 (the duplicate section).

# But wait - I need to keep the structure consistent. Let me just remove the duplicate
# credential functions and keep the first ones at lines 88-114.

# The plan:
# 1. Keep lines 1-114 as they are (module-level functions)
# 2. Remove lines 115-170 (the duplicate/extra content)
#    Actually, line 115 is empty, lines 117-121 are DEFAULT_USERS
#    Let me just remove the duplicate _load_credentials and _verify_password

# Simpler approach: Just delete the duplicate definitions at lines 127-153
# and keep the module-level ones at 88-114.

# Actually, looking at the read_files output:
# Lines 85-114: _load_credentials and _verify_password (good, module level)
# Lines 115: empty
# Lines 117-121: DEFAULT_USERS 
# Lines 123-126: CREDENTIALS_FILE duplicate
# Lines 127-140: _load_credentials duplicate (bad indent)
# Lines 142-153: _verify_password duplicate (bad indent)
# Lines 155-158: DEFAULT_USERS duplicate
# Lines 161-170: _hash_password and _generate_salt and _load_credentials -> dict

# The simplest fix: Delete lines 123-170 (the duplicate credential section)
# This leaves:
# - Lines 1-114: module-level functions including _load_credentials and _verify_password
# - Line 115: empty
# - Lines 117-121: DEFAULT_USERS (but this is after _verify_password, which is weird but OK in Python)

# Wait, DEFAULT_USERS at 117-121 is AFTER _verify_password at 103-114. In Python, this is fine - 
# the function just needs to be defined before it's called, not before the data it uses.

# Let me delete the duplicate section lines 123-170