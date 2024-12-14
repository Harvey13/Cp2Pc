const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const bonjour = require('bonjour')();
const { processFileTransfer } = require('./fileProcessor');
const { ServiceDiscovery } = require('./discovery');
const { log } = require('./logger');
const config = require('./config');
const fileProcessor = require('./fileProcessor');

let io;
let connectedMobileClients = new Set();

async function listFiles(directoryPath) {
    try {
        const files = await fs.readdir(directoryPath);
        const filesList = await Promise.all(files.map(async (file) => {
            const fullPath = path.join(directoryPath, file);
            const stats = await fs.stat(fullPath);
            return {
                name: file,
                isDirectory: stats.isDirectory(),
                size: stats.size,
                modifiedTime: stats.mtime
            };
        }));
        return filesList.sort((a, b) => {
            // Dossiers d'abord, puis fichiers
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
    } catch (error) {
        log('ERROR', 'Error listing files:', error);
        throw error;
    }
}

async function prepareDestinationFolder(mapping, maxFiles) {
    if (!mapping.sourcePath || !mapping.destPath) {
        throw new Error('Les chemins source et destination sont requis');
    }

    log('INFO', `📂 Vérification du dossier source: ${mapping.sourcePath}`);
    try {
        await fs.access(mapping.sourcePath);
    } catch (error) {
        throw new Error(`Le dossier source n'existe pas: ${mapping.sourcePath}`);
    }

    log('INFO', `📂 Vérification du dossier destination: ${mapping.destPath} (max: ${maxFiles} fichiers)`);
    try {
        await fs.access(mapping.destPath);
        const files = await fs.readdir(mapping.destPath);
        log('INFO', `📊 Nombre de fichiers dans ${mapping.destPath}: ${files.length}/${maxFiles}`);
        
        if (files.length >= maxFiles) {
            let index = 1;
            let newPath;
            do {
                newPath = `${mapping.destPath}_${String(index).padStart(2, '0')}`;
                index++;
            } while (await fs.access(newPath).then(() => true).catch(() => false));

            await fs.mkdir(newPath);
            log('INFO', `📁 Nouveau dossier créé: ${newPath}`);
            
            const oldPath = mapping.destPath;
            mapping.destPath = newPath;
            return { created: true, oldPath, newPath };
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(mapping.destPath, { recursive: true });
            log('INFO', `📁 Création du dossier: ${mapping.destPath}`);
        } else {
            throw error;
        }
    }

    return { created: false, path: mapping.destPath };
}

function setupServer() {
    const app = express();
    const server = http.createServer(app);

    // Servir les fichiers statiques
    app.use(express.static(path.join(__dirname, '../public')));
    app.use('/socket.io', express.static(path.join(__dirname, '../../node_modules/socket.io/client-dist')));

    // Configurer CORS pour Express
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        next();
    });

    // Middleware pour gérer les erreurs CORS préflight
    app.options('*', (req, res) => {
        res.status(200).end();
    });

    // Point de terminaison de découverte
    app.get('/api/discover', (req, res) => {
        const networkInterfaces = Object.values(require('os').networkInterfaces())
            .flat()
            .filter(({ family, internal }) => family === 'IPv4' && !internal)
            .map(({ address, netmask }) => ({ address, netmask }));

        res.json({
            service: 'cp2pc',
            version: '1.0.0',
            name: 'Cp2Pc Server',
            network: {
                interfaces: networkInterfaces
            }
        });
    });

    // Configuration de multer pour le stockage des fichiers
    const storage = multer.diskStorage({
        destination: async (req, file, cb) => {
            const { mappingId } = req.body;
            const mapping = global.mappings.find(m => m.id === mappingId);
            if (!mapping) {
                cb(new Error('Mapping non trouvé'));
                return;
            }
            cb(null, mapping.destPath);
        },
        filename: (req, file, cb) => {
            cb(null, file.originalname);
        }
    });

    const upload = multer({ storage });

    // Middleware pour parser le JSON
    app.use(express.json());

    // Route pour obtenir les mappings disponibles
    app.get('/mappings', (req, res) => {
        res.json(global.mappings || []);
    });

    // Route pour le téléchargement de fichiers
    app.post('/upload', upload.single('file'), async (req, res) => {
        try {
            const { mappingId } = req.body;
            const mapping = global.mappings.find(m => m.id === mappingId);
            
            if (!mapping) {
                throw new Error('Mapping non trouvé');
            }

            const fileInfo = {
                originalname: req.file.originalname,
                size: req.file.size,
                path: req.file.path,
                mappingId
            };

            await processFileTransfer(fileInfo, mapping);
            
            log('INFO', `Fichier téléchargé avec succès: ${req.file.originalname}`, {
                mappingId,
                size: req.file.size
            });

            res.json({ success: true });
        } catch (error) {
            log('ERROR', `Erreur lors du téléchargement: ${error.message}`);
            res.status(500).json({ error: error.message });
        }
    });

    // Démarrer le serveur
    const port = process.env.PORT || 3000;
    server.listen(port, () => {
        log('SERVER', `Server listening on port ${port}`);
        
        // Publier le service Bonjour
        const service = bonjour.publish({
            name: 'Cp2Pc Server',
            type: 'cp2pc',
            port: port,
            protocol: 'tcp'
        });

        // Démarrer le service de découverte
        const discoveryService = new ServiceDiscovery(port);
        discoveryService.start();

        // Nettoyer les services à la fermeture
        process.on('SIGINT', () => {
            service.stop();
            bonjour.destroy();
            discoveryService.stop();
            process.exit();
        });
    });

    return server;
}

