const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const { networkInterfaces } = require('os');

// Variables globales
let mainWindow = null;
let io = null;
let server = null;

// Configuration des chemins
const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, 'src');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const APP_PATH = app.getAppPath();

// Utilitaire de logging
function debugLog(...args) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] [Main]`, ...args);
}

debugLog('📂 Répertoires:');
debugLog('- ROOT:', ROOT_DIR);
debugLog('- SRC:', SRC_DIR);
debugLog('- PUBLIC:', PUBLIC_DIR);

// Vérification de la validité de mainWindow
function isWindowValid() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        debugLog('❌ mainWindow non valide');
        return false;
    }
    return true;
}

function createWindow() {
    debugLog('🎨 Création de la fenêtre principale');
    
    // Vérification des chemins critiques
    const preloadPath = path.join(SRC_DIR, 'preload.js');
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    
    debugLog('📜 Preload:', preloadPath);
    debugLog('📄 Index:', indexPath);
    
    if (!fs.existsSync(preloadPath)) {
        debugLog('❌ Preload script introuvable:', preloadPath);
        app.quit();
        return;
    }
    
    if (!fs.existsSync(indexPath)) {
        debugLog('❌ Index HTML introuvable:', indexPath);
        app.quit();
        return;
    }
    
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath,
            sandbox: false
        }
    });

    mainWindow.loadFile(indexPath);
    
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
        debugLog('🔧 DevTools ouverts');
    }
    
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        debugLog('❌ Erreur de chargement:', errorCode, errorDescription);
    });

    mainWindow.webContents.on('did-finish-load', () => {
        debugLog('✅ Chargement terminé');
    });
    
    mainWindow.webContents.on('dom-ready', () => {
        debugLog('📄 DOM ready');
    });

    mainWindow.webContents.on('console-message', (event, level, message) => {
        debugLog('💬 Console:', message);
    });
    
    debugLog('✅ Fenêtre principale créée');
}

function setupIPC() {
    debugLog('🔌 Configuration des événements IPC');

    // Test Echo synchrone
    ipcMain.handle('sync-test-echo', async (event, data) => {
        debugLog('📥 Test echo synchrone reçu:', data);
        
        if (!io) {
            debugLog('❌ Socket.IO non initialisé');
            return { error: 'Socket.IO non initialisé' };
        }

        try {
            debugLog('📤 Envoi echo au mobile via Socket.IO');
            
            // Créer une promesse pour attendre la réponse
            const response = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    debugLog('⏰ Timeout: pas de réponse du mobile');
                    reject(new Error('Timeout: pas de réponse du mobile'));
                }, 5000);

                io.once('mobile-echo-response', (response) => {
                    debugLog('📱 Réponse echo reçue du mobile:', response);
                    clearTimeout(timeout);
                    resolve(response);
                });

                // Envoyer l'écho au mobile
                io.emit('mobile-echo', data);
                debugLog('📤 Echo envoyé au mobile, attente de la réponse...');
            });

            return { success: true, data: response };
        } catch (error) {
            debugLog('❌ Erreur lors de l\'envoi de l\'echo:', error);
            return { error: error.message };
        }
    });

    // Récupération de l'état du mobile
    ipcMain.handle('get-mobile-status', async () => {
        debugLog('📱 Demande de l\'état du mobile');
        if (!io) {
            return { connected: false };
        }
        
        // Vérifier si un client mobile est connecté
        const sockets = await io.fetchSockets();
        const mobileSocket = sockets.find(socket => socket.handshake.query.clientType === 'mobile');
        
        return { connected: !!mobileSocket };
    });

    // Configuration du mapping
    ipcMain.handle('open-mapping-dialog', async () => {
        debugLog('📂 Ouverture dialogue mapping');
        if (!isWindowValid()) return { error: 'Fenêtre non valide' };

        try {
            const result = await dialog.showOpenDialog(mainWindow, {
                properties: ['openDirectory', 'multiSelections'],
                title: 'Sélectionner les dossiers à synchroniser'
            });

            if (!result.canceled) {
                debugLog('📂 Dossiers sélectionnés:', result.filePaths);
                return { success: true, paths: result.filePaths };
            }
            return { canceled: true };
        } catch (error) {
            debugLog('❌ Erreur dialogue mapping:', error);
            return { error: error.message };
        }
    });

    // Configuration des paramètres
    ipcMain.handle('open-settings-dialog', async () => {
        debugLog('⚙️ Ouverture dialogue paramètres');
        if (!isWindowValid()) return { error: 'Fenêtre non valide' };

        try {
            const result = await dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Paramètres',
                message: 'Configuration de Cp2Pc',
                detail: 'Choisissez une option :',
                buttons: [
                    'Nombre max de fichiers',
                    'Langue',
                    'Annuler'
                ],
                cancelId: 2
            });

            if (result.response === 2) {
                return { canceled: true };
            }

            switch (result.response) {
                case 0: // Nombre max de fichiers
                    const maxFilesResult = await dialog.showMessageBox(mainWindow, {
                        type: 'question',
                        title: 'Nombre max de fichiers',
                        message: 'Choisissez le nombre maximum de fichiers à synchroniser :',
                        detail: 'Valeur actuelle : 1000',
                        buttons: ['100', '500', '1000', '5000', 'Illimité', 'Annuler'],
                        defaultId: 2,
                        cancelId: 5
                    });

                    if (maxFilesResult.response === 5) {
                        return { canceled: true };
                    }

                    const maxFilesValues = [100, 500, 1000, 5000, -1];
                    const maxFiles = maxFilesValues[maxFilesResult.response];
                    
                    return { 
                        success: true, 
                        setting: 'maxFiles', 
                        value: maxFiles,
                        saveToStorage: true 
                    };

                case 1: // Langue
                    const langResult = await dialog.showMessageBox(mainWindow, {
                        type: 'question',
                        title: 'Langue',
                        message: 'Choisissez la langue :',
                        buttons: ['Français', 'English', 'Annuler'],
                        defaultId: 0,
                        cancelId: 2
                    });

                    if (langResult.response === 2) {
                        return { canceled: true };
                    }

                    const languages = ['fr', 'en'];
                    const lang = languages[langResult.response];
                    
                    return { 
                        success: true, 
                        setting: 'language', 
                        value: lang,
                        saveToStorage: true 
                    };
            }

            return { canceled: true };
        } catch (error) {
            debugLog('❌ Erreur dialogue paramètres:', error);
            return { error: error.message };
        }
    });

    // Gestion de la navigation des dossiers mobiles
    ipcMain.on('browse-mobile-folder', async (event, { mappingId }) => {
        debugLog('📱 Demande de navigation mobile reçue pour le mapping:', mappingId);
        
        if (!io) return;

        if (!isWindowValid()) return;

        try {
            io.emit('list-mobile-folders', { mappingId });
            debugLog('📤 Événement list-mobile-folders envoyé');

            io.once('mobile-folders-list', (data) => {
                if (!data) {
                    debugLog('❌ Aucune donnée reçue pour mobile-folders-list');
                    return;
                }
                debugLog('📂 Données reçues pour mobile-folders-list:', data);
                
                if (isWindowValid()) {
                    mainWindow.webContents.send('show-mobile-folders', data);
                }
            });
        } catch (error) {
            debugLog('❌ Erreur lors de la navigation mobile:', error);
        }
    });

    debugLog('✅ Événements IPC configurés');
}

// Service de découverte réseau
function setupDiscoveryService(port) {
    debugLog('🔍 Configuration du service de découverte');
    
    // Obtenir toutes les adresses IP locales
    const nets = networkInterfaces();
    const results = [];
    
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Ignorer les adresses non IPv4 et loopback
            if (net.family === 'IPv4' && !net.internal) {
                results.push(net.address);
            }
        }
    }
    
    debugLog('🌐 Adresses IP locales:', results);
    
    // Stocker les informations de découverte
    const discoveryInfo = {
        serverPort: port,
        addresses: results,
        timestamp: new Date().toISOString()
    };
    
    // Répondre aux requêtes de découverte
    if (io) {
        io.on('discovery-request', (socket) => {
            debugLog('🔍 Requête de découverte reçue');
            socket.emit('discovery-response', discoveryInfo);
        });
    }
    
    debugLog('✅ Service de découverte configuré');
}

// Configuration du serveur Express et Socket.IO
function setupServer() {
    const app = express();
    app.use(express.static(PUBLIC_DIR));
    
    server = http.createServer(app);
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        const clientType = socket.handshake.query.clientType;
        debugLog('🔌 Nouvelle connexion Socket.IO:', { clientType });

        // Si c'est un client mobile
        if (clientType === 'mobile') {
            debugLog('📱 Client mobile connecté');
            // Notifier tous les clients de la connexion mobile
            io.emit('mobile-status', { connected: true });
        }
        
        socket.on('disconnect', () => {
            debugLog('🔌 Déconnexion Socket.IO:', { clientType });
            
            // Si c'était un client mobile
            if (clientType === 'mobile') {
                debugLog('📱 Client mobile déconnecté');
                // Notifier tous les clients de la déconnexion mobile
                io.emit('mobile-status', { connected: false });
            }
        });

        // Gestion des erreurs de socket
        socket.on('error', (error) => {
            debugLog('❌ Erreur Socket.IO:', error);
            // Si c'était un client mobile, notifier la déconnexion
            if (clientType === 'mobile') {
                io.emit('mobile-status', { connected: false });
            }
        });

        // Echo mobile
        socket.on('mobile-echo-response', (data) => {
            debugLog('📱 Réponse echo reçue du mobile:', data);
        });

        // Liste des dossiers mobiles
        socket.on('mobile-folders-list', (data) => {
            debugLog('📂 Liste des dossiers mobiles reçue:', data);
            if (isWindowValid()) {
                mainWindow.webContents.send('show-mobile-folders', data);
            }
        });
    });

    const port = 3000;
    server.listen(port, () => {
        console.log('info: Serveur démarré sur le port %d', port, {
            timestamp: new Date().toISOString()
        });
    });

    // Gestion des erreurs du serveur
    server.on('error', (error) => {
        debugLog('❌ Erreur serveur:', error);
    });

    // Service de découverte
    setupDiscoveryService(port);

    debugLog('🔧 Serveur configuré, Socket.IO initialisé:', !!io);
}

// Gestion des erreurs globales
process.on('uncaughtException', (error) => {
    debugLog('❌ Erreur non gérée:', error);
});

process.on('unhandledRejection', (error) => {
    debugLog('❌ Promise rejetée non gérée:', error);
});

app.whenReady().then(async () => {
    debugLog('🎬 Application prête');
    
    // Configuration des événements IPC avant la création de la fenêtre
    setupIPC();
    debugLog('🔌 IPC configuré');
    
    setupServer();
    debugLog('🔌 Serveur configuré, Socket.IO initialisé:', !!io);
    
    createWindow();
});

app.on('window-all-closed', () => {
    debugLog('🚪 Toutes les fenêtres fermées');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    debugLog('🔄 Activation de l\'application');
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
