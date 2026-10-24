# Script to clean up duplicate credential functions in jalan.py

with open(r'C:\Users\maizar\Documents\gamesku\gameku.store\jalan.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Delete lines 123-170 (1-indexed) = indices 122-169 (0-indexed)
# This removes the duplicate credential section
# Keep lines 1-122 (indices 0-122) and from line 171 (index 170 onwards)

new_lines = lines[:123] + lines[170:]

with open(r'C:\Users\maizar\Documents\gamesku\gameku.store\jalan.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"Cleaned up. New total lines: {len(new_lines)}")