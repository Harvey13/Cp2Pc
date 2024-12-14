// Système de logging avec encodage UTF-8 et couleurs
const isDevelopment = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

// Types de logs disponibles
const LogTypes = {
    UI: 'UI',         // Événements de l'interface utilisateur
    CONNECT: 'CONNECT', // Événements de connexion
    MAPS: 'MAPS',     // Événements liés aux mappings
    CONFIG: 'CONFIG', // Configuration
    INFO: 'INFO',     // Informations générales
    ERROR: 'ERROR',   // Erreurs
    SERVER: 'SERVER', // Événements serveur
    DEBUG: 'DEBUG'    // Messages de débogage
};

// Créer une instance unique du logger
class Logger {
    constructor() {
        this.activeTypes = Object.values(LogTypes);
    }

    console_log(type, ...args) {
        if (!this.activeTypes.includes(type)) return;
        
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}][${type}]`, ...args);
    }

    setLogTypes(types) {
        if (Array.isArray(types)) {
            this.activeTypes = types;
        }
    }
}

// Créer et exporter une instance unique
const logger = new Logger();

// Exporter l'instance et les types
module.exports = {
    LogTypes,
    console_log: logger.console_log.bind(logger),
    log_cli: logger.console_log.bind(logger),
    log_dev: logger.console_log.bind(logger),
    setLogTypes: logger.setLogTypes.bind(logger)
};
