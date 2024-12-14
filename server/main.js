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

const PING_TIMEOUT = 10000; // 10 secondes

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
    if (configWindow) {
        configWindow.focus();
        return;
    }

    configWindow = new BrowserWindow({
        width: 600,
        height: 400,
        parent: mainWindow,
        modal: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            devTools: true
        }
    });

    // En mode dev, ouvrir les devtools automatiquement
    if (isDev) {
        configWindow.webContents.openDevTools();
        logger.console_log(LogTypes.CONFIG, 'Opening DevTools in config window');
    }

    configWindow.removeMenu(); // Supprimer le menu
    
    const configPath = path.join(__dirname, 'public', 'config.html');
    logger.console_log(LogTypes.CONFIG, 'Loading config window from:', configPath);
    
    configWindow.loadFile(configPath);

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

// Gestion de la configuration
async function loadConfig() {
    try {
        const configPath = path.join(app.getPath('userData'), 'config.json');
        
        // Vérifier si le fichier existe
        try {
            await fsPromises.access(configPath);
        } catch {
            // Le fichier n'existe pas, créer une configuration minimale
            await fsPromises.writeFile(configPath, JSON.stringify(MINIMAL_CONFIG, null, 2));
            logger.console_log(LogTypes.CONFIG, '[Config] Création de la configuration initiale');
        }
        
        // Charger la configuration
        const data = await fsPromises.readFile(configPath, 'utf8');
        currentConfig = JSON.parse(data);
        logger.console_log(LogTypes.CONFIG, '[Config] Configuration chargée:', currentConfig);
        
    } catch (error) {
        logger.console_log(LogTypes.ERROR, '[Config] Erreur fatale lors du chargement de la configuration:', error);
        throw error;
    }
    return currentConfig;
}

async function saveConfig(config) {
    try {
        const configPath = path.join(app.getPath('userData'), 'config.json');
        await fsPromises.writeFile(configPath, JSON.stringify(config, null, 2));
        currentConfig = config;
        logger.console_log(LogTypes.CONFIG, '[Config] Configuration sauvegardée:', currentConfig);
        return true;
    } catch (error) {
        logger.console_log(LogTypes.ERROR, '[Config] Erreur lors de la sauvegarde:', error);
        return false;
    }
}

