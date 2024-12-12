// Liste des mappings avec barre de progression
class MappingList extends HTMLElement {
    constructor() {
        super();
        this.mappings = [];
        this.render();
    }

    // Charger les mappings depuis l'API
    async loadMappings() {
        console.log('Loading mappings from API');
        try {
            if (window.api) {
                const mappings = await window.api.getMappings();
                this.updateMappings(mappings || []);
            }
        } catch (error) {
            console.error('Error loading mappings:', error);
        }
    }

    // Mettre à jour les mappings
    updateMappings(mappings) {
        console.log('Updating mappings:', mappings);
        this.mappings = mappings;
        this.render();
    }

    render() {
        // Header avec bouton de copie globale
        const header = `
            <div class="mappings-header">
                <button class="start-copy-btn" title="Lancer la copie">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16">
                        <path fill="currentColor" d="M371.7 238l-176-107c-15.8-8.8-35.7 2.5-35.7 21v208c0 18.4 19.8 29.8 35.7 21l176-101c16.4-9.1 16.4-32.8 0-42zM504 256C504 119 393 8 256 8S8 119 8 256s111 248 248 248 248-111 248-248zm-448 0c0-110.5 89.5-200 200-200s200 89.5 200 200-89.5 200-200 200S56 366.5 56 256z"/>
                    </svg>
                    <span>Lancer la copie</span>
                </button>
                <button class="icon-button add-mapping-btn" title="Ajouter un mapping">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                        <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                </button>
            </div>
        `;

        // Liste des mappings
        const mappingsList = this.mappings.map(mapping => this.createMappingElement(mapping)).join('');

        this.innerHTML = `
            <div class="mappings-container">
                ${header}
                <div class="mappings-list">
                    ${mappingsList}
                </div>
            </div>
        `;

        // Ajouter les écouteurs d'événements
        this.addEventListeners();
    }

    createMappingElement(mapping) {
        return `
            <div class="mapping-item" data-id="${mapping.id}">
                <div class="mapping-header">
                    <h3>${mapping.title}</h3>
                    <div class="mapping-actions">
                        <button class="icon-button edit-btn" title="Éditer" data-action="edit">
                            <svg viewBox="0 0 24 24" width="16" height="16">
                                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                        </button>
                        <button class="icon-button delete-btn" title="Supprimer" data-action="delete">
                            <svg viewBox="0 0 24 24" width="16" height="16">
                                <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="mapping-paths">
                    <div class="path-item">
                        <span class="path-label">Source:</span>
                        <span class="path-value">${mapping.sourcePath || 'Non défini'}</span>
                    </div>
                    <div class="path-item">
                        <span class="path-label">Destination:</span>
                        <span class="path-value">${mapping.destPath || 'Non défini'}</span>
                    </div>
                </div>
                <div class="mapping-progress-container">
                    <div class="mapping-progress" style="width: ${mapping.progress || 0}%"></div>
                </div>
            </div>
        `;
    }

    addEventListeners() {
        // Bouton de copie globale
        this.querySelector('.start-copy-btn').addEventListener('click', () => {
            if (window.api) {
                window.api.startCopy();
            }
        });

        // Bouton d'ajout de mapping
        this.querySelector('.add-mapping-btn').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('add-mapping'));
        });

        // Ajouter les écouteurs pour chaque mapping
        this.querySelector('.mappings-list').addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (target) {
                const action = target.dataset.action;
                const mappingElement = target.closest('.mapping-item');
                if (!mappingElement) return;
                
                const id = parseInt(mappingElement.dataset.id);
                const mapping = this.mappings.find(m => m.id === id);
                if (!mapping) return;

                if (action === 'edit') {
                    this.dispatchEvent(new CustomEvent('edit-mapping', { detail: mapping }));
                } else if (action === 'delete') {
                    this.dispatchEvent(new CustomEvent('delete-mapping', { detail: mapping }));
                }
            }
        });
    }
}

// Enregistrer le composant
customElements.define('mapping-list', MappingList);
