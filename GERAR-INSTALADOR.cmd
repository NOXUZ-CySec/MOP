@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto semnode
node -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)"
if errorlevel 1 goto semnode
if exist package-lock.json (call npm ci) else (call npm install)
if errorlevel 1 goto erro
call npm test
if errorlevel 1 goto erro
call npm run dist:win
if errorlevel 1 goto erro
echo.
echo Instalador gerado na pasta dist.
explorer "%~dp0dist"
pause
exit /b 0
:semnode
echo Instale Node.js 24 LTS em https://nodejs.org/ e abra este arquivo novamente.
pause
exit /b 1
:erro
echo.
echo Nao foi possivel concluir. Copie a mensagem de erro acima para diagnostico.
pause
exit /b 1
