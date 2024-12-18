// État global
let deviceInfo = null;

// Gestionnaire de connexion côté client
class ClientConnectionManager {
    constructor() {
        this.isInitialized = false;
        this.socket = null;
        this.status = {
            isConnected: false,
            deviceInfo: null
        };
        this.eventCleanupFunctions = [];
    }

    static getInstance() {
        if (!window.connectionManager) {
            window.connectionManager = new ClientConnectionManager();
        }
        return window.connectionManager;
    }

    async initialize() {
        try {
            if (this.isInitialized) return;

            console.log('🔌 Initialisation du gestionnaire de connexion');
            
            // Initialiser le socket
            this.initializeSocket();

            if (window.api) {
                // Récupérer le statut initial
                const status = await window.api.getConnectionStatus();
                this.updateStatus(status);

                // Configurer les écouteurs d'événements
                this.setupEventListeners();
            }

            this.isInitialized = true;
            console.log('✅ Gestionnaire de connexion initialisé');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation du gestionnaire de connexion:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Nettoyer les anciens listeners
        this.cleanupEventListeners();

        // Ajouter les nouveaux listeners
        this.eventCleanupFunctions = [
            window.api.onConnectionStatus((status) => {
                console.log('🔌 Statut de connexion mis à jour:', status);
                this.updateStatus(status);
            }),

            window.api.onMobileConnected((data) => {
                console.log('📱 Mobile connecté:', data);
                this.updateStatus({ connected: true, deviceInfo: data });
            }),

            window.api.onMobileDisconnected(() => {
                console.log('📱 Mobile déconnecté');
                this.updateStatus({ connected: false, deviceInfo: null });
            }),

            window.api.onMobileStatus((status) => {
                console.log('📱 Statut mobile mis à jour:', status);
                this.updateStatus(status);
            })
        ];
    }

    cleanupEventListeners() {
        this.eventCleanupFunctions.forEach(cleanup => {
            if (typeof cleanup === 'function') {
                cleanup();
            }
        });
        this.eventCleanupFunctions = [];
    }

    initializeSocket() {
        const serverUrl = 'http://localhost:3000';
        this.socket = io(serverUrl);

        this.socket.on('connect', () => {
            console.log('🔌 Socket connectée');
            this.updateStatus({ connected: true });
        });

        this.socket.on('disconnect', () => {
            console.log('🔌 Socket déconnectée');
            this.updateStatus({ connected: false });
        });

        return this.socket;
    }

    updateStatus(status) {
        console.log('🔄 Mise à jour du statut:', status);
        
        this.status = {
            ...this.status,
            ...status
        };
        
        this.updateUI();
        
        // Émettre un événement personnalisé pour la mise à jour du statut
        window.dispatchEvent(new CustomEvent('connection-status-changed', { 
            detail: this.status 
        }));
        
        // Mettre à jour l'état global si nécessaire
        if (window.AppStateManager) {
            window.AppStateManager.checkInitialState();
        }
    }

    updateUI() {
        const statusLed = document.getElementById('connectionStatus');
        if (statusLed) {
            statusLed.classList.toggle('connected', this.status.connected);
            statusLed.title = this.status.connected ? 
                `Connecté ${this.status.deviceInfo ? `- ${this.status.deviceInfo}` : ''}` : 
                'Déconnecté';
        }
    }

    getStatus() {
        return this.status;
    }

    getSocket() {
        return this.socket;
    }

    destroy() {
        this.cleanupEventListeners();
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.isInitialized = false;
    }
}

// Fonction pour mettre à jour la visibilité des vues
function updateViewsVisibility(mappings) {
    const noMappingView = document.getElementById('noMappingState');
    const withMappingsState = document.getElementById('withMappingsState');
    
    if (mappings && mappings.length > 0) {
        noMappingView.style.display = 'none';
        withMappingsState.style.display = 'block';
    } else {
        noMappingView.style.display = 'block';
        withMappingsState.style.display = 'none';
    }
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const connectionManager = ClientConnectionManager.getInstance();
        await connectionManager.initialize();
        
        // Initialiser les composants s'ils ne sont pas déjà définis
        if (!customElements.get('mapping-editor')) {
            customElements.define('mapping-editor', MappingEditor);
        }
        if (!customElements.get('no-mapping-view')) {
            customElements.define('no-mapping-view', NoMappingView);
        }
        if (!customElements.get('mapping-list')) {
            customElements.define('mapping-list', MappingList);
        }

        // Configurer le bouton de configuration
        const configBtn = document.getElementById('configBtn');
        if (configBtn && window.api) {
            configBtn.addEventListener('click', () => {
                console.log('Opening config window');
                window.api.openConfig();
            });
        }

        const mappingEditor = document.querySelector('mapping-editor');
        const noMappingView = document.querySelector('no-mapping-view');
        const mappingList = document.querySelector('mapping-list');

        // Récupérer la socket depuis le ConnectionManager existant
        if (!window.connectionManager) {
            throw new Error('ConnectionManager non initialisé');
        }
        const socket = window.connectionManager.getSocket();

        // Écouter les événements de copie
        socket.on('copy-progress', (data) => {
            console.log('Progression de la copie:', data);
            // TODO: Mettre à jour l'interface avec la progression
        });

        socket.on('copy-complete', (data) => {
            console.log('Copie terminée:', data);
            // TODO: Mettre à jour l'interface pour indiquer que la copie est terminée
        });

        socket.on('copy-error', (data) => {
            console.error('Erreur lors de la copie:', data.error);
            // TODO: Afficher l'erreur à l'utilisateur
        });

        socket.on('mapping-updated', (data) => {
            console.log('Mapping mis à jour:', data);
            // TODO: Mettre à jour l'interface avec le nouveau chemin de destination
        });

        // Gérer l'ajout du premier mapping
        noMappingView.addEventListener('add-first-mapping', () => {
            console.log('Adding first mapping');
            if (mappingEditor) {
                mappingEditor.setMapping(null);
                mappingEditor.show();
            } else {
                console.error('Mapping editor not found');
            }
        });

        // Gérer l'ajout d'un nouveau mapping
        mappingList.addEventListener('add-mapping', () => {
            console.log('Adding new mapping');
            mappingEditor.setMapping(null);
            mappingEditor.show();
        });

        // Gérer la sauvegarde d'un mapping
        mappingEditor.addEventListener('save', async (event) => {
            console.log('Saving mapping:', event.detail);
            const mapping = event.detail;
            
            try {
                if (mapping.id) {
                    // Mettre à jour un mapping existant
                    await window.api.updateMapping(mapping);
                } else {
                    // Créer un nouveau mapping
                    await window.api.createMapping(mapping);
                }
                
                // Rafraîchir la liste des mappings et mettre à jour la visibilité
                const mappings = await window.api.getMappings();
                updateViewsVisibility(mappings);
                mappingList.loadMappings();
            } catch (error) {
                console.error('Error saving mapping:', error);
                // TODO: Afficher un message d'erreur à l'utilisateur
            }
        });

        // Gérer l'édition d'un mapping existant
        mappingList.addEventListener('edit-mapping', (event) => {
            console.log('Editing mapping:', event.detail);
            mappingEditor.setMapping(event.detail);
            mappingEditor.show();
        });

        // Gérer la suppression d'un mapping
        mappingList.addEventListener('delete-mapping', async (event) => {
            console.log('Deleting mapping:', event.detail);
            const mapping = event.detail;
            
            try {
                if (window.api) {
                    await window.api.deleteMapping(mapping.id);
                    // Rafraîchir la liste des mappings et mettre à jour la visibilité
                    const mappings = await window.api.getMappings();
                    updateViewsVisibility(mappings);
                    mappingList.loadMappings();
                }
            } catch (error) {
                console.error('Error deleting mapping:', error);
                // TODO: Afficher un message d'erreur à l'utilisateur
            }
        });

        // Charger les mappings au démarrage
        const initialMappings = await window.api.getMappings();
        updateViewsVisibility(initialMappings);
        mappingList.loadMappings();

        // Autres initialisations...
        if (window.AppStateManager) {
            await window.AppStateManager.initialize();
        }
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
    }
});

// Utiliser beforeunload au lieu de unload
window.addEventListener('beforeunload', (event) => {
    console.log('🔄 Nettoyage avant fermeture...');
    
    try {
        if (window.connectionManager) {
            window.connectionManager.destroy();
        }
        
        // Permettre la fermeture normale de la fenêtre
        delete event['returnValue'];
    } catch (error) {
        console.error('❌ Erreur lors du nettoyage:', error);
    }
});

// Gestionnaire pour la fermeture propre de l'application
if (window.api) {
    window.api.onAppClosing(async () => {
        console.log('🔄 Fermeture de l\'application...');
        
        try {
            if (window.connectionManager) {
                await window.connectionManager.destroy();
            }
        } catch (error) {
            console.error('❌ Erreur lors de la fermeture:', error);
        }
    });
}

// Exporter le gestionnaire pour une utilisation globale
window.ClientConnectionManager = ClientConnectionManager;
