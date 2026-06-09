@echo off
echo.
echo ========================================
echo   Play Dog — Instalando dependencias
echo ========================================
echo.
cd /d "%~dp0"
npm install
echo.
echo ========================================
echo   Instalacao concluida!
echo   Agora configure o arquivo .env.local
echo   com as chaves do Supabase.
echo ========================================
pause
