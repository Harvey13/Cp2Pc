const isDev = process.env.NODE_ENV === 'development';

const config = {
    development: isDev,
    port: 3000,
    devTools: isDev,
    debug: isDev,
    logLevel: isDev ? 'debug' : 'info'
};

module.exports = config;
