@echo off
setlocal
cd /d "%~dp0"
echo Optional public HTTP check. No administrator access is requested.
powershell.exe -NoProfile -File "%~dp0check-public.ps1" -OutFile "%~dp0public-report.json"
if errorlevel 1 (
  echo Check could not finish. Use START-HERE.html and mark unverified.
) else (
  echo Import public-report.json in START-HERE.html. Manual results remain separate.
)
pause
