const { contextBridge, ipcRenderer } = require('electron');

// Exposer l'API à la fenêtre de rendu
contextBridge.exposeInMainWorld('api', {
    // Fonctions de configuration
    openConfig: () => ipcRenderer.send('open-config'),
    closeWindow: () => ipcRenderer.send('close-window'),
    getMappings: () => ipcRenderer.invoke('get-mappings'),
    getConfig: () => ipcRenderer.invoke('get-config'),
    getCurrentLanguage: () => ipcRenderer.invoke('get-current-language'),
    
    // Actions de mapping
    addMapping: () => ipcRenderer.send('add-mapping'),
    createMapping: (mapping) => ipcRenderer.invoke('create-mapping', mapping),
    updateMapping: (mapping) => ipcRenderer.invoke('update-mapping', mapping),
    deleteMapping: (mappingId) => ipcRenderer.invoke('delete-mapping', mappingId),
    
    // Vérification de la connexion
    checkConnectionStatus: () => ipcRenderer.invoke('get-mobile-status'),
    
    // Événements de connexion mobile
    onMobileConnected: (callback) => {
        ipcRenderer.on('mobile-connected', (event, data) => callback(data));
    },
    onMobileDisconnected: (callback) => {
        ipcRenderer.on('mobile-disconnected', () => callback());
    },
    onMobileStatus: (callback) => {
        ipcRenderer.on('mobile-status', (event, data) => callback(data));
    },

    // Événements de mapping
    onMappingAdded: (callback) => {
        ipcRenderer.on('mapping-added', () => callback());
    },
    onMappingUpdate: (callback) => {
        ipcRenderer.on('mapping-update', (event, mapping) => callback(mapping));
    },
    onMappingDelete: (callback) => {
        ipcRenderer.on('mapping-delete', (event, id) => callback(id));
    },
    onMappingProgress: (callback) => {
        ipcRenderer.on('mapping-progress', (event, data) => callback(data));
    },

    // Sélection de dossiers
    selectMobileFolder: () => ipcRenderer.invoke('select-mobile-folder'),
    selectPcFolder: () => ipcRenderer.invoke('select-pc-folder'),
    
    // Événements de sélection de dossier
    onMobileFolderSelected: (callback) => {
        ipcRenderer.on('mobile-folder-selected', (event, path) => callback(path));
    },
    onPcFolderSelected: (callback) => {
        ipcRenderer.on('pc-folder-selected', (event, path) => callback(path));
    }
});
