const winston = require('winston');
const path = require('path');

let logger;
let logHistory = [];
const MAX_HISTORY = 1000;

// Fonction pour encoder correctement les chemins en UTF-8
function encodePathsInObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const result = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            try {
                // Ensure proper UTF-8 encoding for all string values
                result[key] = Buffer.from(value).toString('utf8');
                // Also convert backslashes to forward slashes for paths
                if (key === 'sourcePath' || key === 'destPath' || key === 'path' || key === 'destination') {
                    result[key] = result[key].replace(/\\/g, '/');
                }
            } catch (error) {
                result[key] = value;
            }
        } else if (typeof value === 'object' && value !== null) {
            result[key] = encodePathsInObject(value);
        } else {
            result[key] = value;
        }
    }
    
    return result;
}

function setupLogger() {
    const customFormat = winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
            // Encoder les chemins dans les métadonnées
            const encodedMeta = encodePathsInObject(meta);
            
            // Formater le message de base
            let output = `[${timestamp}][${level.toUpperCase()}] `;
            
            // Ensure message is properly encoded
            if (typeof message === 'string') {
                output += Buffer.from(message).toString('utf8');
            } else if (typeof message === 'object') {
                output += JSON.stringify(encodePathsInObject(message));
            } else {
                output += message;
            }
            
            // Ajouter les métadonnées si présentes
            if (Object.keys(encodedMeta).length > 0) {
                output += ' ' + JSON.stringify(encodedMeta);
            }
            
            return output;
        })
    );

    logger = winston.createLogger({
        level: 'DEBUG',
        levels: {
            ERROR: 0,
            INFO: 1,
            CONFIG: 2,
            DEBUG: 3
        },
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            customFormat
        ),
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    customFormat
                )
            })
        ]
    });
}

function log_cli(level, message, meta = {}) {
    if (!logger) setupLogger();

    // Ne pas normaliser le niveau de log pour conserver la casse
    const normalizedLevel = level;
    
    // Créer l'entrée de log
    const logEntry = {
        timestamp: new Date().toISOString(),
        level: normalizedLevel,
        message: message,
        ...encodePathsInObject(meta)
    };
    
    // Ajouter à l'historique
    logHistory.unshift(logEntry);
    if (logHistory.length > MAX_HISTORY) {
        logHistory.pop();
    }

    // Logger le message
    logger.log(normalizedLevel, message, meta);

    return logEntry;
}

function log_dev(level, message, meta = {}) {
    if (!logger) setupLogger();

    // Créer l'entrée de log
    const logEntry = {
        timestamp: new Date().toISOString(),
        level: level,
        message: message,
        ...encodePathsInObject(meta)
    };

    // Émettre l'événement de log si io est disponible
    if (global.io) {
        global.io.emit('log', logEntry);
    }

    return logEntry;
}

function getLogHistory() {
    return logHistory;
}

function clearLogHistory() {
    logHistory = [];
}

module.exports = {
    setupLogger,
    log_cli,
    log_dev,
    getLogHistory,
    clearLogHistory
};
