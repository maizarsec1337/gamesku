import hashlib
salt = 'd2ff584d070502b2d3a3807d738c8d42'
dk = hashlib.pbkdf2_hmac('sha256', b'admin123', bytes.fromhex(salt), 150000)
print("Computed hash:", dk.hex())
print("Stored hash:  977bbb49c743ceb0fa925866b2c996a2f00443d77feed5c0b8214974d7973693")
print("Match:", dk.hex() == '977bbb49c743ceb0fa925866b2c996a2f00443d77feed5c0b8214974d7973693')