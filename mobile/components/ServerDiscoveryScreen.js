import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { ServerDiscovery, DISCOVERY_STATES } from '../discovery';

const ServerDiscoveryScreen = ({ onServerFound }) => {
    const [discoveryState, setDiscoveryState] = useState(DISCOVERY_STATES.SCANNING);
    const [serverDiscovery] = useState(() => new ServerDiscovery());

    useEffect(() => {
        // Initialiser la découverte
        const initDiscovery = async () => {
            // Vérifier la connexion réseau
            const netInfo = await NetInfo.fetch();
            if (!netInfo.isConnected || !netInfo.isWifiEnabled) {
                setDiscoveryState(DISCOVERY_STATES.ERROR);
                return;
            }

            // Démarrer la découverte
            serverDiscovery.startDiscovery();
        };

        // Observer les changements d'état
        const stateObserver = (newState) => {
            setDiscoveryState(newState);
            if (newState === DISCOVERY_STATES.SERVER_FOUND) {
                onServerFound(serverDiscovery.getServerAddress());
            }
        };

        // Ajouter l'observateur
        serverDiscovery.addStateObserver(stateObserver);
        initDiscovery();

        // Cleanup
        return () => {
            serverDiscovery.removeStateObserver(stateObserver);
            serverDiscovery.stopDiscovery();
        };
    }, []);

    // Rendu selon l'état
    const renderContent = () => {
        switch (discoveryState) {
            case DISCOVERY_STATES.SCANNING:
                return (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color="#0000ff" />
                        <Text style={styles.statusText}>Recherche du serveur...</Text>
                    </View>
                );

            case DISCOVERY_STATES.NO_SERVER:
                return (
                    <View style={styles.centerContainer}>
                        <Text style={styles.statusText}>Aucun serveur trouvé</Text>
                        <Text style={styles.subText}>Nouvelle tentative dans 3 secondes...</Text>
                    </View>
                );

            case DISCOVERY_STATES.SERVER_FOUND:
                return (
                    <View style={styles.centerContainer}>
                        <Text style={styles.statusText}>Serveur trouvé !</Text>
                        <Text style={styles.serverInfo}>
                            {serverDiscovery.getServerName()} ({serverDiscovery.getServerIP()})
                        </Text>
                        <Text style={styles.subText}>Connexion en cours...</Text>
                    </View>
                );

            case DISCOVERY_STATES.ERROR:
                return (
                    <View style={styles.centerContainer}>
                        <Text style={styles.errorText}>Erreur de connexion</Text>
                        <Text style={styles.subText}>Vérifiez votre connexion WiFi</Text>
                    </View>
                );

            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            {renderContent()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    statusText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 20,
        textAlign: 'center',
    },
    serverInfo: {
        fontSize: 16,
        color: '#007AFF',
        marginTop: 10,
        textAlign: 'center',
    },
    subText: {
        fontSize: 14,
        color: '#666',
        marginTop: 10,
        textAlign: 'center',
    },
    errorText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#ff0000',
        marginTop: 20,
        textAlign: 'center',
    },
});

export default ServerDiscoveryScreen;
