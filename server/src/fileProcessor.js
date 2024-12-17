const fs = require('fs').promises;
							 
const path = require('path');
const { app } = require('electron'); // Import the electron app module
const { log_cli } = require('./utils/logger');

// Variables globales
let isCancelled = false;

// Utilitaires de base pour les fichiers
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

// Gestion des dates
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
            log_cli('DEBUG', ' Le dossier de base n\'existe pas', { basePath });
            return new Date(0);
        }

        let latestDate = new Date(0); // Date la plus ancienne possible
        let baseDir = path.dirname(basePath);
        let baseName = path.basename(basePath);
        
																		
					 
					
					
		   

		// Lister tous les dossiers qui correspondent au pattern basePath_XX
        const allDirs = await fs.readdir(baseDir);
        const relatedDirs = allDirs.filter(dir => 
            dir === baseName || 
            (dir.startsWith(baseName + '_') && /^\d{2}$/.test(dir.slice(baseName.length + 1)))
        ).sort((a, b) => b.localeCompare(a)); // Trier par ordre décroissant

		log_cli('DEBUG', ' Dossiers trouvés', {
            allDirs,
            relatedDirs
        });													

		// Parcourir tous les dossiers pertinents										 
        for (const dir of relatedDirs) {
            const fullPath = path.join(baseDir, dir);
            try {
				log_cli('DEBUG', ` Analyse du dossier ${dir}`);
                const files = await fs.readdir(fullPath);
                for (const file of files) {
					// Ignorer les fichiers .picasa.ini
                    if (file === '.picasa.ini') continue;
                    
                    const filePath = path.join(fullPath, file);
                    const stats = await fs.stat(filePath);
                    log_cli('DEBUG', ` Date du fichier ${file}`, {
                        date: stats.mtime.toISOString(),
                        isMoreRecent: stats.mtime > latestDate
                    });																  
														
															  
					   
                    if (stats.mtime > latestDate) {
                        latestDate = stats.mtime;
                        log_cli('DEBUG', ' Nouvelle date la plus récente trouvée', {
                            file,
                            date: latestDate.toISOString()
                        });																						  
								 
														  
						   
                    }
                }
            } catch (error) {
                log_cli('WARN', ` Erreur lors de l'analyse du dossier ${dir}`, {
                    error: error.message
                });
																		   
                continue;
            }
        }
        
																
										   
					
		   
        return latestDate;
    } catch (error) {
        log_cli('ERROR', ` Erreur lors de la recherche de la date la plus récente`, {
            path: basePath,
            error: error.message
        });
        return new Date(0);
    }
}

// Gestion des dossiers
async function findLastExistingIndexedFolder(basePath) {
    const baseDir = path.dirname(basePath);
    const baseName = path.basename(basePath);
    let lastExisting = { path: basePath, index: 0 };

   
								
											
														
   
										 
    try {
        const allDirs = await fs.readdir(baseDir);
        const indexedDirs = allDirs
            .filter(dir => dir === baseName || (dir.startsWith(baseName + '_') && /^\d{2}$/.test(dir.slice(baseName.length + 1))))
            .sort((a, b) => b.localeCompare(a));

        for (const dir of indexedDirs) {
            const fullPath = path.join(baseDir, dir);
            if (await directoryExists(fullPath)) {
                const index = dir === baseName ? 0 : parseInt(dir.slice(baseName.length + 1));
                if (index >= lastExisting.index) {
                    lastExisting = { path: fullPath, index };
                    log_cli('DEBUG', ' Dossier indexé trouvé', { path: fullPath, index });
                }
            }
        }

        return lastExisting;
    } catch (error) {
        log_cli('ERROR', ' Erreur lors de la recherche du dernier dossier indexé', {
            error: error.message
        });
        return lastExisting;
    }
}

