const { contextBridge, ipcRenderer } = require('electron');

// API exposée au renderer process
contextBridge.exposeInMainWorld('electron', {
    // Configuration
    saveConfig: async (config) => {
        return await ipcRenderer.invoke('save-config', config);
    },
    
    getConfig: async () => {
        return await ipcRenderer.invoke('get-config');
    },
    
    onConfigChange: (callback) => {
        ipcRenderer.on('config-updated', (event, config) => callback(config));
        return () => {
            ipcRenderer.removeAllListeners('config-updated');
        };
    },

    // Gestion des langues
    getCurrentLanguage: async () => {
        return await ipcRenderer.invoke('get-current-language');
    },
    
    setLanguage: async (language) => {
        return await ipcRenderer.invoke('set-language', language);
    },
    
    onLanguageChange: (callback) => {
        ipcRenderer.on('language-changed', (event, language) => callback(language));
        return () => {
            ipcRenderer.removeAllListeners('language-changed');
        };
    },

    // Gestion des fenêtres
    openConfig: () => {
        console.log('[IPC] Demande ouverture configuration');
        ipcRenderer.send('open-config-window');
    },
    
    closeWindow: async () => {
        await ipcRenderer.invoke('close-window');
    },

    // Gestion des chemins
    selectDirectory: async () => {
        return await ipcRenderer.invoke('select-directory');
    },
    
    validatePath: async (path) => {
        return await ipcRenderer.invoke('validate-path', path);
    },

    // Gestion des erreurs
    onError: (callback) => {
        ipcRenderer.on('error', (event, error) => callback(error));
        return () => {
            ipcRenderer.removeAllListeners('error');
        };
    },

    // Gestion des mappings
    selectMobileFolder: (mappingId) => {
        return ipcRenderer.invoke('select-mobile-folder', mappingId);
    },
    
    saveMapping: (mapping) => {
        return ipcRenderer.invoke('save-mapping', mapping);
    },
});

// Exposer les APIs au renderer
contextBridge.exposeInMainWorld('api', {
    // Événements de connexion mobile
    onMobileConnected: (callback) => {
        ipcRenderer.on('mobile-connected', callback);
        return () => ipcRenderer.removeListener('mobile-connected', callback);
    },
    
    onMobileDisconnected: (callback) => {
        ipcRenderer.on('mobile-disconnected', callback);
        return () => ipcRenderer.removeListener('mobile-disconnected', callback);
    },

    // Événements des mappings
    onMappingAdded: (callback) => {
        ipcRenderer.on('mapping-added', callback);
        return () => ipcRenderer.removeListener('mapping-added', callback);
    },

    onMappingProgress: (callback) => {
        ipcRenderer.on('mapping-progress', callback);
        return () => ipcRenderer.removeListener('mapping-progress', callback);
    },

    onFolderSelected: (callback) => {
        ipcRenderer.on('folder-selected', callback);
        return () => ipcRenderer.removeListener('folder-selected', callback);
    },

    // Actions des boutons
    openConfig: () => {
        console.log('[IPC] Demande ouverture configuration');
        ipcRenderer.send('open-config');
    },

    addMapping: () => {
        console.log('[IPC] Demande ajout mapping');
        ipcRenderer.send('add-mapping');
    },

    selectMobileFolder: (mappingId) => {
        console.log('[IPC] Demande sélection dossier mobile pour mapping', mappingId);
        ipcRenderer.send('select-mobile-folder', mappingId);
    },

    selectPCFolder: (mappingId) => {
        console.log('[IPC] Demande sélection dossier PC pour mapping', mappingId);
        ipcRenderer.send('select-pc-folder', mappingId);
    },

    startCopy: (mappings) => {
        console.log('[IPC] Demande démarrage copie avec mappings:', mappings);
        ipcRenderer.send('start-copy', mappings);
    }
});

// Initialisation
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // Charger la configuration initiale
        const config = await ipcRenderer.invoke('get-config');
        window.dispatchEvent(new CustomEvent('config-loaded', { detail: config }));
        
        // Charger la langue initiale
        const language = await ipcRenderer.invoke('get-current-language');
        window.dispatchEvent(new CustomEvent('language-loaded', { detail: language }));
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});
