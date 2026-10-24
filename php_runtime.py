"""Runtime PHP lokal; aktifkan DLL yang tersedia tanpa mengubah php.ini global."""
import os
from pathlib import Path
import shutil
import subprocess


def perintah_php():
    php = shutil.which('php')
    if not php:
        raise RuntimeError('PHP belum tersedia di PATH.')
    command = [php]
    if os.name == 'nt':
        result = subprocess.run([php, '-m'], capture_output=True, text=True,
                                timeout=10, check=True,
                                creationflags=subprocess.CREATE_NO_WINDOW)
        loaded = {line.strip().lower() for line in result.stdout.splitlines()}
        ext_dir = Path(php).resolve().parent / 'ext'
        # Path absolut tidak menimpa extension_dir dari instalasi yang sudah benar.
        for extension in ('pdo_mysql', 'mbstring', 'openssl', 'curl', 'fileinfo'):
            dll = ext_dir / f'php_{extension}.dll'
            if extension not in loaded and dll.is_file():
                command.extend(['-d', f'extension={dll}'])
    return command


if __name__ == '__main__':
    root = Path(__file__).resolve().parent
    try:
        command = perintah_php() + ['-S', 'localhost:8000', '-t', '.', 'api/index.php']
        raise SystemExit(subprocess.call(command, cwd=root / 'backend'))
    except RuntimeError as error:
        raise SystemExit(str(error)) from error
