path = 'backend/src/Pengendali/PengendaliAnime.php'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new = []
skip_next = False
i = 0
while i < len(lines):
    line = lines[i]
    if skip_next:
        skip_next = False
        i += 1
        continue
    # Check for duplicate pattern at lines 213-214 (index 212-213)
    if i == 212:  # 0-based index for line 213
        stripped = line.strip()
        if stripped == '$hasil = $kosong;':
            # Skip this line (duplicate $hasil = $kosong;)
            skip_next = True  # Skip next line (try {) too
            i += 1
            continue
    new.append(line)
    i += 1

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new)
print('Done')
print('Total lines:', len(new))
