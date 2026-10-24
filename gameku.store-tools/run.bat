@echo off
setlocal enableextensions
cd /d "%~dp0"
set "ROOT=%CD%\.."
set "APP=%ROOT%\gameku.store"
set "PHP=C:\Users\maizar\php84\php.exe"
set "NODE=node"

if "%~1"=="" (
  echo Usage: run.bat [audit^|check^|test^|build^|security]
  exit /b 1
)

if /i "%~1"=="audit" goto audit
if /i "%~1"=="check" goto check
if /i "%~1"=="test" goto test
if /i "%~1"=="build" goto build
if /i "%~1"=="security" goto security

echo Unknown command: %~1
echo Usage: run.bat [audit^|check^|test^|build^|security]
exit /b 1

:audit
echo === Audit: struktur ===
if exist "%APP%\frontend\package.json" echo [OK] frontend/package.json
if exist "%APP%\backend\package.json" echo [OK] backend/package.json
if exist "%APP%\frontend\vite.config.js" echo [OK] frontend/vite.config.js
if exist "%APP%\backend\tests\jalankan.php" echo [OK] backend/tests/jalankan.php
cd /d "%ROOT%"
git status --short
exit /b 0

:check
echo === Check: runtime ===
where %NODE% >nul 2>&1 && echo [OK] node || echo [FAIL] node
if exist "%PHP%" (echo [OK] php) else (echo [FAIL] php)
cd /d "%APP%\backend"
if exist package.json npm run check
exit /b 0

:test
echo === Test: backend ===
if exist "%PHP%" (
  cd /d "%APP%\backend"
  "%PHP%" tests\jalankan.php
) else (
  echo [FAIL] php not found
)
echo === Test: frontend ===
cd /d "%APP%\frontend"
if exist package.json npm run test
exit /b 0

:build
echo === Build: frontend ===
cd /d "%APP%\frontend"
npm run build
exit /b 0

:security
echo === Security: backend basic ===
if exist "%PHP%" (
  cd /d "%APP%\backend"
  "%PHP%" security-check.php
) else (
  echo [FAIL] php not found
)
exit /b 0