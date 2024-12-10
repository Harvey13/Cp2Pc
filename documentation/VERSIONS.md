# Historique des versions

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
