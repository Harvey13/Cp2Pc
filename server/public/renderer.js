const { ipcRenderer } = require('electron');
const { io } = require('socket.io-client');

// Création de la connexion Socket.IO
const socket = io('http://localhost:3000', {
    transports: ['websocket', 'polling']
});

// État de l'application
let mappings = [];
let pcStatus = false;
let mobileStatus = false;

// Éléments DOM
const pcStatusIndicator = document.getElementById('pc-status');
const mobileStatusIndicator = document.getElementById('mobile-status');
const addMappingButton = document.getElementById('add-mapping');
const showLogsButton = document.getElementById('show-logs');
const showSettingsButton = document.getElementById('show-settings');
const startCopyButton = document.getElementById('start-copy');
const maxFilesInput = document.getElementById('max-files');
const mappingsContainer = document.getElementById('mappings-container');
const logsModal = document.getElementById('logs-modal');
const settingsModal = document.getElementById('settings-modal');
const closeModalButton = document.querySelector('.close-modal');
const closeSettingsModalButton = document.querySelector('.close-settings-modal');
const saveSettingsButton = document.getElementById('save-settings');
const logsContainer = document.getElementById('logs-container');

// Template pour les mappings
const mappingTemplate = document.getElementById('mapping-template');

// Configuration
let config = {
    maxFiles: 100
};

// Charger la configuration
function loadConfig() {
    const savedConfig = localStorage.getItem('config');
    if (savedConfig) {
        config = JSON.parse(savedConfig);
        maxFilesInput.value = config.maxFiles;
    }
}

// Sauvegarder la configuration
function saveConfig() {
    config.maxFiles = parseInt(maxFilesInput.value, 10);
    localStorage.setItem('config', JSON.stringify(config));
    settingsModal.classList.remove('show');
}

// Gestionnaires d'événements
addMappingButton.addEventListener('click', () => {
    addNewMapping();
});

showLogsButton.addEventListener('click', () => {
    logsModal.classList.add('show');
    socket.emit('get-logs');
});

showSettingsButton.addEventListener('click', () => {
    settingsModal.classList.add('show');
});

startCopyButton.addEventListener('click', () => {
    startCopy();
});

closeModalButton.addEventListener('click', () => {
    logsModal.classList.remove('show');
});

closeSettingsModalButton.addEventListener('click', () => {
    settingsModal.classList.remove('show');
});

saveSettingsButton.addEventListener('click', () => {
    saveConfig();
});

// Fermer les modales en cliquant en dehors
window.addEventListener('click', (event) => {
    if (event.target === logsModal) {
        logsModal.classList.remove('show');
    }
    if (event.target === settingsModal) {
        settingsModal.classList.remove('show');
    }
});

// Fonctions de gestion des mappings
function addNewMapping() {
    const mappingNode = document.importNode(mappingTemplate.content, true);
    const mappingItem = mappingNode.querySelector('.mapping-item');
    const mappingId = Date.now().toString();
    mappingItem.dataset.id = mappingId;

    // Configurer les gestionnaires d'événements pour ce mapping
    setupMappingEventListeners(mappingItem);

    mappingsContainer.appendChild(mappingItem);
    mappings.push({
        id: mappingId,
        title: '',
        sourceFolder: '',
        destFolder: '',
        progress: 0
    });
    updateCopyButtonState();
}

function setupMappingEventListeners(mappingItem) {
    const mappingId = mappingItem.dataset.id;
    const titleInput = mappingItem.querySelector('.mapping-title');
    const deleteButton = mappingItem.querySelector('.delete-mapping');
    const editButton = mappingItem.querySelector('.edit-mapping');
    const browseSourceButton = mappingItem.querySelector('.browse-source');
    const browseDestButton = mappingItem.querySelector('.browse-dest');

    titleInput.addEventListener('change', (e) => {
        updateMapping(mappingId, { title: e.target.value });
    });

    deleteButton.addEventListener('click', () => {
        deleteMapping(mappingId);
    });

    editButton.addEventListener('click', () => {
        toggleMappingEdit(mappingId);
    });

    browseSourceButton.addEventListener('click', () => {
        browseFolder(mappingId, 'source');
    });

    browseDestButton.addEventListener('click', () => {
        browseFolder(mappingId, 'dest');
    });
}

function updateMapping(id, updates) {
    const index = mappings.findIndex(m => m.id === id);
    if (index !== -1) {
        mappings[index] = { ...mappings[index], ...updates };
        saveMappings();
    }
}

function deleteMapping(id) {
    const index = mappings.findIndex(m => m.id === id);
    if (index !== -1) {
        mappings.splice(index, 1);
        const mappingElement = document.querySelector(`.mapping-item[data-id="${id}"]`);
        if (mappingElement) {
            mappingElement.remove();
        }
        saveMappings();
        updateCopyButtonState();
    }
}

function toggleMappingEdit(id) {
    const mappingElement = document.querySelector(`.mapping-item[data-id="${id}"]`);
    if (mappingElement) {
        mappingElement.classList.toggle('editing');
    }
}

async function browseFolder(mappingId, type) {
    try {
        const result = await ipcRenderer.invoke('select-folder');
        if (result.canceled) return;

        const folderPath = result.filePaths[0];
        const mapping = mappings.find(m => m.id === mappingId);
        if (mapping) {
            const updates = type === 'source' 
                ? { sourceFolder: folderPath }
                : { destFolder: folderPath };
            
            updateMapping(mappingId, updates);
            
            const input = document.querySelector(`.mapping-item[data-id="${mappingId}"] .${type}-folder`);
            if (input) {
                input.value = folderPath;
            }
            updateCopyButtonState();
        }
    } catch (error) {
        console.error('Erreur lors de la sélection du dossier:', error);
    }
}

