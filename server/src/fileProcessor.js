const fs = require('fs').promises;
const path = require('path');
const { log } = require('./logger');

async function processFileTransfer(fileInfo, mapping) {
    try {
        const stats = await fs.stat(fileInfo.path);
        const sourceTimestamp = stats.mtime;

        // Vérifier si le fichier existe déjà dans la destination
        const destPath = path.join(mapping.destFolder, fileInfo.originalname);
        try {
            const destStats = await fs.stat(destPath);
            const destTimestamp = destStats.mtime;

            // Si le fichier source est plus récent, on le copie
            if (sourceTimestamp > destTimestamp) {
                await fs.copyFile(fileInfo.path, destPath);
                log('info', `Fichier mis à jour: ${fileInfo.originalname}`, {
                    mappingId: mapping.id,
                    size: fileInfo.size
                });
            } else {
                log('info', `Fichier ignoré (plus récent existe déjà): ${fileInfo.originalname}`, {
                    mappingId: mapping.id
                });
            }
        } catch (error) {
            // Le fichier n'existe pas dans la destination, on le copie
            if (error.code === 'ENOENT') {
                await fs.copyFile(fileInfo.path, destPath);
                log('info', `Nouveau fichier copié: ${fileInfo.originalname}`, {
                    mappingId: mapping.id,
                    size: fileInfo.size
                });
            } else {
                throw error;
            }
        }

        // Organiser les fichiers si nécessaire
        await organizeFiles(mapping);

    } catch (error) {
        log('error', `Erreur lors du traitement du fichier: ${error.message}`, {
            file: fileInfo.originalname,
            mappingId: mapping.id
        });
        throw error;
    }
}

async function organizeFiles(mapping) {
    try {
        const files = await fs.readdir(mapping.destFolder);
        const prefix = path.basename(mapping.destFolder);

        // Trier les fichiers par date de modification
        const fileStats = await Promise.all(
            files.map(async (file) => {
                const filePath = path.join(mapping.destFolder, file);
                const stats = await fs.stat(filePath);
                return {
                    name: file,
                    path: filePath,
                    mtime: stats.mtime
                };
            })
        );

        fileStats.sort((a, b) => b.mtime - a.mtime);

        // Renommer les fichiers avec le préfixe et un index
        for (let i = 0; i < fileStats.length; i++) {
            const file = fileStats[i];
            const ext = path.extname(file.name);
            const newName = `${prefix}_${String(i + 1).padStart(3, '0')}${ext}`;
            const newPath = path.join(mapping.destFolder, newName);

            if (file.path !== newPath) {
                await fs.rename(file.path, newPath);
                log('info', `Fichier renommé: ${file.name} -> ${newName}`, {
                    mappingId: mapping.id
                });
            }
        }
    } catch (error) {
        log('error', `Erreur lors de l'organisation des fichiers: ${error.message}`, {
            mappingId: mapping.id
        });
    }
}

module.exports = {
    processFileTransfer
};
