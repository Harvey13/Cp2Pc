const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class ConfigManager {
    constructor() {
        const userDataPath = app.getPath('userData');
        this.configPath = path.join(userDataPath, 'config.json');
        console.log('[CONFIG] Dossier des données:', userDataPath);
        console.log('[CONFIG] Chemin du fichier de configuration:', this.configPath);
        
        this.config = null;
        this.initialize();
    }

    initialize() {
        try {
            if (fs.existsSync(this.configPath)) {
                const rawData = fs.readFileSync(this.configPath, { encoding: 'utf8' });
                console.log('[CONFIG] Contenu du fichier:', rawData);
                
                try {
                    this.config = JSON.parse(rawData);
                    console.log('[CONFIG] Configuration chargée:', this.config);
                } catch (parseError) {
                    console.error('[CONFIG] Erreur de parsing JSON:', parseError);
                    this.config = this.getDefaultConfig();
                }
            } else {
                console.log('[CONFIG] Fichier de configuration non trouvé, création avec valeurs par défaut');
                this.config = this.getDefaultConfig();
                this.persistConfig(this.config);
            }

            if (!this.isValidConfig(this.config)) {
                console.warn('[CONFIG] Configuration invalide, utilisation des valeurs par défaut');
                this.config = this.getDefaultConfig();
                this.persistConfig(this.config);
            }

            if (!Array.isArray(this.config.mappings)) {
                this.config.mappings = [];
                this.persistConfig(this.config);
            }

            console.log('[CONFIG] Configuration initialisée:', this.config);
            return this.config;
        } catch (error) {
            console.error('[CONFIG] Erreur lors de l\'initialisation:', error);
            this.config = this.getDefaultConfig();
            return this.config;
        }
    }

    isValidConfig(config) {
        return config 
            && typeof config === 'object'
            && typeof config.maxFiles === 'number'
            && typeof config.localMode === 'boolean'
            && typeof config.language === 'string';
    }

    getConfig() {
        if (!this.config) {
            this.initialize();
        }
        return this.config;
    }

    getMappings() {
        const config = this.getConfig();
        return config.mappings || [];
    }

    cleanPath(path) {
        if (!path) return path;
        return path.normalize()
            .replace(/\\+/g, '\\')
            .replace(/[^\x00-\x7F]/g, char => encodeURIComponent(char));
    }

    persistConfig(config) {
        try {
            const jsonContent = JSON.stringify(config, null, 2);
            fs.writeFileSync(this.configPath, jsonContent, { encoding: 'utf8', flag: 'w' });
            this.config = config;
            return true;
        } catch (error) {
            console.error('[CONFIG] Erreur de persistance:', error);
            return false;
        }
    }

    updateConfig(partialConfig) {
        try {
            const updatedConfig = {
                ...this.config,
                ...partialConfig,
                mappings: this.config?.mappings || []
            };
            
            if (this.persistConfig(updatedConfig)) {
                console.log('[CONFIG] Configuration mise à jour:', updatedConfig);
                return updatedConfig;
            }
            throw new Error('Échec de la persistance');
        } catch (error) {
            console.error('[CONFIG] Erreur de mise à jour:', error);
            throw error;
        }
    }

    getDefaultConfig() {
        return {
            maxFiles: 100,
            localMode: false,
            language: 'fr',
            mappings: []
        };
    }
}

let configManager = null;

function createConfigManager() {
    if (!configManager) {
        configManager = new ConfigManager();
    }
    return configManager;
}

module.exports = {
    createConfigManager,
    getConfigManager: () => configManager
};
