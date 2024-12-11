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
    SERVER_URL: window.location.origin,
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
        this.socket = io(CONFIG.SERVER_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: Infinity,
            reconnectionDelay: CONFIG.RETRY_DELAY,
            timeout: 5000
        });

        this.socket.on('connect', () => {
            this.updateStatus('connected');
        });

        this.socket.on('disconnect', () => {
            this.updateStatus('disconnected');
        });

        this.socket.on('waiting', () => {
            this.updateStatus('waitingMobile');
        });

        this.socket.on('mobile-status', (data) => {
            if (data.connected) {
                this.updateStatus('connected', data.deviceInfo);
            } else {
                this.updateStatus('disconnected');
            }
        });

        this.socket.on('config-updated', (config) => {
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
            const params = deviceInfo ? { deviceName: deviceInfo.deviceName || 'Unknown Device' } : {};
            const translatedText = window.i18nManager.translate(status, params);
            console.log('Updating status:', status, 'with params:', params, '-> text:', translatedText);
            this.statusElement.textContent = translatedText;
            this.statusElement.dataset.i18n = status;
        }
    }

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
        if (mapping && mapping.source && mapping.destination) {
            Logger.log('🔄 Démarrage synchronisation:', mapping);
            // TODO: Implémenter la logique de synchronisation
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
