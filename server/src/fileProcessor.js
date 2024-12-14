const fs = require('fs').promises;
const path = require('path');
const { log_cli, log_dev } = require(path.join(__dirname, '..', 'utils', 'logger'));

/**
 * Copie un fichier d'un dossier à un autre
 * @param {Object} options Options de copie
 * @param {string} options.sourcePath Chemin source
 * @param {string} options.destPath Chemin destination
 * @param {string} options.filename Nom du fichier
 * @param {Object} options.mapping Mapping en cours
 * @param {Function} options.onProgress Callback de progression
 * @returns {Promise<boolean>} true si le fichier a été copié, false sinon
 */
async function copyFiles({ sourcePath, destPath, filename, mapping, onProgress }) {
    try {
        const srcFile = path.join(sourcePath, filename);
        const destFile = path.join(destPath, filename);
        log_cli('DEBUG', `📄 copyFiles`, {
            file: filename,
            mapping: mapping.title
        });

        // Vérifier si le fichier existe déjà
        try {
            const srcStats = await fs.stat(srcFile);
            let destStats;
            
            try {
                destStats = await fs.stat(destFile);
                
                // Si le fichier existe et est plus récent ou de même date, ne pas copier
                if (destStats.mtime >= srcStats.mtime) {
                    log_cli('DEBUG', '📄 Fichier déjà à jour', {
                        file: filename,
                        mapping: mapping.title
                    });
                    if (onProgress) onProgress({ file: filename, status: 'skipped' });
                    return false;
                }
            } catch (error) {
                // Le fichier n'existe pas en destination, on continue la copie
            }
            
            // Copier le fichier
            log_cli('INFO', '📄 Copie du fichier', {
                file: filename,
                mapping: mapping.title
            });
            if (onProgress) onProgress({ file: filename, status: 'copying' });
            
            await fs.copyFile(srcFile, destFile);
            
            log_cli('INFO', '✅ Fichier copié', {
                file: filename,
                mapping: mapping.title
            });
            log_dev('INFO', '✅ Fichier copié', {
                file: filename,
                mapping: mapping.title
            });
            
            if (onProgress) onProgress({ file: filename, status: 'copied' });
            return true;

        } catch (error) {
            log_cli('ERROR', `❌ Erreur lors de la copie`, {
                file: filename,
                mapping: mapping.title,
                error: error.message,
                stack: error.stack
            });
            if (onProgress) onProgress({ file: filename, status: 'error', error: error.message });
            throw error;
        }
    } catch (error) {
        throw error;
    }
}

/**
 * Vérifie le nombre de fichiers dans un dossier
 * @param {string} dirPath Chemin du dossier
 * @returns {Promise<number>} Nombre de fichiers
 */
async function getFileCount(dirPath) {
    try {
        const files = await fs.readdir(dirPath);
        return files.length;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return 0;
        }
        throw error;
    }
}

/**
 * Trouve le prochain dossier de destination disponible
 * @param {string} basePath Chemin de base
 * @param {number} maxFiles Nombre maximum de fichiers par dossier
 * @returns {Promise<string>} Chemin du dossier de destination
 */
async function findNextDestination(basePath, maxFiles) {
    // Vérifier le dossier de base
    const baseCount = await getFileCount(basePath);
    if (baseCount < maxFiles) {
        return basePath;
    }

    // Chercher le prochain dossier disponible
    let index = 1;
    while (true) {
        const newPath = `${basePath}_${String(index).padStart(2, '0')}`;
        const count = await getFileCount(newPath);
        if (count < maxFiles) {
            return newPath;
        }
        index++;
    }
}

/**
 * Traite un mapping complet
 * @param {Object} options Options de traitement
 * @param {Object} options.mapping Mapping à traiter
 * @param {Function} options.onProgress Callback de progression
 * @param {Function} options.onComplete Callback de fin
 * @returns {Promise<void>}
 */
async function processMapping({ mapping, onProgress, onComplete }) {
    try {
        log_cli('INFO', '📂 Début du traitement du mapping', {
            title: mapping.title,
            sourcePath: mapping.sourcePath,
            destPath: mapping.destPath
        });

        // Charger la configuration pour obtenir maxFiles
        const config = require(path.join(__dirname, '..', 'config.json'));
        const maxFiles = config.maxFiles || 100;

        // Trouver le bon dossier de destination
        log_cli('DEBUG', '📂 Vérification du dossier de destination', {
            destPath: mapping.destPath,
            maxFiles
        });
        
        const newDestPath = await findNextDestination(mapping.destPath, maxFiles);
        if (newDestPath !== mapping.destPath) {
            log_cli('INFO', "📂 Création d'un nouveau dossier de destination", {
                oldPath: mapping.destPath,
                newPath: newDestPath,
                reason: 'Dossier actuel plein (> ' + maxFiles + ' fichiers)'
            });
            mapping.destPath = newDestPath;
        }

        // Créer le dossier de destination
        log_cli('DEBUG', '📂 Création du dossier de destination', {
            destPath: mapping.destPath
        });
        await fs.mkdir(mapping.destPath, { recursive: true });

        // Lister les fichiers source
        log_cli('DEBUG', '📂 Lecture du dossier source', {
            sourcePath: mapping.sourcePath
        });
        const files = await fs.readdir(mapping.sourcePath);
        log_cli('DEBUG', `📂 ${files.length} fichiers trouvés`);
        const totalFiles = files.length;
        let processedFiles = 0;
        let copiedFiles = 0;

        // Informer du début du traitement
        if (onProgress) {
            onProgress({
                status: 'start',
                mapping: mapping.title,
                current: 0,
                total: totalFiles
            });
        }

        // Traiter chaque fichier
        log_cli('DEBUG', '📂 Début du traitement des fichiers');
        for (const filename of files) {
            log_cli('DEBUG', `📄 Traitement du fichier: ${filename}`);
            try {
                const copied = await copyFiles({
                    sourcePath: mapping.sourcePath,
                    destPath: mapping.destPath,
                    filename,
                    mapping,
                    onProgress: (file) => {
                        if (onProgress) onProgress({
                            status: 'copying',
                            mapping: mapping.title,
                            current: processedFiles + 1,
                            total: totalFiles,
                            file: filename
                        });
                    }
                });

                processedFiles++;
                if (copied) copiedFiles++;

            } catch (error) {
                log_cli('ERROR', `❌ Erreur lors de la copie du fichier: ${filename}`, {
                    error: error.message,
                    stack: error.stack
                });
                if (onProgress) onProgress({
                    status: 'error',
                    mapping: mapping.title,
                    error: error.message
                });
                throw error;
            }
        }

        // Informer de la fin du traitement
        if (onProgress) {
            onProgress({
                status: 'completed',
                mapping: mapping.title,
                current: processedFiles,
                total: totalFiles
            });
        }

        log_cli('INFO', '✅ Traitement du mapping terminé', {
            mapping: mapping.title,
            processed: processedFiles,
            copied: copiedFiles,
            total: totalFiles
        });

        if (onComplete) {
            onComplete({
                mapping: mapping.title,
                processed: processedFiles,
                copied: copiedFiles,
                total: totalFiles
            });
        }

    } catch (error) {
        log_cli('ERROR', `❌ Erreur lors du traitement du mapping`, {
            mapping: mapping.title,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

module.exports = {
    copyFiles,
    processMapping,
    getFileCount,
    findNextDestination
};
