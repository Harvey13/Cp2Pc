class MappingEditor {
    constructor() {
        this.currentMapping = null;
        this.initialize();
    }

    initialize() {
        console.log('MappingEditor: Initializing...');
        
        // Initialiser les gestionnaires d'événements des boutons
        this.initButtonHandlers();
        
        // Initialiser les autres gestionnaires
        this.initFolderSelectionHandlers();
    }

    initButtonHandlers() {
        // Bouton Sauvegarder
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                try {
                    await this.saveMapping();
                } catch (error) {
                    console.error('Erreur lors de la sauvegarde:', error);
                    // Afficher une notification d'erreur si nécessaire
                }
            });
        }

        // Bouton Annuler
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', async () => {
                try {
                    await this.cancelEditing();
                } catch (error) {
                    console.error('Erreur lors de l\'annulation:', error);
                }
            });
        }
    }

    async saveMapping() {
        try {
            // Récupérer les valeurs des champs
            const titleInput = document.getElementById('mappingTitle');
            const sourcePathInput = document.getElementById('sourcePath');
            const destPathInput = document.getElementById('destPath');

            const mapping = {
                id: this.currentMapping?.id, // Conserver l'ID si c'est une modification
                title: titleInput.value.trim(),
                sourcePath: sourcePathInput.value.trim(),
                destPath: destPathInput.value.trim()
            };

            // Validation
            if (!mapping.title || !mapping.sourcePath || !mapping.destPath) {
                throw new Error('Tous les champs sont obligatoires');
            }

            console.log('Sauvegarde du mapping:', mapping);

            // Sauvegarder via l'API
            if (mapping.id) {
                await window.api.updateMapping(mapping);
            } else {
                await window.api.saveMapping(mapping);
            }

            // Fermer l'éditeur après la sauvegarde
            await window.api.closeEditor();
            
            // Rafraîchir la liste des mappings
            window.dispatchEvent(new CustomEvent('mappings-changed'));
        } catch (error) {
            console.error('Erreur lors de la sauvegarde du mapping:', error);
            alert('Erreur lors de la sauvegarde: ' + error.message);
        }
    }

    async cancelEditing() {
        try {
            console.log('Annulation de l\'édition');
            await window.api.cancelEditing();
            
            // Réinitialiser le formulaire
            const form = document.querySelector('form');
            if (form) {
                form.reset();
            }
            
            // Fermer l'éditeur
            await window.api.closeEditor();
        } catch (error) {
            console.error('Erreur lors de l\'annulation:', error);
        }
    }

    // ... autres méthodes existantes ...

    setMapping(mapping) {
        this.currentMapping = mapping;
        
        // Remplir les champs avec les valeurs du mapping
        if (mapping) {
            const titleInput = document.getElementById('mappingTitle');
            const sourcePathInput = document.getElementById('sourcePath');
            const destPathInput = document.getElementById('destPath');

            if (titleInput) titleInput.value = mapping.title || '';
            if (sourcePathInput) sourcePathInput.value = mapping.sourcePath || '';
            if (destPathInput) destPathInput.value = mapping.destPath || '';
        }
    }
}

// Initialiser l'éditeur
const mappingEditor = new MappingEditor();

// Exporter l'instance pour une utilisation globale
window.mappingEditor = mappingEditor; 