@echo off
chcp 65001 > nul
setlocal

REM Vérifier si un paramètre a été fourni
if "%~1"=="" (
    echo Usage: tag_version.bat v0.XX "Message de version"
    echo Exemple: tag_version.bat v0.03 "Ajout de la mémorisation des IPs serveur"
    exit /b 1
)

REM Vérifier si un message a été fourni
if "%~2"=="" (
    echo Usage: tag_version.bat v0.XX "Message de version"
    echo Exemple: tag_version.bat v0.03 "Ajout de la mémorisation des IPs serveur"
    exit /b 1
)

REM Récupérer la version et le message
set VERSION=%~1
set MESSAGE=%~2

REM Vérifier si on est dans un repo git
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo Erreur: Ce n'est pas un dépôt git
    exit /b 1
)

echo.
echo ===== Processus de versioning %VERSION% =====
echo.

REM Stage tous les fichiers modifiés
echo Ajout des fichiers modifiés...
git add .
if errorlevel 1 (
    echo Erreur lors de l'ajout des fichiers
    exit /b 1
)

REM Créer le commit
echo.
echo Création du commit...
git commit -m "%VERSION%: %MESSAGE%"
if errorlevel 1 (
    echo Erreur lors de la création du commit
    exit /b 1
)

REM Créer le tag
echo.
echo Création du tag %VERSION%...
git tag -a %VERSION% -m "%MESSAGE%"
if errorlevel 1 (
    echo Erreur lors de la création du tag
    exit /b 1
)

REM Pousser les changements
echo.
echo Envoi des changements vers le dépôt distant...
git push
if errorlevel 1 (
    echo Erreur lors de l'envoi des changements
    exit /b 1
)

REM Pousser le tag
echo.
echo Envoi du tag vers le dépôt distant...
git push origin %VERSION%
if errorlevel 1 (
    echo Erreur lors de l'envoi du tag
    exit /b 1
)

echo.
echo ===== Version %VERSION% créée et publiée avec succès ! =====
echo.
echo Résumé des actions:
echo - Fichiers modifiés ajoutés
echo - Commit créé avec le message: %VERSION%: %MESSAGE%
echo - Tag %VERSION% créé
echo - Changements poussés vers le dépôt distant
echo - Tag poussé vers le dépôt distant
echo.
