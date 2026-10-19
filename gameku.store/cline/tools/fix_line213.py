path = 'backend/src/Pengendali/PengendaliAnime.php'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Fix line 213 (index 212): should be is_string($isi) not is_string()
lines[212] = "            if (is_string($isi) && $isi !== '') {'" + chr(10)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Fixed line 213')
