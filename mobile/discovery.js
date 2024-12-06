const { NetworkInfo } = require('@react-native-community/netinfo');

// États simplifiés de la machine d'état
const DISCOVERY_STATES = {
    SCANNING: 'SCANNING',     // Scan en cours des 255 adresses
    NO_SERVER: 'NO_SERVER',   // Aucun serveur trouvé, attente avant nouveau scan
    SERVER_FOUND: 'FOUND',    // Serveur trouvé
    ERROR: 'ERROR'           // Erreur réseau
};

class ServerDiscovery {
    constructor() {
        // On démarre directement en mode SCANNING
        this.currentState = DISCOVERY_STATES.SCANNING;
        this.bScanning = true; // Démarre le scan immédiatement
        this.serverAddress = null;
        this.serverName = null;     // Ajout du nom du serveur
        this.serverIP = null;       // Ajout de l'IP du serveur
        this.retryTimeout = null;
        this.observers = new Set();

        // Démarrer le scan immédiatement
        this.scanNetwork();
    }

    // Gestion des observateurs
    addStateObserver(callback) {
        this.observers.add(callback);
        callback(this.currentState);
    }

    removeStateObserver(callback) {
        this.observers.delete(callback);
    }

    notifyStateChange() {
        this.observers.forEach(callback => callback(this.currentState));
    }

    setState(newState) {
        this.currentState = newState;
        this.notifyStateChange();
    }

    // Scan du réseau local
    async scanNetwork() {
        try {
            // Vérifier la connexion réseau
            const netInfo = await NetworkInfo.fetch();
            if (!netInfo.isConnected || !netInfo.isWifiEnabled) {
                this.setState(DISCOVERY_STATES.ERROR);
                this.scheduleRetry();
                return;
            }

            // Obtenir l'adresse IP locale
            const baseIP = await this.getLocalIPBase();
            if (!baseIP) {
                this.setState(DISCOVERY_STATES.ERROR);
                this.scheduleRetry();
                return;
            }

            this.setState(DISCOVERY_STATES.SCANNING);
            this.bScanning = true;
            
            // Scanner les 255 adresses possibles
            for (let i = 1; i <= 255 && this.bScanning; i++) {
                const ip = `${baseIP}.${i}`;
                const found = await this.checkServer(ip);
                
                if (found) {
                    this.serverAddress = ip;
                    this.bScanning = false;
                    this.setState(DISCOVERY_STATES.SERVER_FOUND);
                    return;
                }
            }

            // Si on arrive ici, aucun serveur n'a été trouvé
            if (this.bScanning) {
                this.setState(DISCOVERY_STATES.NO_SERVER);
                this.scheduleRetry();
            }

        } catch (error) {
            console.error('Scan error:', error);
            this.setState(DISCOVERY_STATES.ERROR);
            this.scheduleRetry();
        }
    }

    // Planifie une nouvelle tentative après 3 secondes
    scheduleRetry() {
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
        }
        
        this.retryTimeout = setTimeout(() => {
            if (this.currentState !== DISCOVERY_STATES.SERVER_FOUND) {
                this.bScanning = true;
                this.scanNetwork();
            }
        }, 3000);
    }

    // Vérifie si un serveur est présent à l'adresse donnée
    async checkServer(ip) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 500);

            const response = await fetch(`http://${ip}:3000/ping`, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                // Stocker les informations du serveur
                this.serverName = data.name;
                this.serverIP = data.ip;
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    // Obtient la base de l'adresse IP locale
    async getLocalIPBase() {
        try {
            const netInfo = await NetworkInfo.fetch();
            if (!netInfo.details?.ipAddress) {
                return null;
            }
            const ipParts = netInfo.details.ipAddress.split('.');
            return ipParts.slice(0, 3).join('.');
        } catch (error) {
            console.error('Error getting local IP:', error);
            return null;
        }
    }

    // Arrête le processus de découverte
    stopDiscovery() {
        this.bScanning = false;
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }
    }

    // Getters
    getCurrentState() { return this.currentState; }
    isScanning() { return this.bScanning; }
    getServerAddress() { return this.serverAddress; }
    getServerName() { return this.serverName; }    // Nouveau getter
    getServerIP() { return this.serverIP; }        // Nouveau getter
}

module.exports = {
    DISCOVERY_STATES,
    ServerDiscovery
};
