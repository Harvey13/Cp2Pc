// Utilitaires de débogage
function debugLog(...args) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}]`, ...args);
}

// Variables globales
let socket = null;
let mappings = [];

// Configuration
const CONFIG = {
    SERVER_URL: 'http://localhost:3000',
    RETRY_DELAY: 2000,
    LOG_ENABLED: true,
    IS_ELECTRON: window.electron !== undefined
};

// États de connexion
const ConnectionState = {
    DISCONNECTED: 'disconnected',
    WAITING: 'waiting',
    CONNECTED: 'connected'
};

// Gestionnaire de logs
const Logger = {
    log: function(message, data = null) {
        if (!CONFIG.LOG_ENABLED) return;
        const timestamp = new Date().toLocaleTimeString();
        const formattedMessage = data ? `${message} ${JSON.stringify(data)}` : message;
        console.log(`[${timestamp}] ${formattedMessage}`);
    }
};

// Gestionnaire de Socket.IO
class ConnectionManager {
    constructor() {
        this.socket = null;
        this.statusElement = document.getElementById('statusText');
        this.statusLed = document.getElementById('connectionStatus');
        this.initSocket();
    }

    initSocket() {
        Logger.log('🔌 Initialisation de la socket avec le serveur:', CONFIG.SERVER_URL);
        
        this.socket = io(CONFIG.SERVER_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: Infinity,
            reconnectionDelay: CONFIG.RETRY_DELAY,
            timeout: 5000,
            path: '/socket.io/',
            forceNew: true,
            withCredentials: false,
            autoConnect: true
        });

        this.socket.on('connect', () => {
            Logger.log('✅ Socket connectée');
            this.updateStatus('connected');
            // Stocker la socket globalement pour un accès facile
            socket = this.socket;
        });

        this.socket.on('connect_error', (error) => {
            Logger.log('❌ Erreur de connexion socket:', error.message);
            this.updateStatus('disconnected');
        });

        this.socket.on('disconnect', () => {
            Logger.log('🔌 Socket déconnectée');
            this.updateStatus('disconnected');
        });

        this.socket.on('waiting', () => {
            Logger.log('⏳ En attente d\'un mobile');
            this.updateStatus('waitingMobile');
        });

        this.socket.on('mobile-status', (data) => {
            Logger.log('📱 Statut mobile mis à jour:', data);
            if (data.connected) {
                this.updateStatus('connected', data.deviceInfo);
            } else {
                this.updateStatus('disconnected');
            }
        });

        this.socket.on('config-updated', (config) => {
            Logger.log('⚙️ Configuration mise à jour:', config);
            if (config.language && window.i18nManager) {
                window.i18nManager.setLanguage(config.language);
            }
        });
    }

    updateStatus(status, deviceInfo = null) {
        // Mettre à jour la LED
        this.statusLed.className = 'status-led ' + status;

        // Mettre à jour le texte avec la traduction
        if (window.i18nManager) {
            const key = `status.${status}`;
            this.statusElement.textContent = window.i18nManager.translate(key);
        }
    }

    // Méthode pour récupérer la socket
    getSocket() {
        return this.socket;
    }
}

// Gestionnaire de configuration
class ConfigManager {
    constructor() {
        this.configBtn = document.getElementById('configBtn');
        this.initConfigButton();
    }

    initConfigButton() {
        this.configBtn.addEventListener('click', () => {
            if (window.electron) {
                window.electron.openConfig();
            }
        });
    }
}

// Gestionnaire de mappings
class MappingManager {
    constructor() {
        this.mappings = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        const addButton = document.getElementById('addMappingBtn');
        if (addButton) {
            addButton.addEventListener('click', () => this.createMapping());
        }
    }

    createMapping(title = 'Nouveau Mapping') {
        const mapping = {
            id: Date.now(),
            title: title,
            source: '',
            destination: '',
            progress: 0
        };
        
        this.mappings.push(mapping);
        this.renderMapping(mapping);
        Logger.log('✨ Nouveau mapping créé:', mapping);
        return mapping;
    }

    renderMapping(mapping) {
        const mappingsList = document.getElementById('mappingsList');
        if (!mappingsList) return;

        const mappingElement = document.createElement('div');
        mappingElement.className = 'mapping-item';
        mappingElement.id = `mapping-${mapping.id}`;
        
        mappingElement.innerHTML = `
            <div class="mapping-header">
                <input type="text" class="mapping-title" value="${mapping.title}" 
                       onchange="mappingManager.updateTitle(${mapping.id}, this.value)"
                       readonly>
                <div class="mapping-actions">
                    <button class="delete-btn" onclick="mappingManager.deleteMapping(${mapping.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="mapping-content">
                <div class="folder-section">
                    <span class="folder-label">Source:</span>
                    <span class="folder-path">${mapping.source || 'Aucun dossier sélectionné'}</span>
                    <button class="browse-btn" onclick="mappingManager.browseFolder(${mapping.id}, 'source')">
                        <i class="fas fa-folder-open"></i> Parcourir
                    </button>
                </div>
                <div class="folder-section">
                    <span class="folder-label">Dest:</span>
                    <span class="folder-path">${mapping.destination || 'Aucun dossier sélectionné'}</span>
                    <button class="browse-btn" onclick="mappingManager.browseFolder(${mapping.id}, 'destination')">
                        <i class="fas fa-folder-open"></i> Parcourir
                    </button>
                </div>
            </div>
            <div class="mapping-footer">
                <button class="start-btn" onclick="mappingManager.startSync(${mapping.id})" ${!mapping.source || !mapping.destination ? 'disabled' : ''}>
                    <i class="fas fa-sync"></i> Synchroniser
                </button>
            </div>
        `;
        
        mappingsList.appendChild(mappingElement);
    }

    updateTitle(id, newTitle) {
        const mapping = this.mappings.find(m => m.id === id);
        if (mapping) {
            mapping.title = newTitle;
            Logger.log('✏️ Titre mapping mis à jour:', { id, newTitle });
        }
    }

    async browseFolder(id, type) {
        const mapping = this.mappings.find(m => m.id === id);
        if (!mapping) return;

        try {
            // Simulation de la sélection de dossier (à remplacer par l'API Electron)
            const path = prompt(`Sélectionnez un dossier ${type}:`);
            if (path) {
                mapping[type] = path;
                const element = document.querySelector(`#mapping-${id} .folder-section:${type === 'source' ? 'first' : 'last'}-of-type .folder-path`);
                if (element) {
                    element.textContent = path;
                }
                Logger.log('📂 Dossier sélectionné:', { id, type, path });
                
                // Mettre à jour le bouton de synchronisation
                const startBtn = document.querySelector(`#mapping-${id} .start-btn`);
                if (startBtn) {
                    startBtn.disabled = !(mapping.source && mapping.destination);
                }
            }
        } catch (error) {
            Logger.log('❌ Erreur sélection dossier:', error.message);
        }
    }

    deleteMapping(id) {
        const index = this.mappings.findIndex(m => m.id === id);
        if (index !== -1) {
            this.mappings.splice(index, 1);
            const element = document.getElementById(`mapping-${id}`);
            if (element) {
                element.remove();
            }
            Logger.log('🗑️ Mapping supprimé:', { id });
        }
    }

    startSync(id) {
        const mapping = this.mappings.find(m => m.id === id);
        if (!mapping || !mapping.source || !mapping.destination) {
            Logger.log('❌ Mapping invalide ou chemins manquants', { mapping });
            return;
        }

        Logger.log('🔄 Préparation de la synchronisation', { mapping });
        
        // Récupérer la socket depuis le ConnectionManager
        const socket = window.connectionManager?.getSocket();
        if (!socket) {
            Logger.log('❌ Socket non initialisée - Vérifiez la connexion au serveur');
            return;
        }

        // Vérifier l'état de la connexion
        if (!socket.connected) {
            Logger.log('❌ Socket déconnectée - Tentative de reconnexion...');
            socket.connect();
            
            // Attendre la connexion avant d'envoyer l'événement
            socket.once('connect', () => {
                Logger.log('✅ Socket reconnectée, envoi de la demande de copie...');
                this._emitStartCopy(socket, mapping);
            });
            return;
        }

        this._emitStartCopy(socket, mapping);
    }

    _emitStartCopy(socket, mapping) {
        // Préparer la configuration
        const config = {
            maxFiles: 100,
            mappings: [{
                id: mapping.id,
                title: mapping.title,
                sourcePath: mapping.source,
                destPath: mapping.destination
            }]
        };

        Logger.log('📤 Émission de l\'événement start-copy...', { config });

        // Émettre l'événement avec une promesse pour s'assurer qu'il est reçu
        socket.emit('start-copy', config, (response) => {
            if (response && response.error) {
                Logger.log('❌ Erreur lors de l\'émission:', response.error);
            } else if (response && response.success) {
                Logger.log('✅ Événement start-copy confirmé par le serveur');
            } else {
                Logger.log('⚠️ Réponse inattendue du serveur:', response);
            }
        });

        // Écouter les événements de progression
        socket.on('copy-progress', (data) => {
            if (data.mappingId === mapping.id) {
                Logger.log('📊 Progression de la copie', data);
                this.updateProgress(mapping.id, data);
            }
        });

        // Écouter les événements d'erreur
        socket.on('copy-error', (data) => {
            if (!data.mappingId || data.mappingId === mapping.id) {
                Logger.log('❌ Erreur lors de la copie:', data.error);
                this.showError(mapping.id, data.error);
            }
        });

        // Écouter les événements de fin
        socket.on('copy-complete', (data) => {
            if (data.mappingId === mapping.id) {
                Logger.log('✅ Copie terminée', data);
                this.showSuccess(mapping.id, data);
            }
        });
    }

    updateProgress(id, data) {
        const progressBar = document.querySelector(`#mapping-${id} .progress-bar`);
        if (progressBar) {
            progressBar.style.width = `${data.progress}%`;
            progressBar.setAttribute('aria-valuenow', data.progress);
        }
    }

    showError(id, error) {
        const element = document.querySelector(`#mapping-${id}`);
        if (element) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-danger mt-2';
            alertDiv.textContent = `Erreur: ${error}`;
            element.appendChild(alertDiv);
            setTimeout(() => alertDiv.remove(), 5000);
        }
    }

    showSuccess(id, data) {
        const element = document.querySelector(`#mapping-${id}`);
        if (element) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-success mt-2';
            alertDiv.textContent = `Copie terminée! ${data.totalFiles} fichiers copiés vers ${data.destination}`;
            element.appendChild(alertDiv);
            setTimeout(() => alertDiv.remove(), 5000);
        }
    }
}

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        Logger.log('🚀 Application initialisée');
        
        // Vérification de l'API Electron
        if (CONFIG.IS_ELECTRON) {
            Logger.log('✅ API Electron disponible');
        } else {
            Logger.log('ℹ️ Mode navigateur (API Electron non disponible)');
        }
        
        // Initialiser les gestionnaires
        window.connectionManager = new ConnectionManager();
        window.configManager = new ConfigManager();
        window.mappingManager = new MappingManager();

        // Initialiser la langue si disponible via Electron
        if (window.electron) {
            const currentLang = await window.electron.getCurrentLanguage();
            if (currentLang) {
                window.i18nManager.setLanguage(currentLang);
            }
        }

        // Écouter les changements de langue
        if (window.electron) {
            window.electron.onLanguageChange((lang) => {
                window.i18nManager.setLanguage(lang);
                // Mettre à jour le statut pour rafraîchir la traduction
                const currentStatus = window.connectionManager.statusLed.className.split(' ')[1];
                window.connectionManager.updateStatus(currentStatus);
            });
        }

    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
    }
});
