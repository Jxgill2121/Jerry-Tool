@echo off
echo ================================
echo  Jerry - Updating to latest...
echo ================================
echo.

:: Pull latest code from GitHub
echo [1/3] Downloading latest code...
git fetch origin main
git checkout main
git reset --hard origin/main
if errorlevel 1 ( echo ERROR: git pull failed. Check your internet connection. & pause & exit /b 1 )

:: Rebuild frontend
echo.
echo [2/3] Rebuilding the app...
cd frontend
call npm install --silent
call npm run build
cd ..
if errorlevel 1 ( echo ERROR: Build failed. & pause & exit /b 1 )

:: Restart the server
echo.
echo [3/3] Restarting server...
pm2 restart jerry
if errorlevel 1 ( echo ERROR: Could not restart. Is PM2 running? Try: pm2 start jerry & pause & exit /b 1 )

echo.
echo ================================
echo  Done! Jerry is up to date.
echo  http://localhost:80
echo ================================
pause
