// Système de logging avec encodage UTF-8
const log = require('./utils/logger');
const os = require('os');

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: ["http://localhost:3000", "file://"],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 10000,  // 10 secondes de timeout
    pingInterval: 5000,  // ping toutes les 5 secondes
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
});
const path = require('path');
const { dialog, ipcMain } = require('electron');
const webdav = require('webdav-server').v2;
const cors = require('cors');

log.info('🚀 Démarrage du serveur...');

// Obtenir le nom du PC
const getComputerName = () => {
    try {
        return os.hostname();
    } catch (error) {
        log.error('Erreur lors de la récupération du nom du PC:', error);
        return 'PC Inconnu';
    }
};

// Obtenir toutes les interfaces réseau IPv4 non-internes
function getNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    const validInterfaces = [];
    
    for (const [name, nets] of Object.entries(interfaces)) {
        for (const net of nets) {
            // Uniquement les interfaces IPv4, non-internes, et actives
            if (net.family === 'IPv4' && !net.internal) {
                validInterfaces.push({
                    name,
                    address: net.address,
                    netmask: net.netmask,
                    cidr: net.cidr
                });
            }
        }
    }
    
    return validInterfaces;
}

// Configuration du serveur WebDAV
const webdavServer = new webdav.WebDAVServer({
    port: 1900
});
webdavServer.start();
log.info('📂 Serveur WebDAV démarré sur le port 1900');

// Variables globales
let mappings = [];
let mobileConnected = false;
let mainWindow;
let mobileSocket = null;  // Pour stocker la référence au socket mobile
let webSocket = null;  // Pour stocker la référence au socket web

// Configuration CORS
app.use(cors());

// Route de découverte avec informations réseau
app.get('/api/discover', (req, res) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    log.debug('🔍 Requête de découverte reçue de:', clientIp);
    
    const networkInterfaces = getNetworkInterfaces();
    const computerName = getComputerName();
    
    res.json({
        service: 'cp2pc',
        version: '1.0.0',
        features: ['file-sync', 'mobile-connect'],
        computerName,
        network: {
            interfaces: networkInterfaces,
            clientIp: clientIp
        }
    });
});

// Routes statiques
app.use(express.static(path.join(__dirname, 'public')));
log.debug('Dossier statique configuré:', path.join(__dirname, 'public'));

// Configuration des clients
const clients = {
    desktop: new Set(),
    mobile: new Set()
};

// Middleware pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Middleware pour parser le JSON
app.use(express.json());

// Route pour obtenir la configuration actuelle
app.get('/api/config', (req, res) => {
    res.json({
        maxFiles: 100,
        language: 'fr'
    });
});

