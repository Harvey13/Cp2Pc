// Panneau de configuration
class ConfigPanel extends HTMLElement {
    constructor() {
        super();
        this.initializeConfig();
    }

    async initializeConfig() {
        if (window.api) {
            const config = await window.api.getConfig();
            this.updateUI(config);
        }
    }

    updateUI(config) {
        // ... mise à jour de l'interface
    }
}

// Enregistrer le composant
customElements.define('config-panel', ConfigPanel);
