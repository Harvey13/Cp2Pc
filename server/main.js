const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const express = require('express');
const os = require('os');
const http = require('http');
const { Server } = require('socket.io');
const logger = require(path.join(__dirname, 'utils', 'logger'));
const { LogTypes } = logger;
const { createConfigManager, getConfigManager } = require('./src/config');

// Détecter le mode développement
const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';
logger.console_log(LogTypes.CONFIG, 'Running in development mode:', isDev);

// Variables globales
let mainWindow = null;
let configWindow = null;
let expressApp = null;
let io = null;
let connectedDevice = null;
let lastPingTime = null;
let copyInProgress = false;
let cancelCopyRequested = false;
let currentConfig = null;
let configManager = null;
let connectionManager = null;

const PING_TIMEOUT = 3000; // 3 secondes

// Configuration minimale par défaut (utilisée uniquement à la première installation)
const MINIMAL_CONFIG = {
    maxFiles: 1000,
    language: 'fr',
    mappings: [],
    localMode: false,
    logs: {
        activeTypes: ['CONFIG', 'INFO', 'ERROR']
    }
};

// Gestionnaire de connexion
class ConnectionManager {
    constructor() {
        this.isConnected = false;
        this.deviceInfo = null;
    }

    setStatus(connected, info = null) {
        this.isConnected = connected;
        this.deviceInfo = info;
        this.notifyStatusChange();
    }

    getStatus() {
        return {
            connected: this.isConnected,
            deviceInfo: this.deviceInfo
        };
    }

    notifyStatusChange() {
        BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.send('connection-status', this.getStatus());
        });
    }
}

// Initialiser Express et Socket.IO
function createServer() {
    expressApp = express();
    const server = http.createServer(expressApp);
    
    // Servir les fichiers statiques
    expressApp.use(express.static(path.join(__dirname, 'public')));

    // Configuration de Socket.IO
    io = new Server(server);

    // Gestion des connexions Socket.IO
    io.on('connection', (socket) => {
        logger.console_log(LogTypes.CONNECT, 'New client connected');
        
        socket.on('web-connect', () => {
            logger.console_log(LogTypes.CONNECT, 'Web client connected');
        });
        
        socket.on('disconnect', () => {
            logger.console_log(LogTypes.CONNECT, 'Client disconnected');
        });
    });

    // Endpoint de ping pour la découverte et keepalive
    expressApp.get('/ping', (req, res) => {
        const deviceName = req.headers['x-device-name'];
        const deviceId = req.headers['x-device-id'];
        const clientIp = req.ip;

        // Mettre à jour le temps du dernier ping
        lastPingTime = Date.now();
        
        // Mettre à jour les informations du device connecté
        if (deviceName && deviceId) {
            connectedDevice = {
                deviceName,
                deviceId,
                ip: clientIp,
                lastPing: lastPingTime
            };
        }

        // Informer l'interface web via Socket.IO
        io.emit('mobile-status', {
            connected: true,
            deviceInfo: connectedDevice
        });

        // Informer l'interface Electron via IPC
        if (mainWindow) {
            mainWindow.webContents.send('mobile-connected', connectedDevice);
        }

        res.json({ 
            status: 'ok', 
            time: lastPingTime,
            name: os.hostname(),
            ip: getLocalIP(),
            clientIP: clientIp
        });
    });

    // Démarrer le serveur
    const port = 3000;
    server.listen(port, () => {
        logger.console_log(LogTypes.SERVER, `Server listening on port ${port}`);
    });

    return server;
}

// Vérifier périodiquement la connexion mobile
function startConnectionCheck() {
    // Initialiser l'état comme déconnecté au démarrage
    io?.emit('mobile-status', {
        connected: false,
        deviceInfo: null
    });

    if (mainWindow) {
        mainWindow.webContents.send('mobile-disconnected');
    }

    setInterval(() => {
        const now = Date.now();
        // Vérifier si le mobile n'a pas pingé depuis trop longtemps ou s'il n'a jamais pingé
        if (!lastPingTime || (now - lastPingTime > PING_TIMEOUT)) {
            lastPingTime = null;
            connectedDevice = null;
            
            // Informer l'interface web
            io?.emit('mobile-status', {
                connected: false,
                deviceInfo: null
            });

            // Informer l'interface Electron
            if (mainWindow) {
                mainWindow.webContents.send('mobile-disconnected');
            }
        }
    }, 1000); // Vérifier toutes les secondes
}

// Obtenir l'IP locale
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
        for (const alias of iface) {
            if (alias.family === 'IPv4' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '127.0.0.1';
}

// Gestion des fenêtres
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            devTools: true // Toujours activer les devtools
        }
    });

    // En mode dev, ouvrir les devtools automatiquement
    if (isDev) {
        mainWindow.webContents.openDevTools();
        logger.console_log(LogTypes.CONFIG, 'DevTools opened in development mode');
    }

    mainWindow.removeMenu(); // Supprimer le menu
    mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createConfigWindow() {
    configWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Charger la page de configuration
    configWindow.loadFile(path.join(__dirname, 'public', 'config.html'));

    // Ouvrir les DevTools en mode développement
    if (process.env.NODE_ENV === 'development') {
        console.log('[CONFIG] Opening DevTools in config window');
        configWindow.webContents.openDevTools();
    }

    // Gérer la fermeture de la fenêtre
    configWindow.on('closed', () => {
        configWindow = null;
    });
}