// Fonctions de gestion des transferts
function startCopy() {
    const validMappings = mappings.filter(m => m.sourceFolder && m.destFolder);
    if (validMappings.length === 0) {
        alert('Veuillez configurer au moins un mapping valide avant de démarrer la copie.');
        return;
    }

    const copyConfig = {
        mappings: validMappings,
        maxFiles: config.maxFiles
    };

    socket.emit('start-copy', copyConfig);
}

// Gestion des logs
function appendLog(log) {
    const logEntry = document.createElement('div');
    logEntry.textContent = `${new Date(log.timestamp).toLocaleString()} - ${log.message}`;
    logEntry.className = `log-entry ${log.level}`;
    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

// Gestion de la connexion Socket.IO
socket.on('connect', () => {
    pcStatus = true;
    updateStatusIndicators();
});

socket.on('disconnect', () => {
    pcStatus = false;
    updateStatusIndicators();
});

socket.on('mobile-status', (status) => {
    mobileStatus = status;
    updateStatusIndicators();
});

socket.on('copy-progress', (data) => {
    updateMappingProgress(data.mappingId, data.progress);
});

socket.on('log-entry', (log) => {
    appendLog(log);
});

socket.on('logs-history', (logs) => {
    logsContainer.innerHTML = '';
    logs.forEach(log => appendLog(log));
});

// Fonctions utilitaires
function updateStatusIndicators() {
    pcStatusIndicator.className = `fas fa-circle ${pcStatus ? 'connected' : 'disconnected'}`;
    mobileStatusIndicator.className = `fas fa-circle ${mobileStatus ? 'connected' : 'disconnected'}`;
}

function updateMappingProgress(id, progress) {
    const mappingElement = document.querySelector(`.mapping-item[data-id="${id}"]`);
    if (mappingElement) {
        const progressBar = mappingElement.querySelector('.progress');
        const progressText = mappingElement.querySelector('.progress-text');
        
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;
        
        updateMapping(id, { progress });
    }
}

function saveMappings() {
    localStorage.setItem('mappings', JSON.stringify(mappings));
}

function loadMappings() {
    const savedMappings = localStorage.getItem('mappings');
    if (savedMappings) {
        mappings = JSON.parse(savedMappings);
        mappings.forEach(mapping => {
            const mappingNode = document.importNode(mappingTemplate.content, true);
            const mappingItem = mappingNode.querySelector('.mapping-item');
            mappingItem.dataset.id = mapping.id;
            
            const titleInput = mappingItem.querySelector('.mapping-title');
            const sourceInput = mappingItem.querySelector('.source-folder');
            const destInput = mappingItem.querySelector('.dest-folder');
            const progressBar = mappingItem.querySelector('.progress');
            const progressText = mappingItem.querySelector('.progress-text');
            
            titleInput.value = mapping.title;
            sourceInput.value = mapping.sourceFolder;
            destInput.value = mapping.destFolder;
            progressBar.style.width = `${mapping.progress}%`;
            progressText.textContent = `${mapping.progress}%`;
            
            setupMappingEventListeners(mappingItem);
            mappingsContainer.appendChild(mappingItem);
        });
    }
}

function updateCopyButtonState() {
    const copyButton = document.getElementById('start-copy');
    const hasValidMappings = mappings.length > 0 && mappings.every(m => m.sourceFolder && m.destFolder);
    copyButton.disabled = !hasValidMappings;
}

// Gestion des fichiers mobiles
let selectedFolder = null;
let currentMappings = [];

function updateFolderList(folders) {
    const folderList = document.getElementById('folder-list');
    folderList.innerHTML = '';
    
    // Ajouter les dossiers locaux
    folders.forEach(folder => {
        const div = document.createElement('div');
        div.className = 'folder-item';
        div.onclick = () => selectFolder(folder);
        div.innerHTML = `
            <i class="fas fa-folder"></i>
            <span>${folder.name}</span>
        `;
        folderList.appendChild(div);
    });

    // Ajouter la section mobile si connecté
    if (mobileStatus) {
        const mobileSection = document.createElement('div');
        mobileSection.className = 'mobile-section';
        mobileSection.innerHTML = '<h3>Dossiers Mobile</h3>';
        
        socket.emit('request-mobile-files');
    }
}

function selectMobileFolder(folder) {
    selectedFolder = {
        name: folder.name,
        path: folder.uri,
        isMobile: true
    };
    updateSelectedFolder();
}

// Mise à jour de la sélection de dossier
function updateSelectedFolder() {
    const selectedFolderElement = document.getElementById('selected-folder');
    if (selectedFolder) {
        const icon = selectedFolder.isMobile ? 'fa-mobile-alt' : 'fa-folder';
        selectedFolderElement.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${selectedFolder.name}</span>
        `;
    } else {
        selectedFolderElement.innerHTML = '<span>Aucun dossier sélectionné</span>';
    }
}

// Événements Socket.IO pour le mobile
socket.on('mobile-status', ({ connected }) => {
    mobileStatus = connected;
    if (connected) {
        socket.emit('request-mobile-files');
    } else {
        currentMappings = [];
    }
    // Mettre à jour la liste des dossiers
    fetchFolders();
});

socket.on('update-mobile-files', (files) => {
    currentMappings = files;
    // Mettre à jour la liste des dossiers
    fetchFolders();
});

// Fonction pour récupérer les dossiers
async function fetchFolders() {
    try {
        const response = await fetch('/folders');
        const folders = await response.json();
        updateFolderList(folders);
    } catch (error) {
        console.error('Error fetching folders:', error);
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    loadMappings();
    updateStatusIndicators();
    updateCopyButtonState();
    fetchFolders();
});
