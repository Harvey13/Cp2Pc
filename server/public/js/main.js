// État de l'application
let appState = {
    connected: false,
    mobileIP: null,
    mappings: [],  // Liste des mappings
    nextMappingId: 1
};

// Éléments DOM
const connectionStatus = document.getElementById('connectionStatus');
const statusText = document.getElementById('statusText');
const configBtn = document.getElementById('configBtn');
const noMappingState = document.getElementById('noMappingState');
const withMappingsState = document.getElementById('withMappingsState');
const firstMappingBtn = document.getElementById('firstMappingBtn');
const mappingsList = document.getElementById('mappingsList');
const mappingTemplate = document.getElementById('mappingTemplate');

// Mettre à jour l'interface utilisateur
function updateUI() {
    if (appState.connected) {
        connectionStatus.className = 'status-led connected';
        statusText.textContent = `Mobile connecté (${appState.mobileIP})`;
    } else {
        connectionStatus.className = 'status-led waiting';
        statusText.textContent = 'En attente d\'un mobile';
    }

    // Afficher l'état approprié selon les mappings
    if (appState.mappings.length === 0) {
        noMappingState.style.display = 'block';
        withMappingsState.style.display = 'none';
    } else {
        noMappingState.style.display = 'none';
        withMappingsState.style.display = 'block';
        updateMappingsList();
    }
}

// Créer un nouveau mapping
function createMapping() {
    const mapping = {
        id: appState.nextMappingId++,
        title: 'Nouveau mapping',
        sourcePath: '',
        destPath: '',
        progress: 0
    };
    appState.mappings.push(mapping);
    updateUI();
    return mapping;
}

// Supprimer un mapping
function deleteMapping(id) {
    const index = appState.mappings.findIndex(m => m.id === id);
    if (index !== -1) {
        appState.mappings.splice(index, 1);
        updateUI();
    }
}

// Mettre à jour le titre d'un mapping
function updateMappingTitle(id, newTitle) {
    const mapping = appState.mappings.find(m => m.id === id);
    if (mapping) {
        mapping.title = newTitle;
        updateUI();
    }
}

// Créer un élément de mapping à partir du template
function createMappingElement(mapping) {
    const template = mappingTemplate.content.cloneNode(true);
    const element = template.querySelector('.mapping-item');
    
    // Configurer l'ID
    element.dataset.mappingId = mapping.id;
    
    // Configurer le titre
    const titleElement = element.querySelector('.mapping-title');
    titleElement.textContent = mapping.title;
    
    // Gestionnaire pour le bouton de suppression
    const deleteBtn = element.querySelector('.mapping-delete');
    deleteBtn.addEventListener('click', () => deleteMapping(mapping.id));
    
    // Gestionnaire pour le bouton d'édition
    const editBtn = element.querySelector('.mapping-edit');
    editBtn.addEventListener('click', () => {
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.className = 'mapping-title-input';
        titleInput.value = mapping.title;
        
        titleElement.replaceWith(titleInput);
        titleInput.focus();
        
        titleInput.addEventListener('blur', () => {
            updateMappingTitle(mapping.id, titleInput.value);
            titleInput.replaceWith(titleElement);
        });
        
        titleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                titleInput.blur();
            }
        });
    });
    
    // Gestionnaires pour les boutons de sélection de dossier
    const sourceFolderBtn = element.querySelector('.path-button.mobile');
    sourceFolderBtn.addEventListener('click', () => {
        console.log('[UI] Sélection dossier source sur mobile pour mapping', mapping.id);
        window.api.selectMobileFolder(mapping.id);
    });
    
    const destFolderBtn = element.querySelector('.path-button:not(.mobile)');
    destFolderBtn.addEventListener('click', () => {
        console.log('[UI] Sélection dossier destination sur PC pour mapping', mapping.id);
        window.api.selectPCFolder(mapping.id);
    });
    
    return element;
}

// Mettre à jour la liste des mappings
function updateMappingsList() {
    // Vider la liste
    while (mappingsList.firstChild) {
        if (!(mappingsList.firstChild instanceof HTMLTemplateElement)) {
            mappingsList.removeChild(mappingsList.firstChild);
        }
    }
    
    // Ajouter chaque mapping
    appState.mappings.forEach(mapping => {
        const element = createMappingElement(mapping);
        mappingsList.appendChild(element);
    });
}

