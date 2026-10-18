path = 'backend/src/Pengendali/PengendaliAnime.php'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new = []
skip_until = None
for i, line in enumerate(lines):
    if skip_until == i:
        skip_until = None
        continue
    if skip_until is not None:
        continue
    # Check if this is the first duplicate line (line 213)
    if i == 212:  # 0-based index for line 213
        # Skip this line and the next (duplicate $hasil = $kosong; and try {
        skip_until = 214  # Skip lines 214, 215, ... up to 242
        continue
    new.append(line)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new)
print('Done')
