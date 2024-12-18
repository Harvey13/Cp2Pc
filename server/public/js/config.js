class ConfigUI {
    constructor() {
        this.initializeUI();
        this.initializeButtons();
    }

    async initializeUI() {
        if (window.api) {
            const config = await window.api.getConfig();
            this.updateUIFromConfig(config);
        }
    }

    initializeButtons() {
        console.log('Initialisation des boutons de configuration');
        
        // Bouton Sauvegarder
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                try {
                    await this.saveConfig();
                } catch (error) {
                    console.error('Erreur lors de la sauvegarde de la configuration:', error);
                    alert('Erreur lors de la sauvegarde: ' + error.message);
                }
            });
        } else {
            console.warn('Bouton de sauvegarde non trouvé');
        }

        // Bouton Annuler
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', async () => {
                try {
                    console.log('Annulation des modifications');
                    await this.cancelConfig();
                } catch (error) {
                    console.error('Erreur lors de l\'annulation:', error);
                }
            });
        } else {
            console.warn('Bouton d\'annulation non trouvé');
        }

        console.log('Boutons de configuration initialisés');
    }

    updateUIFromConfig(config) {
        // Mettre à jour les éléments de l'interface
        const maxFilesInput = document.getElementById('maxFiles');
        const localModeCheckbox = document.getElementById('localMode');
        const languageButtons = document.querySelectorAll('.language-btn');

        if (maxFilesInput) {
            maxFilesInput.value = config.maxFiles || 100;
        }

        if (localModeCheckbox) {
            localModeCheckbox.checked = config.localMode || false;
        }

        // Mettre à jour le bouton de langue actif
        languageButtons.forEach(btn => {
            if (btn.dataset.lang === config.language) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    async saveConfig() {
        try {
            console.log('Sauvegarde de la configuration');
            
            const maxFiles = parseInt(document.getElementById('maxFiles').value) || 100;
            const localMode = document.getElementById('localMode').checked;
            const activeLanguageBtn = document.querySelector('.language-btn.active');
            const language = activeLanguageBtn ? activeLanguageBtn.dataset.lang : 'fr';

            const newConfig = {
                maxFiles,
                localMode,
                language
            };

            console.log('Nouvelle configuration:', newConfig);

            if (window.api) {
                await window.api.saveConfig(newConfig);
                console.log('Configuration sauvegardée avec succès');
                
                // Fermer la fenêtre de configuration
                await window.api.closeConfig();
            }
        } catch (error) {
            console.error('Erreur lors de la sauvegarde de la configuration:', error);
            throw error;
        }
    }

    async cancelConfig() {
        try {
            console.log('Annulation des modifications de configuration');
            
            // Recharger la configuration initiale
            if (window.api) {
                const config = await window.api.getConfig();
                this.updateUIFromConfig(config);
                
                // Fermer la fenêtre de configuration
                await window.api.closeConfig();
            }
        } catch (error) {
            console.error('Erreur lors de l\'annulation:', error);
            throw error;
        }
    }
}

// Initialiser l'interface de configuration
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initialisation de l\'interface de configuration');
    window.configUI = new ConfigUI();
}); 