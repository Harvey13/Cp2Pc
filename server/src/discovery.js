const os = require('os');

class ServiceDiscovery {
    constructor(serverPort) {
        this.serverPort = serverPort;
    }

    start() {
        console.log('Discovery service started on port', this.serverPort);
    }

    stop() {
        console.log('Discovery service stopped');
    }

    getHostname() {
        return os.hostname();
    }
}

module.exports = { ServiceDiscovery };