function createMappingWindow() {
    mappingWindow = new BrowserWindow({
        width: 600,
        height: 400,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            devTools: true // Activer les devtools
        },
        parent: mainWindow,
        modal: true,
        show: false
    });

    mappingWindow.loadFile(path.join(__dirname, 'public', 'mapping.html'));
    mappingWindow.once('ready-to-show', () => {
        mappingWindow.show();
        // Ouvrir les devtools en mode dev
        if (isDev) {
            mappingWindow.webContents.openDevTools();
        }
    });
}

// Gestionnaire IPC pour la sauvegarde
ipcMain.handle('save-config', async (event, newConfig) => {
    return configManager.saveConfig(newConfig);
});

// Pour les mises à jour de configuration dans le code
async function updateAppConfig(partialConfig) {
    return configManager.updateConfig(partialConfig);
}

// Gestion des IPC
function setupIPC() {
    const configManager = getConfigManager();
    
    // Initialiser le ConnectionManager s'il n'existe pas
    if (!connectionManager) {
        connectionManager = new ConnectionManager();
    }
    
    // Supprimer les gestionnaires existants
    ipcMain.removeHandler('get-mappings');
    ipcMain.removeHandler('get-config');
    ipcMain.removeHandler('save-config');
    ipcMain.removeHandler('check-mobile-status');
    ipcMain.removeHandler('get-mobile-status');
    ipcMain.removeHandler('get-connection-status');
    ipcMain.removeHandler('update-connection-status');
    
    // Ajouter le gestionnaire pour ouvrir la fenêtre de configuration
    ipcMain.handle('open-config', () => {
        if (!configWindow) {
            createConfigWindow();
        } else {
            configWindow.focus();
        }
    });

    // Ajouter le gestionnaire pour fermer la fenêtre de configuration
    ipcMain.handle('close-config', () => {
        if (configWindow) {
            configWindow.close();
        }
    });

    // Enregistrer les nouveaux gestionnaires
    ipcMain.handle('get-mappings', async () => {
        try {
            const config = configManager.getConfig();
            return config.mappings || [];
        } catch (error) {
            console.error('[CONFIG] Erreur lors de la récupération des mappings:', error);
            throw error;
        }
    });

    ipcMain.handle('save-mappings', async (event, mappings) => {
        try {
            const config = configManager.getConfig();
            config.mappings = mappings;
            await configManager.updateConfig(config);
            return mappings;
        } catch (error) {
            console.error('[CONFIG] Erreur lors de la sauvegarde des mappings:', error);
            throw error;
        }
    });

    ipcMain.handle('get-config', async () => {
        try {
            return configManager.getConfig();
        } catch (error) {
            console.error('[CONFIG] Erreur lors de la récupération de la config:', error);
            throw error;
        }
    });

    ipcMain.handle('save-config', async (event, newConfig) => {
        try {
            const updatedConfig = await configManager.updateConfig(newConfig);
            // Notifier tous les renderers de la mise à jour
            BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('config-updated', updatedConfig);
            });
            return updatedConfig;
        } catch (error) {
            console.error('[CONFIG] Erreur lors de la sauvegarde:', error);
            throw error;
        }
    });

    ipcMain.handle('check-mobile-status', async () => {
        try {
            const config = configManager.getConfig();
            return {
                connected: config.mobileStatus?.connected || false,
                deviceInfo: config.mobileStatus?.deviceInfo || null
            };
        } catch (error) {
            console.error('[CONFIG] Erreur lors de la vérification du statut:', error);
            throw error;
        }
    });

    // Ajout du gestionnaire get-mobile-status
    ipcMain.handle('get-mobile-status', async () => {
        try {
            const config = configManager.getConfig();
            return {
                connected: config.mobileStatus?.connected || false,
                deviceInfo: config.mobileStatus?.deviceInfo || null
            };
        } catch (error) {
            console.error('[CONFIG] Erreur lors de la récupération du statut mobile:', error);
            throw error;
        }
    });

    // Gestionnaire pour obtenir le statut de connexion
    ipcMain.handle('get-connection-status', () => {
        return connectionManager.getStatus();
    });

    // Gestionnaire pour la mise à jour du statut
    ipcMain.handle('update-connection-status', (event, status) => {
        connectionManager.setStatus(status.connected, status.deviceInfo);
        return connectionManager.getStatus();
    });

    // Gestionnaires de sélection de dossier
    ipcMain.handle('select-mobile-folder', async (event, data) => {
        try {
            // Émettre l'événement vers le mobile via socket
            if (mobileSocket && mobileSocket.connected) {
                mobileSocket.emit('select-mobile-folder', data);
                return { success: true };
            }
            throw new Error('Mobile non connecté');
        } catch (error) {
            console.error('[MOBILE] Erreur lors de la sélection du dossier:', error);
            throw error;
        }
    });

    ipcMain.handle('select-local-folder', async () => {
        try {
            const result = await dialog.showOpenDialog(mainWindow, {
                properties: ['openDirectory'],
                title: 'Sélectionner un dossier local'
            });
            
            if (!result.canceled) {
                return { path: result.filePaths[0] };
            }
            return { canceled: true };
        } catch (error) {
            console.error('[FOLDER] Erreur lors de la sélection du dossier:', error);
            throw error;
        }
    });

    // Gestionnaire de sélection de dossier PC
    ipcMain.handle('select-pc-folder', async () => {
        try {
            const result = await dialog.showOpenDialog(mainWindow, {
                properties: ['openDirectory'],
                title: 'Sélectionner un dossier sur le PC'
            });

            if (!result.canceled) {
                const selectedPath = result.filePaths[0];
                
                // Notifier tous les renderers
                BrowserWindow.getAllWindows().forEach(window => {
                    window.webContents.send('pc-folder-selected', {
                        path: selectedPath
                    });
                });

                return { path: selectedPath };
            }
            
            return { canceled: true };
        } catch (error) {
            console.error('[FOLDER] Erreur lors de la sélection du dossier PC:', error);
            
            // Notifier l'erreur
            BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('pc-folder-error', {
                    error: error.message
                });
            });
            
            throw error;
        }
    });

    // Gestionnaires de copie
    ipcMain.handle('start-copy', async (event, mappingId) => {
        try {
            // Logique de copie à implémenter
            return { success: true };
        } catch (error) {
            console.error('[COPY] Erreur lors du démarrage de la copie:', error);
            throw error;
        }
    });

    ipcMain.handle('cancel-copy', async (event, mappingId) => {
        try {
            // Logique d'annulation à implémenter
            return { success: true };
        } catch (error) {
            console.error('[COPY] Erreur lors de l\'annulation de la copie:', error);
            throw error;
        }
    });

    // Gestionnaires de mapping
    ipcMain.handle('save-mapping', async (event, mapping) => {
        try {
            const config = configManager.getConfig();
            const mappings = config.mappings || [];
            
            if (mapping.id) {
                // Mise à jour d'un mapping existant
                const index = mappings.findIndex(m => m.id === mapping.id);
                if (index !== -1) {
                    mappings[index] = mapping;
                }
            } else {
                // Nouveau mapping
                mapping.id = Date.now().toString();
                mappings.push(mapping);
            }
            
            config.mappings = mappings;
            await configManager.updateConfig(config);

            // Notifier tous les renderers
            BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('mappings-updated', mappings);
            });

            return { success: true, mapping };
        } catch (error) {
            console.error('[MAPPING] Erreur lors de la sauvegarde:', error);
            throw error;
        }
    });

    ipcMain.handle('update-mapping', async (event, mapping) => {
        try {
            const config = configManager.getConfig();
            const mappings = config.mappings || [];
            const index = mappings.findIndex(m => m.id === mapping.id);
            
            if (index !== -1) {
                mappings[index] = mapping;
                config.mappings = mappings;
                await configManager.updateConfig(config);

                // Notifier tous les renderers
                BrowserWindow.getAllWindows().forEach(window => {
                    window.webContents.send('mappings-updated', mappings);
                });

                return { success: true, mapping };
            }
            throw new Error('Mapping non trouvé');
        } catch (error) {
            console.error('[MAPPING] Erreur lors de la mise à jour:', error);
            throw error;
        }
    });

    ipcMain.handle('delete-mapping', async (event, mappingId) => {
        try {
            const config = configManager.getConfig();
            const mappings = config.mappings || [];
            const index = mappings.findIndex(m => m.id === mappingId);
            
            if (index !== -1) {
                mappings.splice(index, 1);
                config.mappings = mappings;
                await configManager.updateConfig(config);

                // Notifier tous les renderers
                BrowserWindow.getAllWindows().forEach(window => {
                    window.webContents.send('mappings-updated', mappings);
                });

                return { success: true };
            }
            throw new Error('Mapping non trouvé');
        } catch (error) {
            console.error('[MAPPING] Erreur lors de la suppression:', error);
            throw error;
        }
    });

    // Gestionnaires de navigation
    ipcMain.handle('close-editor', () => {
        if (mainWindow) {
            mainWindow.webContents.send('editor-closed');
        }
        return { success: true };
    });

    ipcMain.handle('cancel-editing', () => {
        if (mainWindow) {
            mainWindow.webContents.send('editing-cancelled');
        }
        return { success: true };
    });

    console.log('[IPC] Gestionnaires IPC configurés');
}

// Initialisation de l'application
app.whenReady().then(async () => {
    // Initialiser le gestionnaire de configuration
    configManager = createConfigManager();
    connectionManager = new ConnectionManager();
    
    const config = configManager.getConfig();
    setupIPC();
    createMainWindow();
    createServer();
    startConnectionCheck();
});

// Quitter quand toutes les fenêtres sont fermées
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});
