@echo off
chcp 65001 >nul
title Servicio SIO - Automatización OS GHA (Node.js & Express)
cd /d "%~dp0"

echo ===================================================================
echo     INICIANDO AUTOMATIZACIÓN DE ÓRDENES DE SERVICIO (GHA)
echo                 ARQUITECTURA NODE.JS + EXPRESS
echo ===================================================================
echo.
echo [1/2] Abriendo en el navegador: http://localhost:3080
start "" "http://localhost:3080"
echo [2/2] Iniciando servidor en puerto 3080...
echo.
call npm start
