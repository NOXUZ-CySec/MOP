@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto semnode
node -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)"
if errorlevel 1 goto semnode
call npm ci --no-audit --no-fund
if errorlevel 1 goto erro
call npm --prefix ui-next ci --no-audit --no-fund
if errorlevel 1 goto erro
call npm run test:foundation
if errorlevel 1 goto erro
call npm run dist:portable
if errorlevel 1 goto erro
for /f "delims=" %%i in ('node -p "require('./electron-builder-preview.cjs').directories.output"') do set "MOP_BUILD_OUTPUT=%%i"
echo Executavel portatil gerado em %MOP_BUILD_OUTPUT%.
explorer "%~dp0%MOP_BUILD_OUTPUT%"
pause
exit /b 0
:semnode
echo Instale uma versao suportada do Node.js 24 ou superior. Consulte BUILDING.md.
pause
exit /b 1
:erro
echo Nao foi possivel concluir. Consulte a mensagem acima e BUILDING.md.
pause
exit /b 1
