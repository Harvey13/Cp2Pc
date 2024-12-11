@echo off
setlocal enabledelayedexpansion

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
echo Creation du tag %VERSION%...
git tag -a %VERSION% -m "%MESSAGE%"
if errorlevel 1 (
    echo Erreur lors de la creation du tag
    exit /b 1
)

REM Pousser les changements
echo.
echo Envoi des changements vers le depot distant...
git push
if errorlevel 1 (
    echo Erreur lors de l'envoi des changements
    exit /b 1
)

REM Pousser le tag
echo.
echo Envoi du tag vers le depot distant...
git push origin %VERSION%
if errorlevel 1 (
    echo Erreur lors de l'envoi du tag
    exit /b 1
)

echo.
echo ===== Version %VERSION% creee et publiee avec succes ! =====
echo.
echo Resume des actions:
echo - Fichiers modifies ajoutes
echo - Commit cree avec le message: %VERSION%: %MESSAGE%
echo - Tag %VERSION% cree
echo - Changements pousses vers le depot distant
echo - Tag pousse vers le depot distant
echo.
