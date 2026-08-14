@echo off
REM ====================================
REM BUILD SCRIPT FOR POKI SUBMISSION
REM ====================================
REM This script creates a ZIP file ready for Poki

echo.
echo ========================================
echo Fortress Defense - Poki Build Script
echo ========================================
echo.

REM Check if 7z.exe is available
where 7z.exe >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: 7-Zip not found!
    echo Please install 7-Zip or use Windows built-in compress
    echo.
    pause
    exit /b 1
)

REM Create build folder
echo [1/4] Creating build folder...
if exist fortress-defense-build (
    rmdir /s /q fortress-defense-build
)
mkdir fortress-defense-build

REM Copy files
echo [2/4] Copying files...
xcopy . fortress-defense-build /E /I /Y ^
    /EXCLUDE:exclude.txt >nul 2>&1

REM Check size
echo.
echo [3/4] Checking file size...
for /f %%A in ('powershell -Command "Get-ChildItem -Path fortress-defense-build -Recurse | Measure-Object -Property Length -Sum | ForEach-Object {$_.Sum / 1MB}"') do (
    set size=%%A
)
echo.
echo File size: %size% MB
if %size% LSS 30 (
    echo Status: OK (less than 30MB limit)
) else (
    echo WARNING: Exceeds 30MB limit!
    pause
    exit /b 1
)

REM Create ZIP
echo.
echo [4/4] Creating ZIP file...
if exist fortress-defense-poki.zip (
    del fortress-defense-poki.zip
)
7z.exe a fortress-defense-poki.zip fortress-defense-build >nul

echo.
echo ========================================
echo BUILD COMPLETE!
echo ========================================
echo.
echo Generated: fortress-defense-poki.zip
echo Ready to upload to Poki!
echo.
pause
