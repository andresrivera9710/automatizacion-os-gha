@echo off
chcp 65001 >nul
title Servidor SIO - Automatización OS GHA (Node.js & Express)
cd /d "%~dp0"

echo ===================================================================
echo     SERVIDOR SIO - AUTOMATIZACIÓN DE ÓRDENES DE SERVICIO (GHA)
echo                  ARQUITECTURA NODE.JS + EXPRESS
echo ===================================================================
echo.

:: Verificar si Node.js está disponible
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js no se encuentra instalado o no está en el PATH del sistema.
    echo Por favor instale Node.js versión 18 o superior para ejecutar este servidor.
    echo Puede descargarlo desde: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Verificar dependencias
if not exist "node_modules\" (
    echo [INFO] Primera ejecución detectada. Instalando dependencias de producción...
    call npm install --omit=dev
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Ocurrió un problema instalando las dependencias.
        pause
        exit /b 1
    )
)

echo [1/2] Iniciando servidor Express en puerto 3080...
echo [2/2] Abriendo en su navegador: http://localhost:3080
echo.
start "" "http://localhost:3080"
npm start

