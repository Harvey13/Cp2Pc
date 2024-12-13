// Panneau de configuration
class ConfigPanel extends HTMLElement {
    constructor() {
        super();
        this.config = {};
        this.loadConfig();
        this.render();
    }

    async loadConfig() {
        try {
            if (window.api) {
                this.config = await window.api.getConfig() || {};
                this.render();
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
    }

    async saveConfig() {
        try {
            if (window.api) {
                await window.api.saveConfig(this.config);
                console.log('Configuration saved');
            }
        } catch (error) {
            console.error('Error saving config:', error);
        }
    }

    render() {
        this.innerHTML = `
            <div class="config-panel">
                <h2>Configuration</h2>
                <div class="config-item">
                    <label>
                        <input type="checkbox" class="local-mode-checkbox" 
                               ${this.config.localMode ? 'checked' : ''}>
                        Mode Local (copie sans appareil mobile)
                    </label>
                </div>
                <div class="config-actions">
                    <button class="save-config-btn">Enregistrer</button>
                </div>
            </div>
        `;

        this.addEventListeners();
    }

    addEventListeners() {
        // Checkbox mode local
        const localModeCheckbox = this.querySelector('.local-mode-checkbox');
        if (localModeCheckbox) {
            localModeCheckbox.addEventListener('change', (e) => {
                this.config.localMode = e.target.checked;
                this.saveConfig();
            });
        }

        // Bouton de sauvegarde
        const saveBtn = this.querySelector('.save-config-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveConfig();
            });
        }
    }
}

// Enregistrer le composant
customElements.define('config-panel', ConfigPanel);
