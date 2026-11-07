@echo off
chcp 65001 >nul
title [DEV] Servidor SIO - Automatización OS GHA (Modo Desarrollo con Nodemon)
cd /d "%~dp0"

echo ===================================================================
echo     SERVIDOR SIO - MODO DESARROLLO (RECARGA AUTOMÁTICA)
echo ===================================================================
echo.
echo [INFO] Cualquier cambio guardado en server.js, src/ o public/
echo        reiniciará el servidor automáticamente.
echo [INFO] Abriendo en su navegador: http://localhost:3080
echo.
start "" "http://localhost:3080"
npm run dev

