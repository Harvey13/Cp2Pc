# Documentation Serveur Cp2Pc

## Architecture

### Backend (Node.js + Express)
- Serveur HTTP pour l'interface web
- API REST pour la gestion des mappings
- Gestion des opérations de fichiers
- Système de notifications en temps réel
- Validation des données entrantes
- Gestion automatique des dossiers de destination

### Frontend (HTML + CSS + JavaScript)
- Interface utilisateur responsive
- Gestion d'état côté client
- Validation des formulaires
- Retour visuel des actions
- Gestion des erreurs

## API REST

### Mappings
- GET /api/mappings : Liste des mappings
- POST /api/mappings : Création d'un mapping
- PUT /api/mappings/:id : Mise à jour d'un mapping
- DELETE /api/mappings/:id : Suppression d'un mapping
- POST /api/mappings/:id/start : Lancement d'un mapping
- POST /api/mappings/start-all : Lancement de tous les mappings

### Opérations
- POST /api/copy/start : Démarrage d'une copie
  - Vérifie le nombre de fichiers dans le dossier destination
  - Compare avec le nombre maximum défini dans la configuration
  - Crée un nouveau dossier si la limite est dépassée (index incrémental)
  - Met à jour le chemin de destination du mapping
- POST /api/copy/cancel : Annulation d'une copie
- GET /api/copy/status : État de la copie en cours

## Gestion des Fichiers
- Validation des chemins
- Vérification des permissions
- Gestion des erreurs de fichiers
- Copie asynchrone
- Surveillance de la progression
- Création automatique de dossiers indexés selon la limite de fichiers
- Gestion des limites de fichiers par dossier

## Sécurité
- Validation des entrées
- Protection contre les injections
- Gestion des erreurs sécurisée
- Limitation des accès fichiers
- Prévention des actions simultanées

## Configuration
- Paramètres du serveur
- Gestion des modes (local/mobile)
- Configuration des chemins
- Options de logging
- Paramètres de sécurité
- Limite maximale de fichiers par dossier
