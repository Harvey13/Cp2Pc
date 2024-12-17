const log_cli = (message, data) => {
    console.log(`[${new Date().toISOString()}][INFO] ${message}`, data);
};

const log_dev = (message, data) => {
    console.debug(`[${new Date().toISOString()}][DEBUG] ${message}`, data);
};

module.exports = { log_cli, log_dev };
