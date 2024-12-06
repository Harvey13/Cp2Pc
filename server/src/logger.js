const winston = require('winston');
const path = require('path');
const { app } = require('electron');

let logger;
let logHistory = [];
const MAX_HISTORY = 1000;

function setupLogger() {
    const logDir = path.join(app.getPath('userData'), 'logs');
    
    const customFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
        return JSON.stringify({
            timestamp,
            level,
            message,
            ...meta
        });
    });

    logger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
            winston.format.timestamp(),
            customFormat
        ),
        transports: [
            new winston.transports.File({ 
                filename: path.join(logDir, 'error.log'),
                level: 'error'
            }),
            new winston.transports.File({ 
                filename: path.join(logDir, 'combined.log')
            })
        ]
    });

    // Ajouter le transport console en développement
    if (process.env.NODE_ENV !== 'production') {
        logger.add(new winston.transports.Console({
            format: winston.format.simple()
        }));
    }
}

function log(level, message, meta = {}) {
    if (!logger) setupLogger();
    
    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta
    };

    // Ajouter à l'historique
    logHistory.push(logEntry);
    if (logHistory.length > MAX_HISTORY) {
        logHistory.shift();
    }

    // Émettre vers les clients connectés
    if (global.io) {
        global.io.emit('log-entry', logEntry);
    }

    logger.log(level, message, meta);
}

function getLogHistory() {
    return logHistory;
}

function clearLogHistory() {
    logHistory = [];
}

module.exports = {
    setupLogger,
    log,
    getLogHistory,
    clearLogHistory
};
