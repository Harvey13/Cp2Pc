class MappingUI {
    constructor() {
        this.mapping = {
            id: Date.now(),
            title: 'Nouveau mapping',
            sourcePath: '',
            destPath: ''
        };
        this.initUI();
    }

    initUI() {
        // Initialiser les champs
        const titleInput = document.getElementById('mappingTitle');
        titleInput.value = this.mapping.title;
        titleInput.addEventListener('input', (e) => {
            this.mapping.title = e.target.value;
        });

        // Boutons de parcours
        document.getElementById('browseSourceBtn').addEventListener('click', () => {
            if (window.electron) {
                window.electron.selectMobileFolder(this.mapping.id);
            }
        });

        document.getElementById('browseDestBtn').addEventListener('click', async () => {
            if (window.electron) {
                const path = await window.electron.selectDirectory();
                if (path) {
                    this.mapping.destPath = path;
                    document.getElementById('destPath').value = path;
                }
            }
        });

        // Boutons d'action
        document.getElementById('saveBtn').addEventListener('click', () => this.saveMapping());
        document.getElementById('cancelBtn').addEventListener('click', () => {
            if (window.electron) {
                window.electron.closeWindow();
            }
        });

        // Écouter les événements de sélection de dossier mobile
        if (window.electron) {
            window.electron.onFolderSelected((event, { id, type, path }) => {
                if (id === this.mapping.id && type === 'source') {
                    this.mapping.sourcePath = path;
                    document.getElementById('sourcePath').value = path;
                }
            });
        }
    }

    async saveMapping() {
        if (!this.mapping.sourcePath || !this.mapping.destPath) {
            alert('Veuillez sélectionner les dossiers source et destination');
            return;
        }

        if (window.electron) {
            const success = await window.electron.saveMapping(this.mapping);
            if (success) {
                window.electron.closeWindow();
            }
        }
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    window.mappingUI = new MappingUI();
});
