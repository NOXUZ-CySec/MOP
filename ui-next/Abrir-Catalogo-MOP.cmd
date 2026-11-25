@echo off
cd /d "%~dp0"
node ".storybook\serve.mjs" --open
if errorlevel 1 pause
