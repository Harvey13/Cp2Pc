# Cp2Pc - Cahier des Charges

Application de copie de fichiers sans fil entre mobile et PC Windows

Le cahier des charges représente les fonctionnalités souhaitées pour le projet Cp2Pc, sans expliquer comment les implémenter.
Les fichiers mobile.md et server.md détaillent les fonctionnalités côté serveur et mobile.
Le fichier checklist.md décrit l'évolution du projet avec les éléments fonctionnels ou à modifier.

# Caractéristiques principales
---------------------------
- Découverte automatique sur le réseau local
- redémarrage du scan 3s après deconnexion
- Interface PC pour définir les mappings de dossiers
- Interface mobile pour la connexion et le suivi de copie

# Interface utilisateur du serveur (PC)
--------------------------------------
Définition
- Mapping = Multiples paires de dossiers source (mobile) / destination (PC)

## Écran principal
---------------
- LED verte indiquant la connexion au mobile
- Icône de roue dentée pour accéder à la page de configuration
- Affichage selon le scénario

## Scénarios d'affichage
---------------------
- Si aucun mapping : Grand bouton avec icône et texte pour créer un nouveau mapping
- Si au moins un mapping existe :
  - Bouton global avec icône et texte pour lancer la copie
  - Petit icône pour ajouter un nouveau mapping
  - Affichage des mappings existants : Titre, barre de progression

### Page d'édition des mappings
-----------------------------
- Bouton pour ajouter un nouveau mapping
- Pour chaque cadre de mapping :
  - Icône de suppression
  - Bouton pour l'édition du titre de la ligne
  - Chemin source avec bouton de sélection de dossier sur le mobile
  - Chemin destination avec bouton de sélection de dossier sur le PC

### Écran de configuration
-----------------------
- Icône pour paramétrer le nombre max de fichiers
- drapeau de langue pour changer la langue des IHM server et mobile
- Sauvegarde en local storage

# Interface Mobile
-----------------
- Affichage du texte "PC trouvé" avec son adresse IP et le nom du PC fourni par le serveur à la fin de la recherche
- Afficher "Recherche en cours..." pendant le scan avec une roue qui se remplie pour les adresse de 1 à 255
- Mise à jour du statut en temps réel
- Lorsque le serveur est trouvé, une led verte signale la connexion
- Lors de la copie: 
 - le titre de chaque mapping s'affiche
 - une barre de progression est affichée
 - l'avancement de la copie est affiché nombre de fichiers copiés/ nbr fichier à copier
 
# Transfert de fichiers
----------------------
Le pc a plusieurs interfaces réseaux, le prendre en compte.
Le mobile utilise sa propre adresse locale pour trouve le subnet.
L'application mobile sert d'interface pour :
- La recherche du serveur
- La copie des fichiers sélectionnés des dossiers sources vers destinations
- L'avancement de la copie
- Détection du serveur
- Reconnexion automatique en cas de perte
Si au démarrage de la copie, le nombre de fichiers dans le dossier destination est supérieur au nombre maximum défini dans la configuration, un nouveau dossier est créé avec le nom du dossier plus un numéro d'index. La destination du mapping est mise à jour automatiquement.

# Modes de fonctionnement
-----------------------
## Mode Debug (développement)
---------------------------
- Logs détaillés du scan réseau
- Affichage des adresses IP testées
- Temps de scan par IP
- Statut des connexions
- Messages d'erreur détaillés

## Mode Release (production)
-------------------------
- Logs minimaux
- Uniquement erreurs critiques
- Statut de connexion simplifié

# Règles de base ! IMPORTANT ! A APPLIQUER SYSTEMATIQUEMENT !
-------------------------
- Utilise seulement les commandes Windows pour mon projet
- Avant de créer un dossier, vérifier que celui-ci n'existe pas
- Avant de copier un fichier, verifier que celui-ci n'existe pas
- On ne commit pas des bouts de code mais des fonctionnalités qui ont été testées 
- Ne pas installer android studio sur mon pc
- pour les commit sur github, il faut mettre le message entre guillemets doubles et sur une seule ligne