// Route pour mettre à jour la configuration
app.post('/api/config', (req, res) => {
    try {
        const newConfig = req.body;
        if (newConfig) {
            // Notifier tous les clients du changement
            io.emit('config-updated', newConfig);
            res.json({ success: true, config: newConfig });
        } else {
            res.status(400).json({ success: false, error: 'Invalid configuration' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Gestionnaire de Socket.IO
io.on('connection', (socket) => {
    console.log('Nouvelle connexion:', socket.id);

    // Identification du type de client
    socket.on('register', (clientType) => {
        if (clientType === 'mobile') {
            clients.mobile.add(socket.id);
            broadcastMobileStatus(true);
            console.log('Client mobile enregistré:', socket.id);
        } else if (clientType === 'desktop') {
            clients.desktop.add(socket.id);
            // Envoyer l'état actuel de la connexion mobile
            socket.emit('mobile-status-update', {
                connected: clients.mobile.size > 0
            });
            console.log('Client desktop enregistré:', socket.id);
        }
    });

    // Gestion de la déconnexion
    socket.on('disconnect', () => {
        console.log('Client déconnecté:', socket.id);
        
        if (clients.mobile.has(socket.id)) {
            clients.mobile.delete(socket.id);
            broadcastMobileStatus(false);
            console.log('Client mobile déconnecté:', socket.id);
        }
        
        if (clients.desktop.has(socket.id)) {
            clients.desktop.delete(socket.id);
            console.log('Client desktop déconnecté:', socket.id);
        }
    });

    const clientIp = socket.handshake.address;
    log.info('🔌 Nouvelle connexion socket:', {
        id: socket.id,
        address: clientIp
    });

    // Envoyer l'état initial et les interfaces réseau
    socket.emit('mobile-status', { 
        connected: mobileConnected,
        computerName: getComputerName(),
        network: getNetworkInterfaces()
    });
    socket.emit('init-mappings', mappings);
    log.debug('📤 État initial envoyé');

    // Gestion de la connexion mobile
    socket.on('mobile-connect', (deviceInfo) => {
        console.log('[Server] New mobile connection from', socket.handshake.address, `(${deviceInfo.deviceName})`);
        socket.isMobile = true;
        socket.deviceInfo = deviceInfo;
        mobileSocket = socket;

        // Informer tous les clients web que le mobile est connecté
        io.emit('mobile-status', {
            connected: true,
            deviceInfo: deviceInfo
        });

        // Notifier l'interface Electron si elle existe
        if (mainWindow) {
            mainWindow.webContents.send('mobile-status', {
                connected: true,
                deviceInfo: deviceInfo
            });
        }

        // Écouter la déconnexion
        socket.on('disconnect', () => {
            console.log('[Server] Mobile disconnected');
            mobileSocket = null;

            // Informer tous les clients web que le mobile est déconnecté
            io.emit('mobile-status', {
                connected: false,
                deviceInfo: null
            });

            if (mainWindow) {
                mainWindow.webContents.send('mobile-status', {
                    connected: false,
                    deviceInfo: null
                });
            }
        });
    });

    // Gestion de la connexion web
    socket.on('web-connect', () => {
        console.log('[Server] New web connection from', socket.handshake.address);
        socket.isWeb = true;
        webSocket = socket;

        // Envoyer l'état actuel de la connexion mobile
        socket.emit('mobile-status', {
            connected: mobileSocket !== null,
            deviceInfo: mobileSocket?.deviceInfo || null
        });
    });

    // Gestion des mappings
    socket.on('add-mapping', (mapping) => {
        log.debug('Nouveau mapping:', mapping);
        mappings.push(mapping);
        io.emit('mapping-added', mapping);
    });

    socket.on('update-mapping', (mapping) => {
        log.debug('Mise à jour mapping:', mapping);
        const index = mappings.findIndex(m => m.id === mapping.id);
        if (index !== -1) {
            mappings[index] = mapping;
            io.emit('mapping-updated', mapping);
        }
    });

    socket.on('delete-mapping', (id) => {
        log.debug('Suppression mapping:', id);
        mappings = mappings.filter(m => m.id !== id);
        io.emit('mapping-deleted', id);
    });

    socket.on('browse-folder', async ({ mappingId, type }) => {
        log.debug('Sélection dossier:', { mappingId, type });
        try {
            if (type === 'pc') {
                const result = await dialog.showOpenDialog({
                    properties: ['openDirectory']
                });
                if (!result.canceled) {
                    socket.emit('folder-selected', {
                        mappingId,
                        type,
                        path: result.filePaths[0]
                    });
                }
            } else if (type === 'mobile') {
                log.debug('🔍 Demande de liste des dossiers mobiles pour:', mappingId);
                // Envoyer la demande à tous les clients (y compris mobile)
                io.emit('request-mobile-folders', { mappingId });
            }
        } catch (error) {
            log.error('Erreur lors de la sélection du dossier:', error);
        }
    });

    // Réception de la liste des dossiers mobiles
    socket.on('mobile-folders-list', (data) => {
        log.debug('📂 Liste des dossiers mobiles reçue:', data);
        if (mainWindow) {
            mainWindow.webContents.send('show-mobile-folders', {
                mappingId: data.mappingId,
                folders: data.folders
            });
            log.debug('📤 Liste des dossiers envoyée à l\'interface');
        }
    });

    // Confirmation de la sélection d'un dossier mobile
    socket.on('mobile-folder-selected', (data) => {
        log.debug('Confirmation de sélection du dossier mobile:', data);
        // Envoyer la confirmation à l'interface Electron
        if (mainWindow) {
            mainWindow.webContents.send('folder-selected', {
                mappingId: data.mappingId,
                type: 'mobile',
                path: data.path
            });
        }
    });

    // Erreur lors de la sélection d'un dossier mobile
    socket.on('mobile-folder-error', (data) => {
        log.error('Erreur lors de la sélection du dossier mobile:', data.error);
        if (mainWindow) {
            mainWindow.webContents.send('folder-error', {
                mappingId: data.mappingId,
                error: data.error
            });
        }
    });

    socket.on('disconnect', () => {
        if (socket.interval) {
            clearInterval(socket.interval);
        }

        if (socket.isMobile) {
            log.info('📱 Mobile déconnecté:', socket.id);
            if (mobileSocket && mobileSocket.id === socket.id) {
                log.debug('📱 Suppression de la référence au socket mobile:', socket.id);
                mobileSocket = null;
            }
            mobileConnected = false;
            io.emit('mobile-status', { connected: false });
            if (mainWindow) {
                mainWindow.webContents.send('mobile-status', { connected: false });
            }

            // Redémarrer automatiquement le scan après 3 secondes
            setTimeout(() => {
                log.debug('🔄 Redémarrage automatique du scan');
                io.emit('restart-scan');
            }, 3000);
        }
    });

    socket.on('error', (error) => {
        log.error('❌ Erreur socket:', error);
        if (socket.isMobile) {
            log.error('❌ Erreur sur le socket mobile:', socket.id);
            if (mobileSocket && mobileSocket.id === socket.id) {
                mobileSocket = null;
            }
            mobileConnected = false;
            io.emit('mobile-status', { connected: false });
            if (mainWindow) {
                mainWindow.webContents.send('mobile-status', { connected: false });
            }

            // Redémarrer automatiquement le scan après 3 secondes
            setTimeout(() => {
                log.debug('🔄 Redémarrage automatique du scan');
                io.emit('restart-scan');
            }, 3000);
        }
    });

    // Gestion du keep-alive
    socket.on('keep-alive-response', () => {
        if (socket.isMobile) {
            log.debug('Keep-alive reçu du mobile');
        }
    });
});

// Fonction pour diffuser l'état de connexion mobile
function broadcastMobileStatus(connected) {
    // Envoyer l'état aux clients desktop
    for (let desktopId of clients.desktop) {
        io.to(desktopId).emit('mobile-status-update', { connected });
    }
}

// Configuration par défaut
const config = {
    maxFiles: 100,
    language: 'fr'
};

// Mettre à jour la configuration
function updateConfig(newConfig) {
    Object.assign(config, newConfig);
    log.info('Configuration mise à jour:', config);
    
    // Notifier tous les clients connectés
    io.emit('config-updated', {
        maxFiles: config.maxFiles,
        language: config.language
    });
}

// Configuration des événements IPC
function setupIPC(mainWindow) {
    // Vérification de l'état mobile
    ipcMain.on('check-mobile-status', (event) => {
        log.debug('📱 Vérification de l\'état mobile');
        event.reply('mobile-status', { connected: mobileConnected });
    });

    // Sélection de dossier PC
    ipcMain.handle('select-folder', async () => {
        log.debug('📂 Ouverture du sélecteur de dossier PC');
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        });
        return result.filePaths[0];
    });

    // Envoi des événements mobiles
    ipcMain.on('browse-mobile-folder', (event, data) => {
        log.debug('📱 Demande de navigation dans les dossiers mobiles:', data);
        log.debug('📱 État du socket mobile:', mobileSocket ? mobileSocket.id : 'non connecté');
        
        if (mobileSocket && mobileSocket.connected) {
            log.debug('📤 Envoi de la demande au mobile via socket:', mobileSocket.id);
            mobileSocket.emit('request-mobile-folders', data);
        } else {
            log.error('❌ Impossible d\'envoyer la demande : mobile non connecté ou socket invalide');
            mainWindow.webContents.send('folder-error', {
                mappingId: data.mappingId,
                error: 'Mobile non connecté'
            });
        }
    });

    // Sélection d'un dossier mobile
    ipcMain.on('select-mobile-folder', (event, data) => {
        log.debug('📱 Sélection d\'un dossier mobile:', data);
        log.debug('📱 État du socket mobile:', mobileSocket ? mobileSocket.id : 'non connecté');
        
        if (mobileSocket && mobileSocket.connected) {
            log.debug('📤 Envoi de la sélection au mobile via socket:', mobileSocket.id);
            mobileSocket.emit('select-mobile-folder', data);
        } else {
            log.error('❌ Impossible d\'envoyer la sélection : mobile non connecté ou socket invalide');
            mainWindow.webContents.send('folder-error', {
                mappingId: data.mappingId,
                error: 'Mobile non connecté'
            });
        }
    });

    ipcMain.on('update-mappings', (event, newMappings) => {
        mappings = newMappings;
        if (mobileSocket) {
            mobileSocket.emit('update-mappings', mappings);
        }
    });

    ipcMain.on('get-mappings', (event) => {
        event.reply('mappings-updated', mappings);
    });
}

// Démarrage du serveur
function startServer(win) {
    mainWindow = win;
    setupIPC(win);
    
    const port = 3000;
    const host = '0.0.0.0';

    try {
        server.listen(port, host, () => {
            const computerName = getComputerName();
            log.info(`🌐 Serveur HTTP démarré sur ${host}:${port}`);
            log.info(`💻 Nom du PC: ${computerName}`);
            const interfaces = getNetworkInterfaces();
            log.info('📡 Interfaces réseau disponibles:', interfaces);
        });

        io.on('connection', (socket) => {
            log.info('🔌 Nouvelle connexion Socket.IO:', {
                id: socket.id,
                address: socket.handshake.address,
                query: socket.handshake.query
            });

            socket.on('error', (error) => {
                log.error('❌ Erreur Socket.IO:', error);
            });

            socket.on('disconnect', (reason) => {
                log.info('🔌 Déconnexion Socket.IO:', {
                    id: socket.id,
                    reason: reason
                });
            });
        });

        log.info('✅ Socket.IO initialisé et en écoute');
    } catch (error) {
        log.error('❌ Erreur au démarrage du serveur:', error);
    }
}

// Exposer les fonctions nécessaires
module.exports = { app, server, io, start: startServer, updateConfig: updateConfig };
