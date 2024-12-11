# Historique des versions

## v0.06 (2024-12-11)

### Améliorations
- Refonte complète de l'interface utilisateur du serveur :
  - Implémentation d'une architecture basée sur les Web Components
  - Création de composants réutilisables (NoMappingView, MappingList, MappingEditor)
  - Amélioration de la gestion des états et des événements
- Amélioration de la gestion des connexions :
  - Augmentation du timeout de ping à 5 secondes pour plus de stabilité
  - Ajout de logs détaillés pour le diagnostic des connexions
  - Meilleure gestion des reconnexions

### Technique
- Migration de l'API Electron vers une nouvelle structure :
  - Séparation claire entre les APIs frontend et backend
  - Utilisation du namespace 'api' pour toutes les interactions IPC
  - Amélioration de la gestion des erreurs et des événements asynchrones
- Refactoring du code :
  - Séparation des styles dans des fichiers CSS dédiés
  - Meilleure organisation des composants JavaScript
  - Amélioration de la gestion de la configuration

## v0.05 (2024-12-11)

### Corrections
- Correction de la sélection des dossiers dans la fenêtre de mapping
- Ajout des devtools en mode développement dans la fenêtre de mapping
- Amélioration de la gestion des événements IPC pour la sélection des dossiers
- Correction des IDs des champs dans le formulaire de mapping
- Ajout de logs détaillés pour faciliter le débogage

## v0.03 (2024-12-10)

### Améliorations
- Suppression du système d'IPs prioritaires statiques
- Implémentation d'un système de mémorisation des IPs serveur :
  - Sauvegarde des 5 dernières IPs où un serveur a été trouvé
  - Stockage persistant dans le localStorage
  - Scan prioritaire des dernières IPs connues
- Optimisation du processus de découverte :
  - Scan rapide des dernières IPs connues
  - Scan complet du réseau uniquement si nécessaire

### Technique
- Ajout d'un script de versioning automatisé
- Configuration du timeout de scan à 100ms

## v0.02 (2024-12-10)

### Améliorations
- Amélioration de la détection de perte de connexion mobile :
  - Ajout d'un timeout de 2 secondes sur les pings keepalive
  - Détection plus rapide de la perte de connexion au serveur
- Amélioration des logs :
  - Ajout de logs détaillés pour le scan réseau
  - Ajout de logs pour l'envoi et la réception des pings
  - Affichage du temps de réponse des pings
- Amélioration de l'interface utilisateur :
  - Messages sur deux lignes pour une meilleure lisibilité
  - Affichage distinct du nom du serveur et de son IP

### Corrections
- Correction du problème de notification de l'IHM lors de la perte de connexion
- Correction du délai de détection de perte de connexion (était > 1 minute, maintenant 2 secondes)
- Amélioration de la précision de l'intervalle entre les pings

## v0.01 (2024-12-09)

### Fonctionnalités initiales
- Mise en place du serveur Electron avec :
  - Serveur HTTP Express
  - Communication Socket.IO
  - Système de logs configurables
- Implémentation de la découverte du serveur sur le mobile :
  - Scan du réseau par batches
  - Gestion des IPs prioritaires
  - Système de retry automatique
- Système de keepalive :
  - Pings toutes les secondes depuis le mobile
  - Timeout de 2 secondes côté serveur
  - Redémarrage automatique du scan en cas de perte de connexion
- Interface utilisateur mobile :
  - Affichage de l'état de la connexion
  - Indicateur visuel (couleurs)
  - Messages d'état
