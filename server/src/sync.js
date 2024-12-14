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

    async transferFiles(sourcePath, destinationBase) {
        log('info', '⚠️ Tentative d\'utilisation du SyncManager désactivé', {
            sourcePath,
            destinationBase
        });
        throw new Error('SyncManager est temporairement désactivé. Utilisez la connexion socket.');
    }
}

module.exports = new SyncManager();
