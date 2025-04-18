@echo off
REM filepath: c:\Users\Lenovo\Documents\DiscordSelfBot\Autovoice\start.bat
TITLE Discord Autovoice Self Bot

echo Starting Discord Autovoice Self Bot...
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Node.js is not installed or not in PATH. Please install Node.js and try again.
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo npm is not installed or not in PATH. Please install npm and try again.
    pause
    exit /b 1
)

REM Check if node_modules exists, if not install dependencies
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo Failed to install dependencies.
        pause
        exit /b 1
    )
)

REM Run the bot using the dev script from package.json
echo Running Discord Autovoice Self Bot...
call npm run dev

REM If the bot crashes, don't close the window immediately
if %ERRORLEVEL% neq 0 (
    echo.
    echo The bot has crashed with error code %ERRORLEVEL%.
    echo Check the logs for more information.
)

pause