// Gérer l'ajout d'un mapping
function handleAddMapping() {
    console.log('[UI] Ajout mapping');
    createMapping();
}

// Gestion des mappings
document.getElementById('addMappingBtn').addEventListener('click', () => {
    if (window.electron) {
        window.electron.openMappingDialog();
    }
});

// Rafraîchir la liste des mappings
async function refreshMappings() {
    if (window.electron) {
        const config = await window.electron.getConfig();
        const mappingsContainer = document.getElementById('mappingsContainer');
        mappingsContainer.innerHTML = '';

        if (config.mappings && config.mappings.length > 0) {
            config.mappings.forEach(mapping => {
                const mappingElement = document.createElement('div');
                mappingElement.className = 'mapping-item';
                mappingElement.innerHTML = `
                    <div class="mapping-title">${mapping.title}</div>
                    <div class="mapping-paths">
                        <div class="source-path">${mapping.sourcePath}</div>
                        <div class="dest-path">${mapping.destPath}</div>
                    </div>
                    <div class="mapping-actions">
                        <button class="edit-btn" data-id="${mapping.id}">
                            <svg viewBox="0 0 24 24" width="16" height="16">
                                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                        </button>
                        <button class="delete-btn" data-id="${mapping.id}">
                            <svg viewBox="0 0 24 24" width="16" height="16">
                                <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                        </button>
                    </div>
                `;
                mappingsContainer.appendChild(mappingElement);
            });
        }
    }
}

// Rafraîchir la liste des mappings au chargement
document.addEventListener('DOMContentLoaded', () => {
    refreshMappings();
});

// Écouter les événements IPC
window.api.onMobileConnected((event, ip) => {
    console.log('[UI] Mobile connecté:', ip);
    appState.connected = true;
    appState.mobileIP = ip.replace('::ffff:', '');
    updateUI();
});

window.api.onMobileDisconnected(() => {
    console.log('[UI] Mobile déconnecté');
    appState.connected = false;
    appState.mobileIP = null;
    updateUI();
});

window.api.onMappingProgress((event, { id, progress }) => {
    const mapping = appState.mappings.find(m => m.id === id);
    if (mapping) {
        mapping.progress = progress;
        updateMappingsList();
    }
});

window.api.onFolderSelected((event, { id, type, path }) => {
    const mapping = appState.mappings.find(m => m.id === id);
    if (mapping) {
        if (type === 'source') {
            mapping.sourcePath = path;
        } else {
            mapping.destPath = path;
        }
        updateUI();
    }
});

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialiser les traductions
        if (window.electron) {
            const currentLang = await window.electron.getCurrentLanguage();
            if (currentLang) {
                window.i18nManager.setLanguage(currentLang);
            }
        }

        // Initialiser l'UI
        updateUI();
        
        // Gestionnaires d'événements pour les boutons
        configBtn.addEventListener('click', () => {
            console.log('[UI] Clic sur le bouton de configuration');
            console.log('[UI] window.electron disponible ?', !!window.electron);
            if (window.electron) {
                console.log('[UI] Appel de window.electron.openConfig()');
                window.electron.openConfig();
            } else {
                console.error('[UI] window.electron n\'est pas disponible !');
            }
        });
        
        firstMappingBtn.addEventListener('click', handleAddMapping);
        
        const addMappingBtn = document.querySelector('.add-mapping-btn');
        if (addMappingBtn) {
            addMappingBtn.addEventListener('click', handleAddMapping);
        }
        
        const startCopyBtn = document.querySelector('.start-copy-btn');
        if (startCopyBtn) {
            startCopyBtn.addEventListener('click', () => {
                console.log('[UI] Démarrage copie');
                window.api.startCopy(appState.mappings);
            });
        }
        
        console.log('[UI] ✅ Interface initialisée');
    } catch (error) {
        console.error('[UI] ❌ Erreur d\'initialisation:', error);
    }
});
