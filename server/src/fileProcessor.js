const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { log_cli, log_dev } = require(path.join(__dirname, '..', 'utils', 'logger'));
const stream = require('stream');
const util = require('util');
const pipeline = util.promisify(stream.pipeline);

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
        // Vérifier si l'annulation a été demandée
        if (isCancelled) {
            log_cli('DEBUG', '🛑 Copie annulée pendant la copie native', { src, dest });
            return false;
        }

        // Vérifier que le fichier source existe
        log_cli('DEBUG', '🔍 Fichier source trouvé', { src });
        await fs.access(src);

        // Vérifier que le dossier destination existe
        const destDir = path.dirname(dest);
        const destDirExists = await this.directoryExists(destDir);
        log_cli('DEBUG', '🔍 Dossier destination existe', { destDir });

        if (!destDirExists) {
            await fs.mkdir(destDir, { recursive: true });
        }

        // Copier le fichier
        log_cli('DEBUG', '📝 Copie du fichier', {
            src,
            dest
        });

        // Vérifier à nouveau l'annulation avant de commencer la copie
        if (isCancelled) {
            log_cli('DEBUG', '🛑 Copie annulée juste avant la copie', { src, dest });
            return false;
        }

        await fs.copyFile(src, dest);

        // Vérifier que le fichier a bien été copié
        try {
            await fs.access(dest);
            log_cli('DEBUG', '✅ Fichier copié avec succès', { dest });
            return true;
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
        return false;
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
        // Vérifier si l'annulation a été demandée
        if (isCancelled) {
            log_cli('DEBUG', '🛑 Copie annulée', { filename });
            if (onProgress) {
                onProgress({
                    file: filename,
                    status: 'cancelled',
                    mapping: mapping.title
                });
            }
            return false;
        }

        const srcFile = path.join(sourcePath, filename);
        const destFile = path.join(destPath, filename);

        // Vérifier si le fichier existe déjà
        try {
            await fs.access(destFile);
            log_cli('INFO', '⏭️ Fichier déjà existant, ignoré', {
                file: filename,
                mapping: mapping.title
            });
            if (onProgress) onProgress({ file: filename, status: 'skipped' });
            return false;
        } catch {
            // Le fichier n'existe pas, on continue
        }

        // Vérifier à nouveau l'annulation avant de commencer la copie
        if (isCancelled) {
            log_cli('DEBUG', '🛑 Copie annulée avant copie', { filename });
            if (onProgress) {
                onProgress({
                    file: filename,
                    status: 'cancelled',
                    mapping: mapping.title
                });
            }
            return false;
        }

        if (onProgress) onProgress({ file: filename, status: 'copying' });
        
        const copied = await copyFileNative(srcFile, destFile);
        
        if (copied) {
            log_cli('INFO', '✅ Fichier copié', {
                file: filename,
                mapping: mapping.title,
                source: srcFile,
                destination: destFile
            });
            
            if (onProgress) onProgress({ file: filename, status: 'copied' });
            return true;
        } else {
            log_cli('INFO', '🛑 Copie annulée ou échouée', {
                file: filename,
                mapping: mapping.title
            });
            return false;
        }

    } catch (error) {
        log_cli('ERROR', `❌ Erreur lors de la copie`, {
            error: error.message,
            file: filename,
            mapping: mapping.title
        });
        if (onProgress) onProgress({ file: filename, status: 'error' });
        return false;
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
        // Vérifier d'abord si le dossier de base existe
        const baseExists = await directoryExists(basePath);
        if (baseExists) {
            // Vérifier le nombre de fichiers dans le dossier de base
            const baseFileCount = await getFileCount(basePath);
            log_cli('INFO', '📂 Vérification du dossier de base', {
                path: basePath,
                fileCount: baseFileCount,
                maxFiles
            });

            if (baseFileCount < maxFiles) {
                return basePath;
            }
        }

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
            const nextPath = path.join(path.dirname(basePath), `${path.basename(basePath)}_${String(nextIndex).padStart(2, '0')}`);

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

        // Vérifier si l'annulation a été demandée
        if (isCancelled) {
            log_cli('INFO', '🛑 Annulation demandée avant le début du traitement');
            if (onComplete) onComplete({ total: 0, processed: 0, copied: 0, cancelled: true });
            return;
        }

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

        // Vérifier si l'annulation a été demandée
        if (isCancelled) {
            log_cli('INFO', '🛑 Annulation demandée après la vérification du dossier source');
            if (onComplete) onComplete({ total: 0, processed: 0, copied: 0, cancelled: true });
            return;
        }

        // Trouver la date la plus récente dans les dossiers de destination
        const latestDestDate = await findLatestFileDate(mapping.destPath);
        log_cli('INFO', '📅 Date filtre pour les fichiers source', {
            date: latestDestDate.toISOString(),
            mapping: mapping.title,
            destPath: mapping.destPath
        });

        // Vérifier si l'annulation a été demandée
        if (isCancelled) {
            log_cli('INFO', '🛑 Annulation demandée après la recherche de la date la plus récente');
            if (onComplete) onComplete({ total: 0, processed: 0, copied: 0, cancelled: true });
            return;
        }

        // Fonction récursive pour lister les fichiers
        async function listFilesRecursively(dir, fileList = []) {
            if (isCancelled) {
                log_cli('INFO', '🛑 Annulation demandée pendant le listage des fichiers');
                return fileList;
            }

            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (isCancelled) {
                    log_cli('INFO', '🛑 Annulation demandée pendant le traitement des entrées');
                    return fileList;
                }

                const fullPath = path.join(dir, entry.name);
                if (entry.name === '.picasa.ini') continue;
                if (entry.isDirectory()) {
                    continue;
                } else {
                    const relativePath = path.relative(mapping.sourcePath, fullPath);
                    fileList.push(relativePath);
                }
            }
            return fileList;
        }

        // Lister les fichiers source
        const allFiles = await listFilesRecursively(mapping.sourcePath);

        // Vérifier si l'annulation a été demandée
        if (isCancelled) {
            log_cli('INFO', '🛑 Annulation demandée après le listage des fichiers');
            if (onComplete) onComplete({ total: allFiles.length, processed: 0, copied: 0, cancelled: true });
            return;
        }

        const recentFiles = [];
        let processedFiles = 0;

        // Analyser chaque fichier
        for (const file of allFiles) {
            if (isCancelled) {
                log_cli('INFO', '🛑 Annulation demandée pendant l\'analyse des fichiers', {
                    processed: processedFiles,
                    total: allFiles.length
                });
                if (onComplete) onComplete({ total: allFiles.length, processed: processedFiles, copied: 0, cancelled: true });
                return;
            }

            const srcFile = path.join(mapping.sourcePath, file);
            try {
                const stats = await fs.stat(srcFile);
                if (stats.mtime > latestDestDate) {
                    recentFiles.push(file);
                }
                processedFiles++;
            } catch (error) {
                log_cli('ERROR', `❌ Erreur lors de l'analyse du fichier ${file}:`, error);
                processedFiles++;
                continue;
            }
        }

        // Vérifier si l'annulation a été demandée
        if (isCancelled) {
            log_cli('INFO', '🛑 Annulation demandée après l\'analyse des fichiers');
            if (onComplete) onComplete({ total: allFiles.length, processed: processedFiles, copied: 0, cancelled: true });
            return;
        }

        log_cli('INFO', `📂 Fichiers trouvés`, {
            total: allFiles.length,
            recent: recentFiles.length,
            mapping: mapping.title,
            latestDestDate: latestDestDate.toISOString()
        });

        const totalFiles = recentFiles.length;
        processedFiles = 0;
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
            if (isCancelled) {
                log_cli('INFO', '🛑 Annulation demandée pendant la copie des fichiers', {
                    processed: processedFiles,
                    copied: copiedFiles,
                    total: totalFiles
                });
                if (onComplete) onComplete({ total: totalFiles, processed: processedFiles, copied: copiedFiles, cancelled: true });
                return;
            }

            try {
                const copied = await copyFiles({
                    sourcePath: mapping.sourcePath,
                    destPath: mapping.destPath,
                    filename,
                    mapping,
                    onProgress: () => {
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

                if (onProgress) {
                    onProgress({
                        status: copied ? 'copied' : 'skipped',
                        mapping: mapping.title,
                        current: processedFiles,
                        total: totalFiles,
                        file: filename
                    });
                }
            } catch (error) {
                log_cli('ERROR', `❌ Erreur lors de la copie du fichier ${filename}:`, error);
                processedFiles++;
                if (onProgress) {
                    onProgress({
                        status: 'error',
                        mapping: mapping.title,
                        current: processedFiles,
                        total: totalFiles,
                        file: filename,
                        error: error.message
                    });
                }
            }
        }

        // Informer de la fin du traitement
        if (onComplete) {
            onComplete({
                total: totalFiles,
                processed: processedFiles,
                copied: copiedFiles,
                cancelled: false
            });
        }

    } catch (error) {
        log_cli('ERROR', `❌ Erreur lors du traitement du mapping:`, error);
        if (onComplete) {
            onComplete({
                error: error.message,
                cancelled: isCancelled
            });
        }
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
