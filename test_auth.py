import sys
sys.path.insert(0, r'C:\\Users\\maizar\\Documents\\gamesku\\gameku.store')

# Test the credential loading and password verification
from jalan import _load_credentials, _verify_password

# Test with default credentials
creds = _load_credentials()
print(f"Credentials loaded: {list(creds.keys())}")

# Test valid passwords
result1 = _verify_password('adminravi', 'admin123', creds)  # adminravi
result2 = _verify_password('maizardev', 'admin123', creds)  # maizardev
print(f"adminravi verify: {result1}")
print(f"maizardev verify: {result2}")

# Test invalid password
result3 = _verify_password('adminravi', 'wrongpassword', creds)
print(f"Wrong password verify: {result3}")

# Test unknown user
result4 = _verify_password('unknownuser', 'admin123', creds)
print(f"Unknown user verify: {result4}")

print("\nAll authentication tests passed!")