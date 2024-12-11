import { useState, useEffect, useCallback, useRef } from 'react';
import * as Network from 'expo-network';
import * as Device from 'expo-device';

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
    MAX_REMEMBERED_IPS: 5 // Nombre maximum d'IPs à sauvegarder
};

const MESSAGES = {
    SCANNING: 'Recherche du serveur...',
    SERVER_FOUND: (name, ip) => `Connecté à ${name}\n(${ip})`,
    NO_SERVER: 'Aucun serveur trouvé.\nNouvelle tentative dans 3s...',
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
        this.deviceInfo = null;
        
        // Liste des dernières IPs serveur trouvées (dernier octet uniquement)
        this.lastFoundIPs = [];
        try {
            const saved = localStorage.getItem('lastFoundIPs');
            if (saved) {
                this.lastFoundIPs = JSON.parse(saved);
            }
        } catch (error) {
            console.log('[Discovery] Error loading last IPs:', error);
        }

        // Démarrer le scan immédiatement
        this.scanNetwork();
    }

    // Sauvegarder une nouvelle IP trouvée
    saveFoundIP(ip) {
        const lastOctet = parseInt(ip.split('.').pop());
        if (!this.lastFoundIPs.includes(lastOctet)) {
            this.lastFoundIPs.unshift(lastOctet);
            // Garder seulement les N dernières IPs
            this.lastFoundIPs = this.lastFoundIPs.slice(0, CONFIG.MAX_REMEMBERED_IPS);
            // Sauvegarder dans le localStorage
            try {
                localStorage.setItem('lastFoundIPs', JSON.stringify(this.lastFoundIPs));
            } catch (error) {
                console.log('[Discovery] Error saving last IPs:', error);
            }
        }
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
                if (global.socket) {
                    global.socket.emit('mobile-connect', this.deviceInfo);
                }
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
            console.log('[Discovery] Checking network connection...');
            const networkState = await Network.getNetworkStateAsync();
            if (!networkState.isConnected || networkState.type !== Network.NetworkStateType.WIFI) {
                console.log('[Discovery] No WiFi connection');
                this.setState(DISCOVERY_STATES.ERROR);
                this.scheduleRetry();
                return;
            }
            console.log('[Discovery] WiFi connected');

            // Obtenir l'adresse IP de base
            const baseIP = await this.getLocalIPBase();
            if (!baseIP) {
                console.log('[Discovery] Could not get base IP');
                this.setState(DISCOVERY_STATES.ERROR);
                this.scheduleRetry();
                return;
            }
            console.log('[Discovery] Base IP:', baseIP);

            console.log('[Discovery] Starting network scan...');
            this.setState(DISCOVERY_STATES.SCANNING);
            this.bScanning = true;

            // 1. Scanner d'abord les dernières IPs où un serveur a été trouvé
            if (this.lastFoundIPs.length > 0) {
                console.log('[Discovery] Scanning last known server IPs:', this.lastFoundIPs);
                const lastIPsPromises = this.lastFoundIPs.map(lastOctet => {
                    const ip = `${baseIP}.${lastOctet}`;
                    return this.checkServer(ip);
                });

                const lastIPsResults = await Promise.all(lastIPsPromises);
                const foundLastIP = lastIPsResults.find(r => r.found);
                if (foundLastIP) {
                    console.log('[Discovery] Server found on last known IP:', foundLastIP);
                    this.serverAddress = foundLastIP.ip;
                    this.serverName = foundLastIP.pcName;
                    this.serverIP = foundLastIP.pcIP;
                    this.deviceInfo = foundLastIP.deviceInfo;
                    this.saveFoundIP(foundLastIP.ip);
                    this.bScanning = false;
                    this.setState(DISCOVERY_STATES.SERVER_FOUND);
                    return;
                }
                console.log('[Discovery] No server found on last known IPs');
            }

            // 2. Scanner le reste des IPs par batch si rien trouvé
            console.log('[Discovery] Starting full network scan...');
            const remainingIPs = Array.from({length: 255}, (_, i) => i + 1)
                .filter(i => !this.lastFoundIPs.includes(i));

            for (let i = 0; i < remainingIPs.length && this.bScanning; i += CONFIG.BATCH_SIZE) {
                const batch = remainingIPs.slice(i, i + CONFIG.BATCH_SIZE);
                const batchNumber = Math.floor(i/CONFIG.BATCH_SIZE) + 1;
                const totalBatches = Math.ceil(remainingIPs.length/CONFIG.BATCH_SIZE);
                console.log(`[Discovery] Scanning batch ${batchNumber}/${totalBatches} (IPs ${batch[0]}-${batch[batch.length-1]})`);

                const promises = batch.map(n => {
                    const ip = `${baseIP}.${n}`;
                    return this.checkServer(ip);
                });

                const results = await Promise.all(promises);
                const found = results.find(r => r.found);
                
                if (found) {
                    console.log('[Discovery] Server found:', found);
                    this.serverAddress = found.ip;
                    this.serverName = found.pcName;
                    this.serverIP = found.pcIP;
                    this.deviceInfo = found.deviceInfo;
                    this.saveFoundIP(found.ip);
                    this.bScanning = false;
                    this.setState(DISCOVERY_STATES.SERVER_FOUND);
                    return;
                }
            }

            // Si on arrive ici et qu'on scanne toujours, c'est qu'on n'a rien trouvé
            if (this.bScanning) {
                console.log('[Discovery] No server found');
                this.setState(DISCOVERY_STATES.NO_SERVER);
                this.scheduleRetry();
            }

        } catch (error) {
            console.error('[Discovery] Error:', error);
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
                    'Accept': 'application/json',
                    'X-Device-Name': Device.deviceName || 'Unknown Device',
                    'X-Device-Id': Device.deviceName + '_' + Device.modelName
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.log(`[Discovery] ${ip} not responding (${response.status})`);
                return { found: false, ip: ip };
            }

            const data = await response.json();
            console.log(`[Discovery] Server found at ${ip}:`, data);

            // Stocker les informations du device
            const deviceInfo = {
                deviceId: Device.deviceName + '_' + Device.modelName,
                deviceName: Device.deviceName || 'Unknown Device'
            };

            return {
                found: true,
                ip: ip,
                pcName: data.name || 'Unknown',
                pcIP: data.ip || ip,
                deviceInfo: deviceInfo
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`[Discovery] ${ip} timeout`);
            } else {
                console.log(`[Discovery] ${ip} error:`, error.message);
            }
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

    async startKeepalive() {
        // Arrêter l'ancien keepalive s'il existe
        this.stopKeepalive();

        const sendPing = async () => {
            if (!this.serverAddress) {
                console.log('[Discovery] No server address for ping');
                return;
            }

            try {
                console.log(`[Discovery] Sending ping to ${this.serverAddress}:${CONFIG.PORT}`);
                const startTime = Date.now();
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000); // Timeout de 2s

                const response = await fetch(`http://${this.serverAddress}:${CONFIG.PORT}/ping`, {
                    headers: {
                        'Accept': 'application/json',
                        'X-Device-Name': Device.deviceName || 'Unknown Device',
                        'X-Device-Id': Device.deviceName + '_' + Device.modelName
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    console.log('[Discovery] Keepalive failed - server not responding');
                    this.handleServerLost();
                    return;
                }

                const data = await response.json();
                const pingTime = Date.now() - startTime;
                console.log(`[Discovery] Ping response received in ${pingTime}ms:`, data);

                // Planifier le prochain ping seulement si la connexion est toujours active
                if (this.keepaliveInterval) {
                    this.keepaliveInterval = setTimeout(sendPing, CONFIG.KEEPALIVE_INTERVAL);
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.log('[Discovery] Keepalive timeout - server not responding');
                } else {
                    console.log('[Discovery] Keepalive failed:', error.message);
                }
                this.handleServerLost();
            }
        };

        // Démarrer le premier ping
        this.keepaliveInterval = setTimeout(sendPing, 0);
    }

    stopKeepalive() {
        if (this.keepaliveInterval) {
            clearTimeout(this.keepaliveInterval);
            this.keepaliveInterval = null;
        }
    }

    handleServerLost() {
        console.log('[Discovery] Connexion au serveur perdue');
        this.stopKeepalive();
        this.serverAddress = null;
        this.serverName = null;
        this.serverIP = null;
        this.deviceInfo = null;
        this.message = MESSAGES.NO_SERVER;
        this.setState(DISCOVERY_STATES.NO_SERVER);
        this.notifyObservers();  // Notifier les observers pour mettre à jour l'IHM
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
    getDeviceInfo() { return this.deviceInfo; }
    getMessage() { return this.message; }
}

const useDiscovery = () => {
    const [discoveryState, setDiscoveryState] = useState(DISCOVERY_STATES.SCANNING);
    const [serverAddress, setServerAddress] = useState(null);
    const [serverName, setServerName] = useState(null);
    const [serverIP, setServerIP] = useState(null);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(MESSAGES.SCANNING);
    const [deviceInfo, setDeviceInfo] = useState(null);
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
            setDeviceInfo(discovery.getDeviceInfo());
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
        deviceInfo,
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
