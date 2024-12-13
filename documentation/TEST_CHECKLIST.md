# Checklist des Tests d'Interface Cp2Pc

## Interface Principale

### Bouton "Lancer la copie"
- [ ] Le bouton est visible et actif
- [ ] Un message d'erreur apparaît si aucun appareil n'est connecté
- [ ] Un message d'erreur apparaît si aucun mapping n'est configuré
- [ ] Le processus de copie démarre si toutes les conditions sont remplies
- [ ] Le message d'erreur est simple et lisible
- [ ] Le message d'erreur peut être fermé avec le bouton ×

### Bouton "Ajouter un mapping" (+)
- [ ] Le bouton est visible
- [ ] Cliquer ouvre la fenêtre d'édition de mapping
- [ ] La fenêtre s'ouvre avec des champs vides
- [ ] Le titre de la fenêtre indique "Nouveau mapping"

## Liste des Mappings

### Pour chaque mapping existant
- [ ] Le titre est affiché correctement
- [ ] Le chemin source est affiché
- [ ] Le chemin destination est affiché
- [ ] Le bouton d'édition (crayon) est visible
- [ ] Le bouton de suppression (poubelle) est visible

### Bouton Édition (crayon)
- [ ] Ouvre la fenêtre d'édition
- [ ] Les champs sont pré-remplis avec les données existantes
- [ ] Le titre de la fenêtre indique "Modifier le mapping"

### Bouton Suppression (poubelle)
- [ ] Une confirmation est demandée avant la suppression
- [ ] Le mapping est effectivement supprimé après confirmation
- [ ] La liste est mise à jour après la suppression

## Fenêtre d'Édition de Mapping

### Champs de saisie
- [ ] Le champ titre accepte la saisie
- [ ] Le champ source accepte la saisie
- [ ] Le champ destination accepte la saisie
- [ ] Les champs obligatoires sont indiqués

### Boutons de navigation
- [ ] Le bouton "Parcourir" pour la source fonctionne
- [ ] Le bouton "Parcourir" pour la destination fonctionne
- [ ] Les chemins sélectionnés sont correctement affichés

### Boutons d'action
- [ ] Le bouton "Enregistrer" est actif
- [ ] Le bouton "Annuler" ferme la fenêtre
- [ ] L'enregistrement fonctionne avec tous les champs remplis
- [ ] Un message d'erreur apparaît si des champs requis sont vides

## Messages d'Erreur (pour toutes les actions)
- [ ] Les messages sont clairs et concis
- [ ] Seul le texte pertinent est affiché
- [ ] Le bouton de fermeture × fonctionne
- [ ] Les messages disparaissent après un certain temps ou une action

## Tests de Compatibilité
- [ ] L'interface fonctionne en mode fenêtré
- [ ] L'interface fonctionne en plein écran
- [ ] Les éléments sont correctement positionnés dans tous les modes
- [ ] L'interface reste réactive même avec plusieurs mappings

## Tests de Performance
- [ ] L'interface reste réactive lors de l'ajout de nombreux mappings
- [ ] Les actions (édition, suppression) restent rapides
- [ ] Le chargement initial de l'application est rapide
- [ ] Les fenêtres modales s'ouvrent sans délai

---
Note: Cocher chaque case après avoir vérifié que le test passe. Si un test échoue, noter le problème et les circonstances dans lesquelles il se produit.