async function findNextDestination(basePath, maxFiles) {
    try {
        const { path: lastPath, index: lastIndex } = await findLastExistingIndexedFolder(basePath);
        const currentFileCount = await getFileCount(lastPath);
        
        if (currentFileCount < maxFiles) {
            log_cli('DEBUG', ' Réutilisation du dossier existant (non plein)', {
                path: lastPath,
                fileCount: currentFileCount,
                maxFiles
            });
            return lastPath;
        }

        let newIndex = lastIndex + 1;
        let attempts = 0;
        const maxAttempts = 100;

        do {
            const newDestination = `${basePath}_${String(newIndex).padStart(2, '0')}`;
            
            if (await directoryExists(newDestination)) {
                const fileCount = await getFileCount(newDestination);
                if (fileCount < maxFiles) {
                    log_cli('DEBUG', ' Dossier indexé existant non plein trouvé', {
                        path: newDestination,
                        fileCount,
                        maxFiles
                    });
                    return newDestination;
                }
            } else {
                try {
                    await fs.mkdir(newDestination, { recursive: true });
                    log_cli('INFO', ' Nouveau dossier créé', { path: newDestination });
                    return newDestination;
                } catch (error) {
                    log_cli('ERROR', ' Erreur lors de la création du dossier', {
                        path: newDestination,
                        error: error.message
                    });
                }
            }

            newIndex++;
            attempts++;
        } while (attempts < maxAttempts);

        log_cli('ERROR', ' Impossible de trouver un dossier de destination disponible', {
            basePath,
            attempts
        });
        return lastPath;

    } catch (error) {
        log_cli('ERROR', ' Erreur lors de la recherche du prochain dossier', {
            error: error.message
        });
        return basePath;
    }
}

// Opérations de copie
											
									
										  
   
async function copyFileNative(src, dest) {
    try {
													  
        if (isCancelled) {
            log_cli('DEBUG', ' Copie annulée pendant la copie native', { src, dest });
            return false;
        }

												 
																 
        await fs.access(src);

													  
        const destDir = path.dirname(dest);
															 
																		 

							 
        await fs.mkdir(destDir, { recursive: true });
		 

							
												   
				
				
		   

																		
        if (isCancelled) {
            log_cli('DEBUG', ' Copie annulée juste avant la copie', { src, dest });
            return false;
        }

        await fs.copyFile(src, dest);

													   
			 
        await fs.access(dest);
        
        return true;
						 
																												 
																				
		 
    } catch (error) {
        log_cli('ERROR', ' Erreur lors de la copie', {
            error: error.message,
            src,
            dest
        });
        return false;
    }
}

   
											
										   
												   
													  
												  
												   
															   
																			 
   
async function copyFiles({ sourcePath, destPath, filename, mapping, onProgress }) {
    try {
													  
        if (isCancelled) {
            if (onProgress) onProgress({ file: filename, status: 'cancelled', mapping: mapping.title });
							 
							
								   
										
										  
				   
			 
            return false;
        }

        const srcFile = path.join(sourcePath, filename);
        const destFile = path.join(destPath, filename);

												
        try {
            await fs.access(destFile);
																		
							   
									  
			   
            if (onProgress) onProgress({ file: filename, status: 'skipped' });
            return false;
        } catch {
            // Le fichier n'existe pas, continuer la copie
        }

																		
        if (isCancelled) {
            if (onProgress) onProgress({ file: filename, status: 'cancelled', mapping: mapping.title });
							 
							
								   
										
										  
				   
			 
            return false;
        }

        if (onProgress) onProgress({ file: filename, status: 'copying' });
        
        const copied = await copyFileNative(srcFile, destFile);
        
        if (copied) {
												   
							   
									   
								
									 
			   
			
            if (onProgress) onProgress({ file: filename, status: 'copied' });
            return true;
				
																 
							   
									  
			   
						 
        }
        
        return false;
    } catch (error) {
        log_cli('ERROR', ` Erreur lors de la copie`, {
            error: error.message,
            file: filename,
            mapping: mapping.title
        });
        if (onProgress) onProgress({ file: filename, status: 'error' });
        return false;
    }
}

// Traitement principal
												 
											
												
   
									  
		 
												
							
					 
									  
					 
		 
					
	 
 

   
											 
										  
																				 
   
														
										   
											 
													

		 
												  
								   
																																  
																	

																	   
					
					 
					   
		   

										
													 
												  
																							  
												  
															 
																								
				 
			 
		 

							
					 
																						
								
		   
							
	 
 

   
													   
										  
																  
															  
   
														
		 
													  
																								   
																 
						   
							 
					
		   

													
															  
										   
																													 
										 
							   
				
																					
						   
															
				 
																	
																			 
							 
																														 
																				 
			 
								  
				
																														   
		 

														
																			   
						   
										
					 
													   
		   

						
					 
																				 
								
		   
						
	 
 

													 
						

					   
					   
 

							
						
 

   
							
												
													 
															   
													   
						   
   
