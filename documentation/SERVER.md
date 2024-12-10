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

#### Serveur Express (/server/main.js)
- Port d'écoute : 3000
- Endpoints :
  - `/ping` : Endpoint de découverte et keepalive
  - Routes statiques pour l'interface web

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
  - Nombre maximum de fichiers
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
- Utilisation des commandes Windows natives

## État Actuel du Développement (v0.01)

### Fonctionnalités Implémentées
- Découverte automatique sur le réseau local
- Détection intelligente des déconnexions
- Interface de base
- Configuration système

### En Cours de Développement
- Transfert de fichiers
- Interface de mapping complète
- Gestion des erreurs avancée

## Notes pour les Développeurs
1. Le serveur utilise des variables globales pour l'état - attention aux race conditions
2. Les timeouts sont configurés pour un réseau local standard
3. Le mode debug est activé via NODE_ENV=development
