const fs = require('fs');
const path = require('path');
const { log } = require('./logger');
const config = require('./config');

class SyncManager {
    constructor() {
        this.status = 'disconnected'; // disconnected, connected, syncing
    }

    getNextFolderIndex(baseDir) {
        let index = 1;
        while (true) {
            const folderName = `Photo_${String(index).padStart(2, '0')}`;
            const folderPath = path.join(baseDir, folderName);
            if (!fs.existsSync(folderPath)) {
                return index;
            }
            index++;
        }
    }

    async copyFiles(sourcePath, destinationBase) {
        try {
            // Vérifier si le dossier de destination existe
            if (!fs.existsSync(destinationBase)) {
                fs.mkdirSync(destinationBase, { recursive: true });
            }

            // Trouver ou créer le dossier de destination approprié
            let currentDestFolder = path.join(destinationBase, 'Photo_01');
            let fileCount = 0;

            if (fs.existsSync(currentDestFolder)) {
                fileCount = fs.readdirSync(currentDestFolder).length;
                if (fileCount >= config.maxFilesPerFolder) {
                    const nextIndex = this.getNextFolderIndex(destinationBase);
                    currentDestFolder = path.join(destinationBase, `Photo_${String(nextIndex).padStart(2, '0')}`);
                    fs.mkdirSync(currentDestFolder);
                    fileCount = 0;
                }
            } else {
                fs.mkdirSync(currentDestFolder);
            }

            // Copier les fichiers
            const files = fs.readdirSync(sourcePath);
            for (const file of files) {
                const sourceFile = path.join(sourcePath, file);
                const destFile = path.join(currentDestFolder, file);
                
                if (fs.existsSync(destFile)) {
                    log('warn', `File already exists: ${file}`);
                    continue;
                }

                fs.copyFileSync(sourceFile, destFile);
                log('info', `Copied file: ${file}`);

                fileCount++;
                if (fileCount >= config.maxFilesPerFolder) {
                    const nextIndex = this.getNextFolderIndex(destinationBase);
                    currentDestFolder = path.join(destinationBase, `Photo_${String(nextIndex).padStart(2, '0')}`);
                    fs.mkdirSync(currentDestFolder);
                    fileCount = 0;
                }
            }

            return true;
        } catch (error) {
            log('error', 'Error copying files', { error: error.message });
            return false;
        }
    }
}

module.exports = new SyncManager();