function setupSocketIO(server) {
    // Configuration de Socket.IO avec gestion des erreurs
    io = socketIO(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            credentials: false,
            allowedHeaders: ["Content-Type"]
        },
        path: '/socket.io/',
        serveClient: true,
        pingTimeout: 10000,
        pingInterval: 5000,
        transports: ['websocket', 'polling'],
        allowEIO3: true
    });

    global.io = io;

    // Gestion des événements Socket.IO
    io.on('connection', (socket) => {
        log('INFO', 'Nouvelle connexion Socket.IO:', socket.id);
        
        socket.on('connect', () => {
            log('INFO', 'Nouveau client connecté');
            socket.emit('welcome', { message: 'Bienvenue!' });
        });

        socket.on('disconnect', () => {
            log('INFO', 'Client déconnecté');
            connectedMobileClients.delete(socket.id);
            updateMobileStatus();
        });

        socket.on('mobile-connected', (data) => {
            log('INFO', 'Mobile connecté:', data);
            connectedMobileClients.add(socket.id);
            io.emit('mobile-status-update', { connected: true });
        });

        socket.on('error', (error) => {
            log('ERROR', 'Erreur Socket.IO:', error);
        });

        // Gestion des échos mobiles
        socket.on('mobile-echo', (data) => {
            log('INFO', 'Echo reçu du mobile:', data);
            io.emit('echo-response', { success: true, data });
        });

        // Debug - Echo
        socket.on('mobile-echo-response', (data) => {
            log('INFO', 'Echo reçu du mobile:', data);
            io.emit('mobile-echo-response', data);
        });

        socket.on('start-copy', async (data, callback) => {
            try {
                log('INFO', '📥 Début de start-copy avec les données:', JSON.stringify(data));
                // Extraire les mappings de la configuration
                const mappings = data.mappings || [];
                const maxFiles = data.maxFiles || config.MAX_FILES_PER_FOLDER;

                log('INFO', `📊 Configuration - maxFiles: ${maxFiles}, nombre de mappings: ${mappings.length}`);

                if (typeof callback === 'function') {
                    log('INFO', '✅ Envoi de l\'accusé de réception au client');
                    callback({ 
                        status: 'acknowledged',
                        mappings: mappings
                    });
                } else {
                    log('WARN', '⚠️ Pas de callback fourni pour l\'accusé de réception');
                }

                log('INFO', `📝 Traitement de ${mappings.length} mapping(s)`);
                for (const mapping of mappings) {
                    try {
                        log('INFO', `📂 Démarrage du mapping ${mapping.id} - Source: ${mapping.sourcePath}, Destination: ${mapping.destPath}`);
                        
                        // Préparer le dossier destination avec la limite de fichiers configurée
                        log('INFO', '🔍 Préparation du dossier destination...');
                        const result = await prepareDestinationFolder(mapping, maxFiles);
                        if (result.created) {
                            log('INFO', `📁 Nouveau dossier créé: ${result.newPath} (ancien: ${result.oldPath})`);
                            socket.emit('mapping-updated', { 
                                mappingId: mapping.id,
                                oldPath: result.oldPath,
                                newPath: result.newPath
                            });
                        } else {
                            log('INFO', `📁 Utilisation du dossier existant: ${result.path}`);
                        }

                        log('INFO', '🚀 Lancement du processus de mapping...');
                        await processMapping(mapping, socket);
                        log('INFO', `✅ Mapping ${mapping.id} terminé avec succès`);
                    } catch (error) {
                        log('ERROR', `❌ Erreur lors du traitement du mapping ${mapping.id}: ${error.message}`, {
                            error: error.stack,
                            mapping: mapping
                        });
                        socket.emit('copy-error', { 
                            error: error.message,
                            mappingId: mapping.id
                        });
                    }
                }
            } catch (error) {
                log('ERROR', '❌ Erreur lors du traitement des mappings:', error);
                socket.emit('copy-error', { error: error.message });
            }
        });

        socket.on('get-logs', () => {
            const { getLogHistory } = require('./logger');
            socket.emit('logs-history', getLogHistory());
        });

        socket.on('list-files', async ({ path: requestedPath }) => {
            try {
                // Utiliser le chemin racine du projet comme base
                const basePath = process.cwd();
                const fullPath = path.join(basePath, requestedPath || '');
                
                // Vérifier que le chemin est bien sous le chemin racine
                if (!fullPath.startsWith(basePath)) {
                    throw new Error('Chemin non autorisé');
                }

                const files = await listFiles(fullPath);
                socket.emit('files-list', files);
            } catch (error) {
                log('ERROR', 'Error listing files:', error);
                socket.emit('error', { message: 'Erreur lors de la lecture des fichiers' });
            }
        });
    });

    // Gestion des erreurs Socket.IO au niveau serveur
    io.engine.on('connection_error', (err) => {
        log('ERROR', 'Erreur de connexion Socket.IO:', err);
    });

    return io;
}

async function processMapping(mapping, socket) {
    try {
        await fileProcessor.processMapping({
            mapping,
            onProgress: (progress) => {
                if (progress.status === 'starting') {
                    socket.emit('copy-start', { mappingId: mapping.id });
                } else if (progress.status === 'copying') {
                    socket.emit('copy-progress', {
                        file: progress.file.file,
                        status: progress.file.status,
                        mappingId: mapping.id,
                        current: progress.current,
                        total: progress.total
                    });
                }
            },
            onComplete: (result) => {
                socket.emit('copy-complete', {
                    mappingId: mapping.id,
                    processed: result.processed,
                    copied: result.copied,
                    total: result.total
                });
            }
        });
        return true;
    } catch (error) {
        log('ERROR', `❌ Erreur lors du traitement du mapping: ${error.message}`);
        socket.emit('copy-error', { mappingId: mapping.id, error: error.message });
        return false;
    }
}

function updateMobileStatus() {
    const isConnected = connectedMobileClients.size > 0;
    io.emit('mobile-status', isConnected);
}

function getIO() {
    return io;
}

module.exports = {
    setupServer,
    setupSocketIO,
    getIO
};
