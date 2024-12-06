class ConfigUI {
    constructor() {
        this.initButtons();
        this.initLanguageButtons();
        this.loadConfig();
    }

    async loadConfig() {
        if (window.electron) {
            const config = await window.electron.getConfig();
            if (config) {
                document.getElementById('maxFiles').value = config.maxFiles || 1000;
                this.updateLanguage(config.language || 'fr');
            }
        }
    }

    updateLanguage(lang) {
        document.querySelectorAll('.language-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });
    }

    initButtons() {
        document.getElementById('saveBtn').addEventListener('click', () => this.saveConfig());
        document.getElementById('cancelBtn').addEventListener('click', () => {
            if (window.electron) {
                window.electron.closeWindow();
            }
        });
    }

    initLanguageButtons() {
        document.querySelectorAll('.language-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                this.updateLanguage(lang);
                if (window.i18nManager) {
                    window.i18nManager.setLanguage(lang);
                }
            });
        });
    }

    async saveConfig() {
        if (window.electron) {
            const config = {
                maxFiles: parseInt(document.getElementById('maxFiles').value) || 1000,
                language: document.querySelector('.language-btn.active')?.dataset.lang || 'fr'
            };
            
            const success = await window.electron.saveConfig(config);
            if (success) {
                window.electron.closeWindow();
            }
        }
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    window.configUI = new ConfigUI();
});
