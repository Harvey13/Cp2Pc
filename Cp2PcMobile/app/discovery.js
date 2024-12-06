import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import useDiscovery, { DISCOVERY_STATES } from '../utils/discovery';

export default function DiscoveryScreen() {
    const { state, serverAddress, serverName, serverIP, message } = useDiscovery();

    const getStatusColor = () => {
        switch (state) {
            case DISCOVERY_STATES.SERVER_FOUND:
                return '#4CAF50'; // Vert
            case DISCOVERY_STATES.SCANNING:
                return '#FFA500'; // Orange
            case DISCOVERY_STATES.NO_SERVER:
            case DISCOVERY_STATES.ERROR:
                return '#f44336'; // Rouge
            default:
                return '#666'; // Gris
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Cp2Pc Mobile</Text>
            
            <View style={styles.statusContainer}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                <Text style={styles.statusText}>{message}</Text>
            </View>
            
            {state === DISCOVERY_STATES.SERVER_FOUND && (
                <View style={styles.serverInfo}>
                    <Text style={styles.checkmark}>✓</Text>
                    <Text style={styles.serverName}>{serverName}</Text>
                    <Text style={styles.serverAddress}>{serverIP}</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#fff'
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FF5722',
        marginBottom: 40
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 10
    },
    statusText: {
        fontSize: 16,
        color: '#666'
    },
    serverInfo: {
        alignItems: 'center'
    },
    checkmark: {
        fontSize: 48,
        color: '#4CAF50',
        marginBottom: 20
    },
    serverName: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10
    },
    serverAddress: {
        fontSize: 16,
        color: '#666'
    }
});
