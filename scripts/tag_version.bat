@echo off
setlocal

REM Verifier si un parametre a ete fourni
if "%~1"=="" (
    echo Usage: tag_version.bat v0.XX "Message de version"
    echo Exemple: tag_version.bat v0.03 "Ajout de la memorisation des IPs serveur"
    exit /b 1
)

REM Verifier si un message a ete fourni
if "%~2"=="" (
    echo Usage: tag_version.bat v0.XX "Message de version"
    echo Exemple: tag_version.bat v0.03 "Ajout de la memorisation des IPs serveur"
    exit /b 1
)

REM Recuperer la version et le message
set VERSION=%~1
set MESSAGE=%~2

REM Verifier si on est dans un repo git
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo Erreur: Ce n'est pas un depot git
    exit /b 1
)

REM Se deplacer dans le repertoire racine du projet
cd ..

echo.
echo ===== Processus de versioning %VERSION% =====
echo.

REM Stage tous les fichiers modifies
echo Ajout des fichiers modifies...
git add .
if errorlevel 1 (
    echo Erreur lors de l'ajout des fichiers
    exit /b 1
)

REM Creer le commit
echo.
echo Creation du commit...
git commit -m "%VERSION%: %MESSAGE%"
if errorlevel 1 (
    echo Erreur lors de la creation du commit
    exit /b 1
)

REM Creer le tag
echo.
echo Creation du tag...
git tag -a %VERSION% -m "%MESSAGE%"
if errorlevel 1 (
    echo Erreur lors de la creation du tag
    exit /b 1
)

REM Push le tag
echo.
echo Push du tag...
git push origin %VERSION%
if errorlevel 1 (
    echo Erreur lors du push du tag
    exit /b 1
)

REM Push les changements
echo.
echo Push des changements...
git push
if errorlevel 1 (
    echo Erreur lors du push des changements
    exit /b 1
)

echo.
echo ===== Version %VERSION% creee et publiee avec succes =====
echo.