async function processMapping({ mapping, onProgress, onComplete }) {
    try {
        isCancelled = false;
						  

        if (!mapping || !mapping.sourcePath || !mapping.destPath) {
            const error = new Error('Mapping invalide ou incomplet');
            log_cli('ERROR', error.message, { mapping });
            throw error;
        }

																 
								 
										   
									  
		   

													  
						  
																					   
																							   
				   
		 

												 
        try {
            await fs.access(mapping.sourcePath);
        } catch (error) {
            throw new Error(`Le dossier source n'existe pas: ${mapping.sourcePath}`);
								  
								 
        }

        const configPath = path.join(app.getPath('userData'), 'config.json');
        const config = require(configPath);
        const maxFiles = config.maxFiles || 100;

													  
						  
																								   
																							   
				   
		 

																			
        const latestDestDate = await findLatestFileDate(mapping.destPath);
																	  
											   
								   
									  
		   

        // Lister les fichiers récents
						  
																										 
																							   
				   
		 

																						 
																   
										
																				  
										   
											
						
			   
																							   
				   
		 

													   
																 
							  
																							 
								
			 

																		   
										  
								  
																									
									
				 

															
														   
										  
							 
						
																					 
												
				 
			 
							
		 

									 
        const allFiles = await listFilesRecursively(mapping.sourcePath);

        if (allFiles.length === 0) {
            log_cli('WARNING', 'Rien à copier dans le dossier source.');
            return;
        }
        
        const recentFiles = [];
        

								  
        for (const file of allFiles) {
							  
																							  
											  
										  
				   
																															  
					   
			 

            const srcFile = path.join(mapping.sourcePath, file);
            try {
                const stats = await fs.stat(srcFile);
                if (stats.mtime > latestDestDate) {
                    recentFiles.push(file);
                }
								 
            } catch (error) {
                log_cli('ERROR', ` Erreur lors de l'analyse du fichier ${file}:`, error);
								 
                continue;
            }
        }

        if (recentFiles.length === 0) {
            log_cli('WARNING', 'Aucun fichier récent trouvé dans le dossier source.');
            return;
        }

        const totalFiles = recentFiles.length;
        let processedFiles = 0;
        let copiedFiles = 0;
        let currentDestPath = mapping.destPath;

										   
        if (onProgress) {
            onProgress({
                status: 'start',
                mapping: mapping.title,
                current: 0,
                total: totalFiles
            });
        }

        // Copier les fichiers
        for (const filename of recentFiles) {
            try {
                const currentFileCount = await getFileCount(currentDestPath);
                if (currentFileCount >= maxFiles) {
                    const nextDestPath = await findNextDestination(mapping.destPath, maxFiles);
                    if (nextDestPath === currentDestPath) {
                        log_cli('ERROR', ' Impossible de créer un nouveau dossier de destination', {
                            currentPath: currentDestPath
                        });
                        break;
                    }
                    currentDestPath = nextDestPath;
                    log_cli('INFO', ' Nouveau dossier de destination', {
                        path: currentDestPath
                    });
                }

				 
                const copied = await copyFiles({
                    sourcePath: mapping.sourcePath,
                    destPath: currentDestPath,
                    filename,
                    mapping,
                    onProgress: () => {
                        if (onProgress) {
                            onProgress({
                                status: 'copying',
                                mapping: mapping.title,
                                current: processedFiles + 1,
                                total: totalFiles,
                                file: filename
                            });
                        }
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
                log_cli('ERROR', ` Erreur lors de la copie du fichier ${filename}:`, error);
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

										   
        if (onComplete) {
            onComplete({
                total: totalFiles,
                processed: processedFiles,
                copied: copiedFiles,
                cancelled: false
            });
        }

    } catch (error) {
        log_cli('ERROR', ` Erreur lors du traitement du mapping:`, error);
        if (onComplete) {
            onComplete({
                error: error.message,
                cancelled: false
            });
        }
        throw error;
    }
}

// Fonction utilitaire pour lister les fichiers récursivement
async function listFilesRecursively(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    
    for (const entry of entries) {
        if (entry.name === '.picasa.ini') continue;
        if (!entry.isDirectory()) {
            const relativePath = path.relative(dir, path.join(dir, entry.name));
            files.push(relativePath);
        }
    }
    
    return files;
}

// Contrôle de la copie
function cancelCopy() {
    isCancelled = true;
}

function resetCancelFlag() {
    isCancelled = false;
}

module.exports = {
			  
    processMapping,
				 
						
    cancelCopy,
    resetCancelFlag,
    findNextDestination,
    directoryExists,
    getFileCount
};
