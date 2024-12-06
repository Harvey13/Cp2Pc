// Système de logging avec encodage UTF-8 et couleurs
const isDevelopment = process.env.NODE_ENV === 'development';

const log = {
    info: (...args) => {
        const message = args.map(arg => 
            typeof arg === 'string' ? arg : JSON.stringify(arg)
        );
        console.log('\x1b[36m%s\x1b[0m', '[INFO]', ...message);
    },
    error: (...args) => {
        const message = args.map(arg => 
            typeof arg === 'string' ? arg : JSON.stringify(arg)
        );
        console.error('\x1b[31m%s\x1b[0m', '[ERROR]', ...message);
    },
    debug: (...args) => {
        if (!isDevelopment) return; // N'affiche les logs debug qu'en mode development
        const message = args.map(arg => 
            typeof arg === 'string' ? arg : JSON.stringify(arg)
        );
        console.log('\x1b[33m%s\x1b[0m', '[DEBUG]', ...message);
    }
};

module.exports = log;
