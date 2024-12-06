import { useState, useEffect, useCallback, useRef } from 'react';
import * as Network from 'expo-network';

// États de la machine d'état
const DISCOVERY_STATES = {
    SCANNING: 'SCANNING',     // Scan en cours (bScanning = true)
    SERVER_FOUND: 'FOUND',    // Serveur trouvé (bScanning = false)
    NO_SERVER: 'NO_SERVER',   // Aucun serveur trouvé (retry dans 3s)
    ERROR: 'ERROR'           // Erreur réseau (retry dans 3s)
};

// Configuration
const CONFIG = {
    PORT: 3000,
    SCAN_TIMEOUT: 100,     // 100ms timeout
    BATCH_SIZE: 10,        // Batch plus petit pour les prioritaires
    RETRY_DELAY: 3000,     // 3s entre les retries
    KEEPALIVE_INTERVAL: 1000, // 1s entre les keepalive
    PRIORITY_IPS: [1, 2, 100, 101, 102, 150, 151, 152, 200, 201, 202, 254, 255] // IPs prioritaires
};

const MESSAGES = {
    SCANNING: 'Recherche du serveur...',
    SERVER_FOUND: (name, ip) => `Connecté à ${name} (${ip})`,
    NO_SERVER: 'Aucun serveur trouvé. Nouvelle tentative dans 3s...',
    ERROR: 'Erreur réseau. Nouvelle tentative dans 3s...'
};

class ServerDiscovery {
    constructor() {
        // Démarrer directement en SCANNING
        this.currentState = DISCOVERY_STATES.SCANNING;
        this.bScanning = true;
        this.serverAddress = null;
        this.serverName = null;
        this.serverIP = null;
        this.retryTimeout = null;
        this.keepaliveInterval = null;
        this.observers = new Set();
        this.message = MESSAGES.SCANNING;

        // Démarrer le scan immédiatement
        this.scanNetwork();
    }

    setState(newState) {
        console.log('[Discovery] Nouvel état:', newState);
        this.currentState = newState;

        // Mettre à jour le message
        switch (newState) {
            case DISCOVERY_STATES.SCANNING:
                this.message = MESSAGES.SCANNING;
                break;
            case DISCOVERY_STATES.SERVER_FOUND:
                this.message = MESSAGES.SERVER_FOUND(this.serverName, this.serverIP);
                this.startKeepalive();
                break;
            case DISCOVERY_STATES.NO_SERVER:
                this.message = MESSAGES.NO_SERVER;
                this.stopKeepalive();
                break;
            case DISCOVERY_STATES.ERROR:
                this.message = MESSAGES.ERROR;
                this.stopKeepalive();
                break;
        }

        // Démarrer ou arrêter le keepalive selon l'état
        if (newState === DISCOVERY_STATES.SERVER_FOUND) {
            this.startKeepalive();
        } else {
            this.stopKeepalive();
        }

        // Notifier les observers
        this.notifyObservers();
    }

    notifyObservers() {
        this.observers.forEach(observer => observer(this.currentState));
    }

    addObserver(observer) {
        this.observers.add(observer);
        observer(this.currentState);
    }

    removeObserver(observer) {
        this.observers.delete(observer);
    }

    async scanNetwork() {
        try {
            // Vérifier la connexion réseau
            const networkState = await Network.getNetworkStateAsync();
            if (!networkState.isConnected || networkState.type !== Network.NetworkStateType.WIFI) {
                console.log('[Discovery] Pas de connexion WiFi');
                this.setState(DISCOVERY_STATES.ERROR);
                this.scheduleRetry();
                return;
            }

            // Obtenir l'adresse IP de base
            const baseIP = await this.getLocalIPBase();
            if (!baseIP) {
                console.log('[Discovery] Impossible d\'obtenir l\'IP de base');
                this.setState(DISCOVERY_STATES.ERROR);
                this.scheduleRetry();
                return;
            }

            console.log('[Discovery] Début du scan sur', baseIP);
            this.setState(DISCOVERY_STATES.SCANNING);
            this.bScanning = true;

            // 1. Scanner d'abord les IPs prioritaires
            console.log('[Discovery] Scan des IPs prioritaires...');
            const priorityPromises = CONFIG.PRIORITY_IPS.map(i => {
                const ip = `${baseIP}.${i}`;
                return this.checkServer(ip);
            });

            const priorityResults = await Promise.all(priorityPromises);
            const foundPriority = priorityResults.find(r => r.found);
            if (foundPriority) {
                console.log('[Discovery] Serveur trouvé sur IP prioritaire:', foundPriority.ip);
                this.serverAddress = foundPriority.ip;
                this.serverName = foundPriority.pcName;
                this.serverIP = foundPriority.pcIP;
                this.bScanning = false;
                this.setState(DISCOVERY_STATES.SERVER_FOUND);
                return;
            }

            // 2. Scanner le reste des IPs par batch si rien trouvé
            console.log('[Discovery] Scan des IPs restantes...');
            const remainingIPs = Array.from({length: 255}, (_, i) => i + 1)
                .filter(i => !CONFIG.PRIORITY_IPS.includes(i));

            for (let i = 0; i < remainingIPs.length && this.bScanning; i += CONFIG.BATCH_SIZE) {
                const batch = remainingIPs.slice(i, i + CONFIG.BATCH_SIZE);
                console.log(`[Discovery] Batch ${i/CONFIG.BATCH_SIZE + 1}/${Math.ceil(remainingIPs.length/CONFIG.BATCH_SIZE)}`);

                const promises = batch.map(n => {
                    const ip = `${baseIP}.${n}`;
                    return this.checkServer(ip);
                });

                const results = await Promise.all(promises);
                const found = results.find(r => r.found);
                
                if (found) {
                    console.log('[Discovery] Serveur trouvé:', found.ip);
                    this.serverAddress = found.ip;
                    this.serverName = found.pcName;
                    this.serverIP = found.pcIP;
                    this.bScanning = false;
                    this.setState(DISCOVERY_STATES.SERVER_FOUND);
                    return;
                }
            }

            // Si on arrive ici et qu'on scanne toujours, c'est qu'on n'a rien trouvé
            if (this.bScanning) {
                console.log('[Discovery] Aucun serveur trouvé');
                this.setState(DISCOVERY_STATES.NO_SERVER);
                this.scheduleRetry();
            }

        } catch (error) {
            console.error('[Discovery] Erreur:', error);
            this.setState(DISCOVERY_STATES.ERROR);
            this.scheduleRetry();
        }
    }

