const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class Config {
    constructor() {
        this.configPath = path.join(app.getPath('userData'), 'config.json');
        this.defaultConfig = {
            maxFilesPerFolder: 1000,
            destinations: [],
            port: 3000
        };
        this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath);
                this.config = JSON.parse(data);
            } else {
                this.config = this.defaultConfig;
                this.saveConfig();
            }
        } catch (error) {
            console.error('Error loading config:', error);
            this.config = this.defaultConfig;
        }
    }

    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Error saving config:', error);
        }
    }

    get maxFilesPerFolder() {
        return this.config.maxFilesPerFolder;
    }

    set maxFilesPerFolder(value) {
        this.config.maxFilesPerFolder = value;
        this.saveConfig();
    }

    get destinations() {
        return this.config.destinations;
    }

    addDestination(path) {
        if (!this.config.destinations.includes(path)) {
            this.config.destinations.push(path);
            this.saveConfig();
        }
    }

    removeDestination(path) {
        const index = this.config.destinations.indexOf(path);
        if (index > -1) {
            this.config.destinations.splice(index, 1);
            this.saveConfig();
        }
    }
}

module.exports = {
    MAX_FILES_PER_FOLDER: 100, // Nombre maximum de fichiers par dossier
    config: new Config()
};
