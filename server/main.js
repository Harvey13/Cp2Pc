const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const express = require('express');
const os = require('os');
const config = require('./config');

// Détecter le mode développement
const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';
console.log('Running in development mode:', isDev);

// Configuration par défaut
const DEFAULT_CONFIG = {
    maxFiles: 1000,
    language: 'fr',
    mappings: []
};

// État global
let mainWindow = null;
let configWindow = null;
let mappingWindow = null;
let currentConfig = { ...DEFAULT_CONFIG };
let expressApp = null;
let connectedMobileIP = null;
let lastPingTime = null;
let lastPingInterval = null;

// Configuration
const PING_TIMEOUT = 5000; // 5 secondes pour être plus tolérant

// Initialiser Express
function createServer() {
    expressApp = express();
    
    // Endpoint de ping pour la découverte et keepalive
    expressApp.get('/ping', (req, res) => {
        const clientIP = req.ip;
        const now = Date.now();
        console.log(`[Server] Ping from ${clientIP} at ${now}`);
        
        // Si c'est un nouveau client ou une reconnexion
        if (clientIP !== connectedMobileIP) {
            console.log(`[Server] New mobile connection from ${clientIP}`);
        }
        
        // Mettre à jour l'état de connexion et le timestamp
        connectedMobileIP = clientIP;
        lastPingTime = now;
        
        // Notifier le frontend
        if (mainWindow) {
            mainWindow.webContents.send('mobile-connected', clientIP);
        }
        
        // Répondre avec les infos du serveur pour le mobile
        res.json({
            status: 'ok',
            name: os.hostname(),
            ip: getLocalIP(),
            clientIP: clientIP
        });
    });

    // Servir les fichiers statiques
    expressApp.use(express.static(path.join(__dirname, 'public')));
    
    // Démarrer le serveur
    const port = 3000;
    expressApp.listen(port, () => {
        console.log(`[Server] Listening on port ${port}`);
    });
}

// Vérifier la connexion mobile périodiquement
function startConnectionCheck() {
    setInterval(() => {
        const now = Date.now();
        if (lastPingTime && connectedMobileIP) {
            lastPingInterval = now - lastPingTime;
            // Si le dernier ping est plus vieux que PING_TIMEOUT
            if (lastPingInterval > PING_TIMEOUT) {
                console.log(`[Server] Mobile connection timeout - Device: ${connectedMobileIP}, Last ping: ${lastPingTime}, Interval: ${lastPingInterval}ms`);
                if (mainWindow) {
                    mainWindow.webContents.send('mobile-disconnected');
                }
                connectedMobileIP = null;
            }
        }
    }, 1000); // Vérification toutes les secondes
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
        console.log('DevTools opened in development mode');
    }

    mainWindow.removeMenu(); // Supprimer le menu
    mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));
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
            devTools: true // Toujours activer les devtools
        }
    });

    // En mode dev, ouvrir les devtools automatiquement
    if (isDev) {
        configWindow.webContents.openDevTools();
    }

    configWindow.removeMenu(); // Supprimer le menu
    configWindow.loadFile(path.join(__dirname, 'public', 'config.html'));

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
        const data = await fs.readFile(configPath, 'utf8');
        currentConfig = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch (error) {
        console.log('[Config] Fichier de configuration non trouvé, utilisation des valeurs par défaut');
        currentConfig = { ...DEFAULT_CONFIG };
    }
    return currentConfig;
}

async function saveConfig(config) {
    try {
        const configPath = path.join(app.getPath('userData'), 'config.json');
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        currentConfig = config;
        mainWindow.webContents.send('config-updated', config);
        return true;
    } catch (error) {
        console.error('[Config] Erreur lors de la sauvegarde:', error);
        return false;
    }
}

// Gestion des IPC
function setupIPC() {
    // Configuration
    ipcMain.handle('get-config', async () => {
        return await loadConfig();
    });

    ipcMain.handle('save-config', async (event, config) => {
        return await saveConfig(config);
    });

    ipcMain.handle('get-current-language', async () => {
        const config = await loadConfig();
        return config.language || 'fr';
    });

    ipcMain.handle('set-language', async (event, language) => {
        const config = await loadConfig();
        config.language = language;
        const success = await saveConfig(config);
        if (success) {
            mainWindow.webContents.send('language-changed', language);
        }
        return success;
    });

    // Fenêtres
    ipcMain.on('open-config-window', () => {
        console.log('[Server] Ouverture fenêtre configuration');
        if (!configWindow) {
            createConfigWindow();
        } else {
            configWindow.focus();
        }
    });

    ipcMain.handle('open-mapping-dialog', () => {
        createMappingWindow();
    });

    // Sélection de dossiers
    ipcMain.handle('select-pc-folder', async (event) => {
        console.log('[IPC] Selecting PC folder');
        const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
            properties: ['openDirectory']
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
            const selectedPath = result.filePaths[0];
            console.log('[IPC] PC folder selected:', selectedPath);
            event.sender.send('pc-folder-selected', selectedPath);
            return selectedPath;
        }
        return null;
    });

    ipcMain.handle('select-mobile-folder', async (event, mappingId) => {
        console.log('[IPC] Selecting mobile folder');
        // Pour l'instant, on utilise aussi un sélecteur de dossier local
        const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
            properties: ['openDirectory']
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
            const selectedPath = result.filePaths[0];
            console.log('[IPC] Mobile folder selected:', selectedPath);
            event.sender.send('mobile-folder-selected', selectedPath);
            return selectedPath;
        }
        return null;
    });

    ipcMain.handle('save-mapping', async (event, mapping) => {
        const config = await loadConfig();
        if (!config.mappings) {
            config.mappings = [];
        }
        config.mappings.push(mapping);
        return await saveConfig(config);
    });

    ipcMain.handle('validate-path', async (event, path) => {
        try {
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    });

    ipcMain.handle('close-window', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
            win.close();
        }
    });

    // Gestion des mappings
    ipcMain.handle('get-mappings', async () => {
        const config = await loadConfig();
        return config.mappings || [];
    });

    // Gestion des mappings supplémentaires
    ipcMain.on('add-mapping', () => {
        const newMapping = {
            id: Date.now(),
            title: 'Nouveau mapping',
            sourcePath: '',
            destPath: '',
            progress: 0
        };
        mainWindow.webContents.send('mapping-added', newMapping);
    });

    ipcMain.on('start-copy', (event, mappings) => {
        console.log('[Server] Démarrage de la copie avec mappings:', mappings);
        // Simuler la progression pour chaque mapping
        mappings.forEach(mapping => {
            let progress = 0;
            const interval = setInterval(() => {
                progress += 10;
                mainWindow.webContents.send('mapping-progress', {
                    id: mapping.id,
                    progress: Math.min(progress, 100)
                });
                if (progress >= 100) {
                    clearInterval(interval);
                }
            }, 1000);
        });
    });

    // Gestion des erreurs
    ipcMain.on('error', (event, error) => {
        console.error('[IPC] Erreur reçue:', error);
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
