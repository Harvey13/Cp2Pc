// État de l'application
let appState = {
    connected: false,
    deviceInfo: null,
    mappings: [],  // Liste des mappings
    nextMappingId: 1
};

// Éléments DOM
const connectionStatus = document.getElementById('connectionStatus');
const statusText = document.getElementById('statusText');
const configBtn = document.getElementById('configBtn');
const noMappingState = document.getElementById('noMappingState');
const withMappingsState = document.getElementById('withMappingsState');
const mappingEditor = document.getElementById('mappingEditor');

// Mettre à jour l'interface utilisateur
function updateUI() {
    console.log('Updating UI with state:', appState);
    // Mise à jour du statut de connexion
    if (appState.connected) {
        connectionStatus.className = 'status-led connected';
        const deviceName = appState.deviceInfo?.deviceName || 'Unknown Device';
        statusText.textContent = window.i18nManager.translate('connected', { deviceName });
    } else {
        connectionStatus.className = 'status-led waiting';
        statusText.textContent = window.i18nManager.translate('waitingMobile');
    }

    // Afficher l'état approprié selon les mappings
    if (appState.mappings.length === 0) {
        noMappingState.style.display = 'block';
        withMappingsState.style.display = 'none';
    } else {
        noMappingState.style.display = 'none';
        withMappingsState.style.display = 'block';
        withMappingsState.updateMappings(appState.mappings);
    }
}

// Créer un nouveau mapping
function createMapping() {
    const mapping = {
        id: appState.nextMappingId++,
        title: 'Nouveau mapping',
        sourcePath: '',
        destPath: '',
        progress: 0
    };
    appState.mappings.push(mapping);
    updateUI();
    return mapping;
}

// Supprimer un mapping
function deleteMapping(id) {
    const index = appState.mappings.findIndex(m => m.id === parseInt(id));
    if (index !== -1) {
        appState.mappings.splice(index, 1);
        updateUI();
    }
}

// Mettre à jour un mapping
function updateMapping(mappingData) {
    const index = appState.mappings.findIndex(m => m.id === mappingData.id);
    if (index !== -1) {
        appState.mappings[index] = { ...appState.mappings[index], ...mappingData };
    } else {
        appState.mappings.push({ ...mappingData, id: appState.nextMappingId++, progress: 0 });
    }
    updateUI();
}

// Mettre à jour la progression d'un mapping
function updateMappingProgress(id, progress) {
    const mapping = appState.mappings.find(m => m.id === id);
    if (mapping) {
        mapping.progress = progress;
        withMappingsState.updateMappings(appState.mappings);
    }
}

// Gérer l'ouverture de l'éditeur de mapping
function openMappingEditor(mapping = null) {
    mappingEditor.style.display = 'block';
    mappingEditor.setMapping(mapping);
}

// Initialisation des événements
document.addEventListener('DOMContentLoaded', () => {
    // Événements de l'éditeur de mapping
    mappingEditor.addEventListener('save', (e) => {
        updateMapping(e.detail);
        mappingEditor.style.display = 'none';
    });

    mappingEditor.addEventListener('close', () => {
        mappingEditor.style.display = 'none';
    });

    // Événement du bouton de configuration
    configBtn.addEventListener('click', () => {
        if (window.api) {
            window.api.openConfig();
        }
    });

    // Cacher l'éditeur par défaut
    mappingEditor.style.display = 'none';

    // Charger les mappings existants
    if (window.api) {
        window.api.getMappings().then(mappings => {
            appState.mappings = mappings;
            appState.nextMappingId = Math.max(...mappings.map(m => m.id), 0) + 1;
            updateUI();
        });
    }
});

// Initialisation des événements Socket.IO
const socket = io('http://localhost:3000', {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

socket.on('connect', () => {
    console.log('Connected to server');
    // Informer le serveur que c'est une connexion web
    socket.emit('web-connect');
});

socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error);
});

socket.on('mobile-status', (data) => {
    console.log('Mobile status update:', data);
    appState.connected = data.connected;
    appState.deviceInfo = data.deviceInfo;
    updateUI();
});

// Gestion des événements IPC avec Electron
if (window.api) {
    // Événements de connexion
    window.api.onMobileConnected(({ ip }) => {
        console.log('Mobile connected via Electron:', ip);
    });

    window.api.onMobileDisconnected(() => {
        console.log('Mobile disconnected via Electron');
    });

    // Événements de mapping
    window.api.onMappingAdded(() => {
        const newMapping = createMapping();
        openMappingEditor(newMapping);
    });

    window.api.onMappingUpdate((mapping) => {
        updateMapping(mapping);
    });

    window.api.onMappingDelete((id) => {
        deleteMapping(id);
    });

    window.api.onMappingProgress((data) => {
        updateMappingProgress(data.id, data.progress);
    });
}
