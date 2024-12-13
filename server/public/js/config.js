class ConfigUI {
    constructor() {
        this.initForm();
        this.initButtons();
        this.loadConfig();
    }

    async loadConfig() {
        try {
            if (window.api) {
                const config = await window.api.getConfig();
                if (config) {
                    document.getElementById('maxFiles').value = config.maxFiles || 1000;
                    document.getElementById('localMode').checked = config.localMode || false;
                    this.updateLanguage(config.language || 'fr');
                }
            }
        } catch (error) {
            console.error('Erreur lors du chargement de la configuration:', error);
        }
    }

    initForm() {
        // Initialiser les champs du formulaire avec des valeurs par défaut
        document.getElementById('maxFiles').value = 1000;
        document.getElementById('localMode').checked = false;
        this.updateLanguage('fr');
    }

    initButtons() {
        document.getElementById('saveBtn').addEventListener('click', () => this.saveConfig());
        document.getElementById('cancelBtn').addEventListener('click', () => {
            if (window.api) {
                window.api.closeWindow();
            }
        });

        // Gestion des boutons de langue
        document.querySelectorAll('.language-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.language-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    updateLanguage(lang) {
        document.querySelectorAll('.language-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });
    }

    async saveConfig() {
        try {
            const config = {
                maxFiles: parseInt(document.getElementById('maxFiles').value) || 1000,
                localMode: document.getElementById('localMode').checked,
                language: document.querySelector('.language-btn.active')?.dataset.lang || 'fr'
            };

            if (window.api) {
                await window.api.saveConfig(config);
                window.api.closeWindow();
            }
        } catch (error) {
            console.error('Erreur lors de la sauvegarde de la configuration:', error);
        }
    }
}

// Initialiser l'interface de configuration
document.addEventListener('DOMContentLoaded', () => {
    new ConfigUI();
});