    scheduleRetry() {
        // Annuler tout retry précédent
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
        }

        console.log('[Discovery] Nouveau scan dans 3s');
        // Programmer un nouveau scan dans 3 secondes
        this.retryTimeout = setTimeout(() => {
            if (this.currentState !== DISCOVERY_STATES.SERVER_FOUND) {
                this.scanNetwork();
            }
        }, CONFIG.RETRY_DELAY);
    }

    async checkServer(ip) {
        try {
            console.log(`[Discovery] Testing ${ip}...`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.SCAN_TIMEOUT);

            const response = await fetch(`http://${ip}:${CONFIG.PORT}/ping`, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                return { found: false, ip: ip };
            }

            const data = await response.json();
            console.log(`[Discovery] Réponse de ${ip}:`, data);

            return {
                found: true,
                ip: ip,
                pcName: data.name || 'Unknown',
                pcIP: data.ip || ip
            };
        } catch (error) {
            return { found: false, ip: ip };
        }
    }

    async getLocalIPBase() {
        try {
            const ip = await Network.getIpAddressAsync();
            if (!ip) {
                return null;
            }
            const ipParts = ip.split('.');
            return ipParts.slice(0, 3).join('.');
        } catch (error) {
            console.error('[Discovery] Erreur IP:', error);
            return null;
        }
    }

    stopDiscovery() {
        console.log('[Discovery] Arrêt du scan');
        this.bScanning = false;
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }
    }

    startKeepalive() {
        // Arrêter l'ancien keepalive s'il existe
        this.stopKeepalive();

        // Démarrer le nouveau keepalive
        this.keepaliveInterval = setInterval(async () => {
            try {
                const response = await fetch(`http://${this.serverAddress}:${CONFIG.PORT}/ping`, {
                    headers: { 'Accept': 'application/json' }
                });
                
                if (!response.ok) {
                    console.log('[Discovery] Keepalive failed - server not responding');
                    this.handleServerLost();
                }
            } catch (error) {
                console.log('[Discovery] Keepalive failed:', error.message);
                this.handleServerLost();
            }
        }, CONFIG.KEEPALIVE_INTERVAL);
    }

    stopKeepalive() {
        if (this.keepaliveInterval) {
            clearInterval(this.keepaliveInterval);
            this.keepaliveInterval = null;
        }
    }

    handleServerLost() {
        console.log('[Discovery] Connexion au serveur perdue');
        this.stopKeepalive();
        this.serverAddress = null;
        this.serverName = null;
        this.serverIP = null;
        this.message = MESSAGES.NO_SERVER;
        this.setState(DISCOVERY_STATES.NO_SERVER);
        this.scheduleRetry();
    }

    // Cleanup lors de la destruction
    destroy() {
        this.stopKeepalive();
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
        }
    }

    // Getters pour l'état actuel
    getCurrentState() { return this.currentState; }
    isScanning() { return this.bScanning; }
    getServerAddress() { return this.serverAddress; }
    getServerName() { return this.serverName; }
    getServerIP() { return this.serverIP; }
    getMessage() { return this.message; }
}

const useDiscovery = () => {
    const [discoveryState, setDiscoveryState] = useState(DISCOVERY_STATES.SCANNING);
    const [serverAddress, setServerAddress] = useState(null);
    const [serverName, setServerName] = useState(null);
    const [serverIP, setServerIP] = useState(null);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(MESSAGES.SCANNING);
    const discoveryRef = useRef(null);

    useEffect(() => {
        // Créer l'instance de découverte si elle n'existe pas
        if (!discoveryRef.current) {
            discoveryRef.current = new ServerDiscovery();
        }

        // Observer pour les changements d'état
        const observer = () => {
            const discovery = discoveryRef.current;
            const state = discovery.getCurrentState();
            setDiscoveryState(state);
            setServerAddress(discovery.getServerAddress());
            setServerName(discovery.getServerName());
            setServerIP(discovery.getServerIP());
            setMessage(discovery.getMessage());
        };

        discoveryRef.current.addObserver(observer);

        // Cleanup
        return () => {
            if (discoveryRef.current) {
                discoveryRef.current.removeObserver(observer);
                discoveryRef.current.destroy();
            }
        };
    }, []);

    return {
        state: discoveryState,
        serverAddress,
        serverName,
        serverIP,
        error,
        message,
        startDiscovery: () => {
            if (discoveryRef.current) {
                discoveryRef.current.scanNetwork();
            }
        }
    };
};

export {
    DISCOVERY_STATES,
    ServerDiscovery
};

export default useDiscovery;
