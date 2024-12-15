const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const { log_cli, log_dev } = require(path.join(__dirname, '..', 'utils', 'logger'));

/**
 * Trouve la date du fichier le plus récent dans un dossier et ses sous-dossiers indexés
 * @param {string} basePath Chemin de base
 * @returns {Promise<Date>} Date du fichier le plus récent
 */
async function findLatestFileDate(basePath) {
    try {
        // Vérifier si le dossier de base existe
        const exists = await directoryExists(basePath);
        if (!exists) {
            log_cli('DEBUG', '📂 Le dossier de base n\'existe pas', { basePath });
            return new Date(0);
        }

        let latestDate = new Date(0); // Date la plus ancienne possible
        let baseDir = path.dirname(basePath);
        let baseName = path.basename(basePath);
        
        log_cli('DEBUG', '📂 Recherche de la date la plus récente', {
            basePath,
            baseDir,
            baseName
        });

        // Lister tous les dossiers qui correspondent au pattern basePath_XX
        const allDirs = await fs.readdir(baseDir);
        const relatedDirs = allDirs.filter(dir => 
            dir === baseName || 
            (dir.startsWith(baseName + '_') && /^\d{2}$/.test(dir.slice(baseName.length + 1)))
        ).sort((a, b) => b.localeCompare(a)); // Trier par ordre décroissant

        log_cli('DEBUG', '📂 Dossiers trouvés', {
            allDirs,
            relatedDirs
        });

        // Parcourir tous les dossiers pertinents
        for (const dir of relatedDirs) {
            const fullPath = path.join(baseDir, dir);
            try {
                log_cli('DEBUG', `📂 Analyse du dossier ${dir}`);
                const files = await fs.readdir(fullPath);
                for (const file of files) {
                    // Ignorer les fichiers .picasa.ini
                    if (file === '.picasa.ini') continue;
                    
                    const filePath = path.join(fullPath, file);
                    const stats = await fs.stat(filePath);
                    log_cli('DEBUG', `📅 Date du fichier ${file}`, {
                        date: stats.mtime.toISOString(),
                        isMoreRecent: stats.mtime > latestDate
                    });
                    if (stats.mtime > latestDate) {
                        latestDate = stats.mtime;
                        log_cli('DEBUG', '📅 Nouvelle date la plus récente trouvée', {
                            file,
                            date: latestDate.toISOString()
                        });
                    }
                }
            } catch (error) {
                log_cli('WARN', `⚠️ Erreur lors de l'analyse du dossier ${dir}`, {
                    error: error.message
                });
                // Ignorer les erreurs pour les dossiers qui n'existent pas
                continue;
            }
        }
        
        log_cli('INFO', '📅 Date la plus récente trouvée', {
            date: latestDate.toISOString(),
            basePath
        });
        return latestDate;
    } catch (error) {
        log_cli('ERROR', `❌ Erreur lors de la recherche de la date la plus récente`, {
            path: basePath,
            error: error.message
        });
        return new Date(0);
    }
}

/**
 * Vérifie si un dossier existe
 * @param {string} dirPath Chemin du dossier
 * @returns {Promise<boolean>} true si le dossier existe
 */
