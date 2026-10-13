$root = 'c:\Users\maizar\Documents\gamesku\gameku.store'
$files = Get-ChildItem -Path $root -Recurse -File -Include *.jsx,*.js,*.css,*.html,*.json,*.php,*.sql,*.md,*.txt,*.mjs | Where-Object { $_.FullName -notmatch 'node_modules|\.git\\|package-lock\.json' }
$count = 0
foreach ($f in $files) {
  $t = Get-Content -Raw -Encoding UTF8 $f.FullName
  $o = $t
  $t = $t -creplace 'RAK VIN', 'Gamesku'
  $t = $t -creplace 'Rak Vin', 'Gamesku'
  $t = $t -creplace 'rakvin', 'gamesku'
  $t = $t -creplace 'RAKVIN', 'GAMESKU'
  $t = $t -creplace 'GameSKU', 'Gamesku'
  $t = $t -creplace 'GameKU', 'Gamesku'
  $t = $t -creplace 'Gameku', 'Gamesku'
  $t = $t -creplace 'GAMEKU', 'GAMESKU'
  $t = $t -creplace 'gameku', 'gamesku'
  $t = $t -creplace 'StreamKU', 'Streamku'
  $t = $t -creplace 'STREAMKU', 'STREAMKU'
  if ($t -cne $o) { Set-Content -Encoding UTF8 $f.FullName $t; $count++ }
}
"OK ganti isi: $count file"
