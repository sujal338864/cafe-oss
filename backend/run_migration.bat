@echo off
for /F "tokens=1* delims==" %%A in ('.env') do (
    if "%%A"=="DIRECT_URL" set DIRECT_URL=%%~B
)
echo Running migration against: %DIRECT_URL%
psql "%DIRECT_URL%" -f prisma\rls_migration.sql
echo Done!