async function directoryExists(dirPath) {
    try {
        const stats = await fs.stat(dirPath);
        return stats.isDirectory();
    } catch (error) {
        if (error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

/**
 * Copie un fichier en utilisant fs.copyFile
 * @param {string} src Chemin source
 * @param {string} dest Chemin destination
 */
async function copyFileNative(src, dest) {
    try {
        // Vérifier que le fichier source existe
        try {
            await fs.access(src);
            log_cli('DEBUG', '✅ Fichier source trouvé', { src });
        } catch (error) {
            log_cli('ERROR', '❌ Fichier source introuvable', { src, error: error.message });
            throw new Error(`Fichier source introuvable: ${src}`);
        }
        
        // Vérifier et créer le dossier de destination si nécessaire
        const destDir = path.dirname(dest);
        try {
            await fs.access(destDir);
            log_cli('DEBUG', '✅ Dossier destination existe', { destDir });
        } catch (error) {
            log_cli('INFO', '📁 Création du dossier destination', { destDir });
            await fs.mkdir(destDir, { recursive: true });
        }

        // Copier le fichier
        log_cli('DEBUG', '📄 Copie du fichier', { src, dest });
        await fs.copyFile(src, dest);
        
        // Vérifier que la copie a réussi
        try {
            await fs.access(dest);
            log_cli('DEBUG', '✅ Fichier copié avec succès', { dest });
        } catch (error) {
            log_cli('ERROR', '❌ Fichier destination non trouvé après copie', { dest, error: error.message });
            throw new Error(`Échec de la vérification après copie: ${dest}`);
        }
    } catch (error) {
        log_cli('ERROR', '❌ Erreur lors de la copie', {
            error: error.message,
            src,
            dest
        });
        throw new Error(`Erreur lors de la copie: ${error.message}`);
    }
}

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

        // S'assurer que le dossier de destination existe
        try {
            await fs.access(destPath);
        } catch (error) {
            log_cli('INFO', '📁 Création du dossier de destination', {
                path: destPath
            });
            await fs.mkdir(destPath, { recursive: true });
        }

        log_cli('DEBUG', `📄 copyFiles`, {
            file: filename,
            mapping: mapping.title,
            srcFile,
            destFile
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
            
            await copyFileNative(srcFile, destFile);
            
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
 * Trouve le dernier dossier indexé existant
 * @param {string} basePath Chemin de base
 * @returns {Promise<{path: string, index: number}>} Dernier dossier et son index
 */
async function findLastExistingIndexedFolder(basePath) {
    const baseDir = path.dirname(basePath);
    const baseName = path.basename(basePath);
    let lastExisting = { path: basePath, index: 0 };

    try {
        const allDirs = await fs.readdir(baseDir);
        const indexedDirs = allDirs
            .filter(dir => dir === baseName || (dir.startsWith(baseName + '_') && /^\d{2}$/.test(dir.slice(baseName.length + 1))))
            .sort((a, b) => b.localeCompare(a)); // Tri décroissant

        log_cli('DEBUG', '📂 Recherche du dernier dossier indexé', {
            baseDir,
            baseName,
            indexedDirs
        });

        for (const dir of indexedDirs) {
            const fullPath = path.join(baseDir, dir);
            if (await directoryExists(fullPath)) {
                const index = dir === baseName ? 0 : parseInt(dir.slice(baseName.length + 1));
                if (index >= lastExisting.index) {
                    lastExisting = { path: fullPath, index };
                    log_cli('DEBUG', '📂 Dossier indexé trouvé', { path: fullPath, index });
                }
            }
        }

        return lastExisting;
    } catch (error) {
        log_cli('ERROR', '❌ Erreur lors de la recherche du dernier dossier indexé', {
            error: error.message
        });
        return lastExisting;
    }
}

/**
 * Trouve le prochain dossier de destination disponible
 * @param {string} basePath Chemin de base
 * @param {number} maxFiles Nombre maximum de fichiers par dossier
 * @returns {Promise<string>} Chemin du dossier de destination
 */
async function findNextDestination(basePath, maxFiles) {
    try {
        // Trouver le dernier dossier indexé existant
        const { path: lastPath, index: lastIndex } = await findLastExistingIndexedFolder(basePath);
        log_cli('INFO', '📂 Dernier dossier indexé trouvé', {
            path: lastPath,
            index: lastIndex,
            maxFiles
        });

        // Vérifier si le dernier dossier est plein
        const fileCount = await getFileCount(lastPath);
        if (fileCount >= maxFiles) {
            // Si le dossier est plein, créer le prochain
            const nextIndex = lastIndex + 1;
            const nextPath = nextIndex === 0 ? basePath : 
                path.join(path.dirname(basePath), `${path.basename(basePath)}_${String(nextIndex).padStart(2, '0')}`);

            log_cli('INFO', '📂 Création du prochain dossier indexé (dossier actuel plein)', {
                currentPath: lastPath,
                nextPath,
                currentFiles: fileCount,
                maxFiles,
                reason: 'Dossier actuel plein'
            });

            return nextPath;
        }

        // Si le dossier n'est pas plein, le réutiliser
        log_cli('INFO', '📂 Réutilisation du dernier dossier (non plein)', {
            path: lastPath,
            fileCount,
            maxFiles,
            availableSpace: maxFiles - fileCount
        });

        return lastPath;
    } catch (error) {
        log_cli('ERROR', '❌ Erreur lors de la recherche du prochain dossier', {
            error: error.message
        });
        return basePath;
    }
}

// Variables globales pour la gestion de l'annulation
let isCancelled = false;

function cancelCopy() {
    isCancelled = true;
}

function resetCancelFlag() {
    isCancelled = false;
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
        // Réinitialiser le drapeau d'annulation au début du processus
        resetCancelFlag();

        if (!mapping || !mapping.sourcePath || !mapping.destPath) {
            const error = new Error('Mapping invalide ou incomplet');
            log_cli('ERROR', error.message, { mapping });
            throw error;
        }

        log_cli('INFO', '📂 Début du traitement du mapping', {
            title: mapping.title,
            sourcePath: mapping.sourcePath,
            destPath: mapping.destPath
        });

        // Vérifier que le dossier source existe
        try {
            await fs.access(mapping.sourcePath);
        } catch (error) {
            const msg = `Le dossier source n'existe pas: ${mapping.sourcePath}`;
            log_cli('ERROR', msg);
            throw new Error(msg);
        }

        // Charger la configuration
        const config = require(path.join(__dirname, '..', 'config.json'));
        const maxFiles = config.maxFiles || 100;

        // Trouver la date la plus récente dans les dossiers de destination
        const latestDestDate = await findLatestFileDate(mapping.destPath);
        log_cli('INFO', '📅 Date filtre pour les fichiers source', {
            date: latestDestDate.toISOString(),
            mapping: mapping.title,
            destPath: mapping.destPath
        });

        // Trouver le bon dossier de destination
        log_cli('DEBUG', '📂 Vérification du dossier de destination', {
            destPath: mapping.destPath,
            maxFiles
        });
        
        // Vérifier si le dossier destination existe
        const destExists = await directoryExists(mapping.destPath);
        if (!destExists) {
            log_cli('INFO', '📁 Création du dossier destination initial', {
                path: mapping.destPath
            });
            await fs.mkdir(mapping.destPath, { recursive: true });
        }

        const newDestPath = await findNextDestination(mapping.destPath, maxFiles);
        if (newDestPath !== mapping.destPath) {
            log_cli('INFO', "📂 Création d'un nouveau dossier de destination", {
                oldPath: mapping.destPath,
                newPath: newDestPath,
                reason: 'Dossier actuel plein (> ' + maxFiles + ' fichiers)'
            });
            mapping.destPath = newDestPath;
            // Créer le nouveau dossier
            await fs.mkdir(newDestPath, { recursive: true });
        }

        // Lister et filtrer les fichiers source plus récents
        const files = await fs.readdir(mapping.sourcePath);
        const recentFiles = [];
        
        log_cli('DEBUG', '📂 Analyse des fichiers source', {
            total: files.length,
            sourcePath: mapping.sourcePath
        });

        for (const file of files) {
            // Ignorer les fichiers .picasa.ini
            if (file === '.picasa.ini') continue;
            
            const srcFile = path.join(mapping.sourcePath, file);
            const stats = await fs.stat(srcFile);
            log_cli('DEBUG', `📅 Comparaison des dates pour ${file}`, {
                fileDate: stats.mtime.toISOString(),
                latestDestDate: latestDestDate.toISOString(),
                isMoreRecent: stats.mtime > latestDestDate
            });
            if (stats.mtime > latestDestDate) {
                recentFiles.push(file);
            }
        }

        log_cli('INFO', `📂 Fichiers trouvés`, {
            total: files.length,
            recent: recentFiles.length,
            mapping: mapping.title,
            latestDestDate: latestDestDate.toISOString()
        });

        const totalFiles = recentFiles.length;
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
        for (const filename of recentFiles) {
            // Vérifier si l'annulation a été demandée
            if (isCancelled) {
                log_cli('INFO', '🛑 Copie annulée par l\'utilisateur', {
                    mapping: mapping.title
                });
                if (onProgress) {
                    onProgress({
                        status: 'cancelled',
                        mapping: mapping.title,
                        current: processedFiles,
                        total: totalFiles
                    });
                }
                return;
            }

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
    findNextDestination,
    cancelCopy,
    resetCancelFlag,
    directoryExists
};
