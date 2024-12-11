// Éditeur de mapping
class MappingEditor extends HTMLElement {
    constructor() {
        super();
        this.mapping = null;
        this.render();
        
        // Lier les méthodes au contexte
        this.handleMobileFolderSelected = this.handleMobileFolderSelected.bind(this);
        this.handlePCFolderSelected = this.handlePCFolderSelected.bind(this);
        
        this.initFolderSelectionHandlers();
        this.addEventListeners();
    }

    // Gestionnaires d'événements pour la sélection des dossiers
    handleMobileFolderSelected(event) {
        console.log('Mobile folder selected:', event.detail);
        if (event.detail) {
            const input = this.querySelector('#sourcePath');
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
            const input = this.querySelector('#destPath');
            if (input) {
                input.value = event.detail;
            } else {
                console.error('Dest path input not found');
            }
        }
    }

    // Définir le mapping à éditer
    setMapping(mapping) {
        this.mapping = mapping;
        this.render();
    }

    render() {
        this.innerHTML = `
            <div class="mapping-editor">
                <div class="editor-header">
                    <h2>${this.mapping ? 'Éditer le mapping' : 'Nouveau mapping'}</h2>
                    <button class="icon-button close-btn" title="Fermer">
                        <svg viewBox="0 0 24 24" width="24" height="24">
                            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
                <div class="editor-content">
                    <div class="form-group">
                        <label for="mappingTitle">Titre</label>
                        <input type="text" id="mappingTitle" value="${this.mapping ? this.mapping.title : ''}" placeholder="Entrez un titre">
                    </div>
                    <div class="form-group">
                        <label>Source (Mobile)</label>
                        <div class="path-input">
                            <input type="text" id="sourcePath" value="${this.mapping ? this.mapping.sourcePath : ''}" readonly placeholder="Sélectionnez un dossier source">
                            <button class="browse-btn" id="browseSourceBtn">
                                <svg viewBox="0 0 24 24" width="16" height="16">
                                    <path fill="currentColor" d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Destination (PC)</label>
                        <div class="path-input">
                            <input type="text" id="destPath" value="${this.mapping ? this.mapping.destPath : ''}" readonly placeholder="Sélectionnez un dossier destination">
                            <button class="browse-btn" id="browseDestBtn">
                                <svg viewBox="0 0 24 24" width="16" height="16">
                                    <path fill="currentColor" d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="editor-footer">
                    <button class="cancel-btn">Annuler</button>
                    <button class="save-btn">Enregistrer</button>
                </div>
            </div>
        `;
    }

    initFolderSelectionHandlers() {
        // Supprimer les anciens écouteurs s'ils existent
        window.removeEventListener('mobile-folder-selected', this.handleMobileFolderSelected);
        window.removeEventListener('pc-folder-selected', this.handlePCFolderSelected);

        // Ajouter les nouveaux écouteurs
        window.addEventListener('mobile-folder-selected', this.handleMobileFolderSelected);
        window.addEventListener('pc-folder-selected', this.handlePCFolderSelected);
    }

    addEventListeners() {
        // Bouton de fermeture
        this.querySelector('.close-btn').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('close'));
        });

        // Bouton d'annulation
        this.querySelector('.cancel-btn').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('close'));
        });

        // Bouton de sauvegarde
        this.querySelector('.save-btn').addEventListener('click', () => {
            const mappingData = {
                title: this.querySelector('#mappingTitle').value,
                sourcePath: this.querySelector('#sourcePath').value,
                destPath: this.querySelector('#destPath').value
            };

            if (this.mapping) {
                mappingData.id = this.mapping.id;
            }

            this.dispatchEvent(new CustomEvent('save', {
                detail: mappingData
            }));
        });

        // Boutons de sélection de dossier
        this.querySelector('#browseSourceBtn').addEventListener('click', async () => {
            console.log('Clicking browse source button');
            if (window.api) {
                try {
                    await window.api.selectMobileFolder();
                } catch (error) {
                    console.error('Error selecting mobile folder:', error);
                }
            }
        });

        this.querySelector('#browseDestBtn').addEventListener('click', async () => {
            console.log('Clicking browse dest button');
            if (window.api) {
                try {
                    await window.api.selectPCFolder();
                } catch (error) {
                    console.error('Error selecting PC folder:', error);
                }
            }
        });
    }

    // Nettoyer les écouteurs quand le composant est détruit
    disconnectedCallback() {
        window.removeEventListener('mobile-folder-selected', this.handleMobileFolderSelected);
        window.removeEventListener('pc-folder-selected', this.handlePCFolderSelected);
    }
}

// Enregistrer le composant
customElements.define('mapping-editor', MappingEditor);
