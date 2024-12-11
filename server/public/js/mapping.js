class MappingUI {
    constructor() {
        console.log('Initializing MappingUI');
        this.mapping = {
            id: Date.now(),
            title: 'Nouveau mapping',
            sourcePath: '',
            destPath: ''
        };
        this.initUI();
    }

    initUI() {
        console.log('Setting up UI elements');
        
        // Initialiser les champs
        const titleInput = document.getElementById('mappingTitle');
        if (!titleInput) {
            console.error('Title input not found');
            return;
        }
        titleInput.value = this.mapping.title;
        titleInput.addEventListener('input', (e) => {
            this.mapping.title = e.target.value;
        });

        // Boutons de parcours
        const browseSourceBtn = document.getElementById('browseSourceBtn');
        if (!browseSourceBtn) {
            console.error('Browse source button not found');
            return;
        }
        browseSourceBtn.addEventListener('click', async () => {
            console.log('Clicking browse source button');
            if (window.api) {
                try {
                    await window.api.selectMobileFolder();
                } catch (error) {
                    console.error('Error selecting mobile folder:', error);
                }
            }
        });

        const browseDestBtn = document.getElementById('browseDestBtn');
        if (!browseDestBtn) {
            console.error('Browse dest button not found');
            return;
        }
        browseDestBtn.addEventListener('click', async () => {
            console.log('Clicking browse dest button');
            if (window.api) {
                try {
                    await window.api.selectPCFolder();
                } catch (error) {
                    console.error('Error selecting PC folder:', error);
                }
            }
        });

        // Boutons d'action
        const saveBtn = document.getElementById('saveBtn');
        if (!saveBtn) {
            console.error('Save button not found');
            return;
        }
        saveBtn.addEventListener('click', () => this.saveMapping());

        const cancelBtn = document.getElementById('cancelBtn');
        if (!cancelBtn) {
            console.error('Cancel button not found');
            return;
        }
        cancelBtn.addEventListener('click', () => {
            if (window.api) {
                window.api.closeWindow();
            }
        });

        // Écouter les événements de sélection de dossier
        this.handleMobileFolderSelected = this.handleMobileFolderSelected.bind(this);
        this.handlePCFolderSelected = this.handlePCFolderSelected.bind(this);

        window.addEventListener('mobile-folder-selected', this.handleMobileFolderSelected);
        window.addEventListener('pc-folder-selected', this.handlePCFolderSelected);
    }

    handleMobileFolderSelected(event) {
        console.log('Mobile folder selected:', event.detail);
        if (event.detail) {
            this.mapping.sourcePath = event.detail;
            const input = document.getElementById('sourcePath');
            if (input) {
                input.value = event.detail;
            } else {
                console.error('Source path input not found');
            }
        }
    }

    handlePCFolderSelected(event) {
        console.log('PC folder selected:', event.detail);
        if (event.detail) {
            this.mapping.destPath = event.detail;
            const input = document.getElementById('destPath');
            if (input) {
                input.value = event.detail;
            } else {
                console.error('Dest path input not found');
            }
        }
    }

    async saveMapping() {
        console.log('Saving mapping:', this.mapping);
        
        if (!this.mapping.sourcePath || !this.mapping.destPath) {
            alert('Veuillez sélectionner les dossiers source et destination');
            return;
        }

        if (window.api) {
            try {
                const success = await window.api.saveMapping(this.mapping);
                if (success) {
                    window.api.closeWindow();
                }
            } catch (error) {
                console.error('Error saving mapping:', error);
            }
        }
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, creating MappingUI');
    window.mappingUI = new MappingUI();
});
