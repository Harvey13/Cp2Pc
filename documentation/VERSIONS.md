# Historique des versions

## v0.13 (2024-12-13)
### Améliorations
- Ajout d'un bouton de lancement individuel pour chaque mapping
- Désactivation des boutons de lancement pendant une copie en cours
- Harmonisation des styles des boutons d'action (lancement, édition, suppression)

## v0.12 (2024-12-13)
### Nouvelles fonctionnalités
- Ajout d'une barre de progression pour la copie des fichiers
- Bouton d'annulation pendant la copie
- Affichage détaillé de la progression (fichiers copiés/total)

### Améliorations
- Interface utilisateur plus réactive pendant la copie
- Meilleure gestion des erreurs et de l'annulation
- Messages de progression plus détaillés

## v0.11 (2024-12-13)
### Nouvelles fonctionnalités
- Ajout du mode local permettant la copie sans appareil mobile
- Nouveau panneau de configuration avec options de mode local

### Améliorations
- Interface de configuration plus intuitive
- Sauvegarde automatique des préférences utilisateur

## v0.10 (2024-12-13)

### Améliorations
- Amélioration de l'affichage des messages d'erreur (plus simples et concis)
- Correction du bouton d'ajout de mapping (+)
- Ajout d'une checklist de tests complète

### Corrections
- Simplification de l'interface des messages d'erreur
- Correction de l'ouverture de la fenêtre d'édition lors du clic sur le bouton d'ajout

## v0.09 (2024-12-13)

### Améliorations
- Implémentation de la suppression des mappings :
  - Ajout de la fonction deleteMapping à l'API
  - Gestion de la suppression dans le processus principal
  - Mise à jour automatique de l'interface après suppression
- Optimisation de l'interface utilisateur :
  - Restauration des icônes pour les boutons d'action
  - Amélioration de la mise en page des mappings
  - Meilleure gestion des événements de suppression

### Technique
- Amélioration de la gestion des IPC :
  - Ajout du handler delete-mapping
  - Gestion des erreurs et logging
  - Mise à jour de la configuration après suppression

## v0.08 (2024-12-12)

### Améliorations
- Implémentation de la sauvegarde des mappings :
  - Ajout des fonctions createMapping et updateMapping à l'API
  - Gestion de la création et mise à jour des mappings dans le processus principal
  - Génération automatique d'IDs uniques pour les nouveaux mappings
  - Sauvegarde persistante dans la configuration

### Technique
- Amélioration de la gestion des IPC :
  - Ajout des handlers pour la création et mise à jour des mappings
  - Meilleure gestion des erreurs avec logging
  - Optimisation de la sauvegarde de la configuration

## v0.07 (2024-12-12)

### Améliorations
- Correction de l'affichage de l'éditeur de mapping :
  - Correction du positionnement et de la visibilité de l'éditeur
  - Amélioration de l'overlay et de l'interaction utilisateur
  - Ajout d'animations fluides pour l'ouverture/fermeture
- Implémentation de la sélection des dossiers :
  - Intégration des sélecteurs de dossiers pour mobile et PC
  - Gestion des événements de sélection via l'API Electron
  - Amélioration de l'interface utilisateur des champs de sélection

### Technique
- Refactoring des composants Web :
  - Optimisation des styles CSS avec une meilleure spécificité
  - Amélioration de la gestion des états dans MappingEditor
  - Ajout de logs détaillés pour faciliter le débogage

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
