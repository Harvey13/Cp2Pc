const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const bonjour = require('bonjour')();
const { log } = require('./logger');
const { processFileTransfer } = require('./fileProcessor');
const { ServiceDiscovery } = require('./discovery');

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
        console.error('Error listing files:', error);
        throw error;
    }
}

function setupServer() {
    const app = express();
    const server = http.createServer(app);

    // Configuration de Socket.IO avec gestion des erreurs
    io = socketIO(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        serveClient: true,
        pingTimeout: 10000,
        pingInterval: 5000
    });

    global.io = io;

    // Servir les fichiers statiques
    app.use(express.static(path.join(__dirname, '../public')));
    app.use('/socket.io', express.static(path.join(__dirname, '../../node_modules/socket.io/client-dist')));

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

    // Gestion des événements Socket.IO
    io.on('connection', (socket) => {
        log(' Nouvelle connexion Socket.IO:', socket.id);
        
        socket.on('mobile-connected', (data) => {
            log(' Mobile connecté:', data);
            connectedMobileClients.add(socket.id);
            io.emit('mobile-status-update', { connected: true });
        });

        socket.on('disconnect', () => {
            log(' Déconnexion Socket.IO:', socket.id);
            connectedMobileClients.delete(socket.id);
            io.emit('mobile-status-update', { connected: connectedMobileClients.size > 0 });
        });

        socket.on('error', (error) => {
            log(' Erreur Socket.IO:', error);
        });

        // Gestion des échos mobiles
        socket.on('mobile-echo', (data) => {
            log(' Echo reçu du mobile:', data);
            io.emit('echo-response', { success: true, data });
        });

        // Debug - Echo
        socket.on('mobile-echo-response', (data) => {
            console.log(' Echo reçu du mobile:', data);
            io.emit('mobile-echo-response', data);
        });

        socket.on('start-copy', async (config) => {
            try {
                global.mappings = config.mappings;
                log('info', 'Démarrage de la copie de fichiers', { config });
                
                for (const mapping of config.mappings) {
                    await processMapping(mapping, config.maxFiles);
                }
            } catch (error) {
                log('error', `Erreur lors de la copie: ${error.message}`);
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
                console.error('Error listing files:', error);
                socket.emit('error', { message: 'Erreur lors de la lecture des fichiers' });
            }
        });
    });

    // Gestion des erreurs Socket.IO au niveau serveur
    io.engine.on('connection_error', (err) => {
        log(' Erreur de connexion Socket.IO:', err);
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
            cb(null, mapping.destFolder);
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
            
            log('info', `Fichier téléchargé avec succès: ${req.file.originalname}`, {
                mappingId,
                size: req.file.size
            });

            res.json({ success: true });
        } catch (error) {
            log('error', `Erreur lors du téléchargement: ${error.message}`);
            res.status(500).json({ error: error.message });
        }
    });

    // Démarrer le serveur
    const port = process.env.PORT || 3000;
    server.listen(port, () => {
        log('info', `Serveur démarré sur le port ${port}`);
        
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

async function processMapping(mapping, maxFiles) {
    try {
        const files = await fs.readdir(mapping.sourceFolder);
        const totalFiles = Math.min(files.length, maxFiles);
        let processedFiles = 0;

        for (const file of files) {
            if (processedFiles >= maxFiles) break;

            const sourcePath = path.join(mapping.sourceFolder, file);
            const destPath = path.join(mapping.destFolder, file);

            try {
                await fs.copyFile(sourcePath, destPath);
                processedFiles++;
                
                const progress = Math.round((processedFiles / totalFiles) * 100);
                io.emit('copy-progress', {
                    mappingId: mapping.id,
                    progress
                });

                log('info', `Fichier copié: ${file}`, {
                    mappingId: mapping.id,
                    progress
                });
            } catch (error) {
                log('error', `Erreur lors de la copie du fichier ${file}: ${error.message}`);
            }
        }
    } catch (error) {
        log('error', `Erreur lors du traitement du mapping: ${error.message}`, {
            mappingId: mapping.id
        });
    }
}

function updateMobileStatus() {
    const isConnected = connectedMobileClients.size > 0;
    io.emit('mobile-status', isConnected);
}

module.exports = {
    setupServer,
    getIO: () => io
};
