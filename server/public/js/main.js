// État global
let deviceInfo = null;

// Fonction de mise à jour du statut de connexion
function updateConnectionStatus(status) {
    const statusLed = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');
    const deviceNameElement = document.getElementById('deviceName');

    // Réinitialiser toutes les classes d'état
    statusLed.classList.remove('connected', 'disconnected', 'waiting');

    if (status.connected) {
        statusLed.classList.add('connected');
        statusText.textContent = 'Mobile connecté';
        if (status.deviceInfo) {
            deviceNameElement.textContent = status.deviceInfo.deviceName || 'Appareil inconnu';
        }
    } else {
        statusLed.classList.add('disconnected');
        statusText.textContent = 'Non connecté';
        deviceNameElement.textContent = 'En attente d\'un mobile';
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

document.addEventListener('DOMContentLoaded', async () => {
    try {
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

        // Vérifier l'état initial de la connexion
        if (window.api) {
            try {
                const status = await window.api.checkConnectionStatus();
                updateConnectionStatus(status);
                
                // Charger les mappings initiaux et mettre à jour la visibilité
                const mappings = await window.api.getMappings();
                updateViewsVisibility(mappings);
            } catch (error) {
                console.error('Erreur lors de la vérification du statut:', error);
            }
        }

        // Écouter les événements de connexion
        if (window.api) {
            window.api.onMobileConnected((data) => {
                console.log('Mobile connecté:', data);
                updateConnectionStatus({ connected: true, deviceInfo: data });
            });

            window.api.onMobileDisconnected(() => {
                console.log('Mobile déconnecté');
                updateConnectionStatus({ connected: false });
            });

            window.api.onMobileStatus((status) => {
                console.log('Statut mobile mis à jour:', status);
                updateConnectionStatus(status);
            });
        }

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

    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
    }
});
