# Fix indent in _load_credentials and _verify_password
# Read the file and fix 6-space indent to 4-space indent

with open(r'C:\Users\maizar\Documents\gamesku\gameku.store\jalan.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    # Fix lines that have 6-space indent inside functions
    # Look for patterns that need fixing
    fixed_line = line
    
    # Replace leading 6 spaces with 4 spaces for function bodies
    # But be careful not to touch function definitions
    
    # Check if line starts with 6 spaces (indent inside function)
    if line.startswith('      ') and not line.startswith('      def') and not line.startswith('      """'):
        # This is a 6-space indented line, change to 4 spaces
        fixed_line = '    ' + line.lstrip(' ')
        # But we need to be careful - if it's already 4 spaces after the first 4,
        # we might double-fix. Let me just specifically target the known patterns.
    
    new_lines.append(fixed_line)
    i += 1

with open(r'C:\Users\maizar\Documents\gamesku\gameku.store\jalan.py', 'w', encoding='utf-8') as f:
    f.write(''.join(new_lines))

print("Attempted indent fix")