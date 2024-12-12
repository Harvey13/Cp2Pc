const isDev = process.env.NODE_ENV === 'development';
const { LogTypes } = require('./utils/logger');

const config = {
    development: isDev,
    port: 3000,
    devTools: isDev,
    debug: isDev,
    logLevel: isDev ? 'debug' : 'info',
    logs: {
        activeTypes: [
            LogTypes.CONNECT,
            LogTypes.UI,
            LogTypes.MAPS,
            LogTypes.ERROR,
            LogTypes.CONFIG,
            LogTypes.INFO,
            LogTypes.DEBUG,
            LogTypes.SERVER,
            LogTypes.IPC
        ]
    },
    maxFiles: 1000,
    language: 'fr',
    mappings: []
};

module.exports = config;