// Gestion des IPC
function setupIPC() {
    // Configuration
    ipcMain.handle('get-config', async () => {
        return currentConfig;
    });

    ipcMain.handle('save-config', async (event, config) => {
        return await saveConfig(config);
    });

    ipcMain.on('open-config', () => {
        logger.console_log(LogTypes.INFO, 'Opening config window');
        if (!configWindow) {
            createConfigWindow();
        } else {
            configWindow.focus();
        }
    });

    ipcMain.on('close-window', (event) => {
        logger.console_log(LogTypes.INFO, 'Closing window');
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
            win.close();
        }
    });

    // Vérification du statut mobile
    ipcMain.handle('get-mobile-status', () => {
        logger.console_log(LogTypes.INFO, 'Checking mobile status');
        return {
            connected: !!connectedDevice,
            deviceInfo: connectedDevice
        };
    });

    ipcMain.handle('get-mappings', async () => {
        return currentConfig.mappings || [];
    });

    ipcMain.handle('get-current-language', async () => {
        return currentConfig.language || 'fr';
    });

    // Sélection de dossiers
    ipcMain.handle('select-mobile-folder', async (event) => {
        logger.console_log(LogTypes.INFO, 'Selecting mobile folder');
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory']
        });
        if (!result.canceled && result.filePaths.length > 0) {
            const selectedPath = result.filePaths[0];
            event.sender.send('mobile-folder-selected', selectedPath);
            return selectedPath;
        }
        return null;
    });

    ipcMain.handle('select-pc-folder', async (event) => {
        logger.console_log(LogTypes.INFO, 'Selecting PC folder');
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory']
        });
        if (!result.canceled && result.filePaths.length > 0) {
            const selectedPath = result.filePaths[0];
            event.sender.send('pc-folder-selected', selectedPath);
            return selectedPath;
        }
        return null;
    });

    // Gestion des mappings
    ipcMain.on('add-mapping', (event) => {
        logger.console_log(LogTypes.MAPS, 'Adding new mapping');
        if (mainWindow) {
            mainWindow.webContents.send('mapping-added');
        }
    });

    ipcMain.on('delete-mapping', (event, id) => {
        logger.console_log(LogTypes.MAPS, 'Deleting mapping:', id);
        if (mainWindow) {
            mainWindow.webContents.send('mapping-delete', id);
        }
    });

    ipcMain.on('mapping-update', (event, mapping) => {
        logger.console_log(LogTypes.MAPS, 'Updating mapping:', mapping);
        if (mainWindow) {
            mainWindow.webContents.send('mapping-update', mapping);
        }
    });

    ipcMain.handle('create-mapping', async (event, mapping) => {
        logger.console_log(LogTypes.INFO, 'Creating new mapping:', mapping);
        try {
            // Générer un ID unique pour le nouveau mapping
            mapping.id = Date.now().toString();
            currentConfig.mappings = currentConfig.mappings || [];
            currentConfig.mappings.push(mapping);
            await saveConfig(currentConfig);
            return mapping;
        } catch (error) {
            logger.console_log(LogTypes.ERROR, 'Error creating mapping:', error);
            throw error;
        }
    });

    ipcMain.handle('update-mapping', async (event, mapping) => {
        logger.console_log(LogTypes.INFO, 'Updating mapping:', mapping);
        try {
            const index = currentConfig.mappings.findIndex(m => m.id === mapping.id);
            if (index !== -1) {
                currentConfig.mappings[index] = mapping;
                await saveConfig(currentConfig);
                return mapping;
            }
            throw new Error('Mapping not found');
        } catch (error) {
            logger.console_log(LogTypes.ERROR, 'Error updating mapping:', error);
            throw error;
        }
    });

    ipcMain.handle('delete-mapping', async (event, mappingId) => {
        logger.console_log(LogTypes.INFO, 'Deleting mapping:', mappingId);
        try {
            const index = currentConfig.mappings.findIndex(m => m.id === mappingId);
            if (index !== -1) {
                currentConfig.mappings.splice(index, 1);
                await saveConfig(currentConfig);
                return true;
            }
            throw new Error('Mapping not found');
        } catch (error) {
            logger.console_log(LogTypes.ERROR, 'Error deleting mapping:', error);
            throw error;
        }
    });

    // Fonction de copie locale
    async function copyLocalFiles(mapping, event) {
        try {
            const sourcePath = mapping.sourcePath;
            const destPath = mapping.destPath;
            
            const { processMapping } = require('./src/fileProcessor');
            await processMapping({
                mapping,
                onProgress: (progress) => {
                    // Envoyer la progression au client
                    event.sender.send('copy-progress', {
                        status: progress.status,
                        mapping: progress.mapping,
                        current: progress.current,
                        total: progress.total,
                        file: progress.file,
                        percentage: Math.round((progress.current / progress.total) * 100),
                        transferred: progress.current,
                        remainingTime: 0,  // À calculer si nécessaire
                        speed: 0  // À calculer si nécessaire
                    });
                },
                onComplete: (result) => {
                    // Envoyer la fin de la copie au client
                    event.sender.send('copy-progress', {
                        status: 'completed',
                        mapping: result.mapping,
                        current: result.processed,
                        total: result.total,
                        percentage: 100,
                        transferred: result.processed
                    });
                }
            });
            
            return true;
        } catch (error) {
            logger.console_log(LogTypes.ERROR, 'Error copying files:', error);
            // Envoyer l'erreur au client
            event.sender.send('copy-progress', {
                status: 'error',
                error: error.message
            });
            throw error;
        }
    }

    // Gestionnaire de l'événement start-copy
    ipcMain.handle('start-copy', async (event, mappings = null) => {
        logger.console_log(LogTypes.INFO, '🚀 Réception de la demande de copie', {
            mappingsCount: mappings ? mappings.length : 'tous les mappings'
        });

        if (copyInProgress) {
            logger.console_log(LogTypes.INFO, '⚠️ Une copie est déjà en cours');
            throw new Error('Une copie est déjà en cours');
        }

        try {
            copyInProgress = true;
            cancelCopyRequested = false;

            // Si aucun mapping n'est spécifié, utiliser tous les mappings
            const mappingsToProcess = mappings || currentConfig.mappings;
            logger.console_log(LogTypes.INFO, '📋 Mappings à traiter', {
                count: mappingsToProcess.length,
                mappings: mappingsToProcess.map(m => ({ title: m.title, id: m.id }))
            });

            // Envoyer l'événement de démarrage
            event.sender.send('copy-progress', {
                status: 'start',
                total: mappingsToProcess.length
            });

            for (const mapping of mappingsToProcess) {
                if (cancelCopyRequested) {
                    logger.console_log(LogTypes.INFO, '❌ Copie annulée');
                    event.sender.send('copy-progress', {
                        status: 'error',
                        error: 'Copie annulée par l\'utilisateur'
                    });
                    break;
                }
                logger.console_log(LogTypes.INFO, '📂 Démarrage de la copie pour le mapping', {
                    title: mapping.title,
                    sourcePath: mapping.sourcePath,
                    destPath: mapping.destPath
                });
                await copyLocalFiles(mapping, event);
                logger.console_log(LogTypes.INFO, '✅ Copie terminée pour le mapping', {
                    title: mapping.title
                });
            }

            // Envoyer l'événement de fin de copie
            event.sender.send('copy-progress', {
                status: 'finished'
            });

            return true;
        } catch (error) {
            logger.console_log(LogTypes.ERROR, '❌ Erreur pendant la copie:', error);
            // Envoyer l'erreur au client
            event.sender.send('copy-progress', {
                status: 'error',
                error: error.message
            });
            throw error;
        } finally {
            copyInProgress = false;
            cancelCopyRequested = false;
            // S'assurer que l'événement finished est envoyé même en cas d'erreur
            event.sender.send('copy-progress', {
                status: 'finished'
            });
            logger.console_log(LogTypes.INFO, '🏁 Processus de copie terminé');
        }
    });

    // Gestionnaire pour annuler la copie
    ipcMain.handle('cancel-copy', () => {
        logger.console_log(LogTypes.INFO, '🛑 Cancel copy requested');
        cancelCopyRequested = true;
    });

    // Gestion des dossiers
    ipcMain.handle('select-folder', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory']
        });
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0];
        }
        return null;
    });

    // Gestion des erreurs
    ipcMain.on('error', (event, error) => {
        logger.console_log(LogTypes.ERROR, 'Error received:', error);
        dialog.showErrorBox('Erreur', error.message || 'Une erreur est survenue');
    });
}

// Initialisation de l'application
app.whenReady().then(async () => {
    await loadConfig();
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
