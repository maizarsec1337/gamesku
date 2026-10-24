import sys
import os
sys.path.insert(0, 'c:\\Users\\maizar\\Documents\\gamesku\\gameku.store')

# Change to project directory to ensure correct path resolution
os.chdir('c:\\Users\\maizar\\Documents\\gamesku\\gameku.store')

from jalan import _load_credentials, _verify_password

creds = _load_credentials()
lines = []
lines.append("Credentials loaded: " + str(len(creds) if creds else 0) + " users")
lines.append("")

# Test with adminravi / admin123
result = _verify_password("adminravi", "admin123", creds)
lines.append("adminravi / admin123 valid: " + str(result))

# Test with maizardev / admin123
result2 = _verify_password("maizardev", "admin123", creds)
lines.append("maizardev / admin123 valid: " + str(result2))

# Test with wrong password
result3 = _verify_password("adminravi", "wrongpassword", creds)
lines.append("adminravi / wrongpassword valid: " + str(result3))

# Test with nonexistent user
result4 = _verify_password("nonexistent", "admin123", creds)
lines.append("nonexistent / admin123 valid: " + str(result4))

# Write to file
with open('c:\\Users\\maizar\\Documents\\gamesku\\login_result.txt', 'w') as f:
    f.write('\n'.join(lines))

# Also print to stdout
print('\n'.join(lines))