# Documentation Technique du Serveur Cp2Pc

## Technologies Utilisées

### Framework Principal
- **Electron** (v33.2.1) : Framework pour créer l'application desktop
- **Express** (v4.18.2) : Serveur HTTP pour la communication avec le mobile
- **Socket.IO** (v4.7.4) : Communication bidirectionnelle en temps réel

### Dépendances Principales
- **electron-store** : Stockage persistant de la configuration
- **bonjour-service** : Service de découverte réseau
- **@fortawesome/fontawesome-free** : Icônes pour l'interface

## Architecture du Serveur

### 1. Structure des Processus
- **Processus Principal** (main.js) : Gère l'application Electron et le serveur Express
- **Processus de Rendu** : Interface utilisateur avec HTML/CSS/JS

### 2. Composants Principaux

#### Backend (Node.js + Express)
- Serveur HTTP pour l'interface web
- API REST pour la gestion des mappings
- Gestion des opérations de fichiers
- Système de notifications en temps réel
- Validation des données entrantes
- Gestion automatique des dossiers de destination

#### Frontend (HTML + CSS + JavaScript)
- Interface utilisateur responsive
- Gestion d'état côté client
- Validation des formulaires
- Retour visuel des actions
- Gestion des erreurs

#### API REST
- GET /api/mappings : Liste des mappings
- POST /api/mappings : Création d'un mapping
- PUT /api/mappings/:id : Mise à jour d'un mapping
- DELETE /api/mappings/:id : Suppression d'un mapping
- POST /api/mappings/:id/start : Lancement d'un mapping
- POST /api/mappings/start-all : Lancement de tous les mappings
- POST /api/copy/start : Démarrage d'une copie
- POST /api/copy/cancel : Annulation d'une copie
- GET /api/copy/status : État de la copie en cours
- GET /ping : Endpoint de découverte et keepalive

#### Gestion des Connexions
- Détection automatique des déconnexions
- Intervalle de ping : 1000ms (côté mobile)
- Timeout de déconnexion : 2000ms (2x l'intervalle mobile)
- Variables d'état :
  ```javascript
  let connectedMobileIP = null;  // IP du mobile connecté
  let lastPingTime = null;       // Timestamp du dernier ping
  let lastPingInterval = null;   // Intervalle entre les pings
  ```

#### Configuration (/server/config.js)
- Mode développement/production
- Paramètres configurables :
  - Nombre maximum de fichiers par dossier
  - Langue de l'interface
  - Mappings de dossiers

### 3. Système de Logging
- Logs détaillés en mode développement
- Logs minimaux en production
- Catégories de logs :
  - Connexion/Déconnexion
  - Erreurs
  - Transferts de fichiers

### 4. Interface Utilisateur
- Interface web servie par Express
- Composants principaux :
  - LED de statut de connexion
  - Gestion des mappings
  - Configuration système

### 5. Communication Mobile-Serveur
- Protocole :
  1. Le mobile scanne le réseau (ports 3000)
  2. Ping/Pong pour la découverte
  3. Keepalive toutes les secondes
  4. Déconnexion automatique après 2 secondes sans ping

### 6. Gestion des Fichiers
- Système de mapping source/destination
- Vérification d'existence avant création
- Utilisation de fs.copyFile pour la copie des fichiers
- Aucun fichier sur le dossier destination ne doit être effacé
- Gestion intelligente des dossiers de destination :
  - Réutilisation des dossiers non pleins
  - Création automatique de nouveaux dossiers quand la limite est atteinte
  - Indexation incrémentale (_01, _02, etc.)
- Filtrage des fichiers :
  - Utilisation de la date du fichier le plus récent dans le dossier destination
  - Vérification dans tous les dossiers indexés, en priorité le plus récent
  - Ignore les fichiers .picasa.ini
- Validation et sécurité :
  - Validation des chemins
  - Vérification des permissions
  - Gestion des erreurs de fichiers
  - Copie asynchrone avec surveillance de la progression

## État Actuel du Développement (v0.18)

### Fonctionnalités Implémentées
- Découverte automatique sur le réseau local
- Détection intelligente des déconnexions
- Interface de base
- Configuration système
- Gestion intelligente des dossiers de destination
- Copie fiable des fichiers avec fs.copyFile
- Filtrage des fichiers .picasa.ini

### En Cours de Développement
- Interface de mapping complète
- Gestion des erreurs avancée

## Notes pour les Développeurs
1. Le serveur utilise des variables globales pour l'état - attention aux race conditions
2. Les timeouts sont configurés pour un réseau local standard
3. Le mode debug est activé via NODE_ENV=development
