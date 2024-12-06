import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useDiscovery } from '../../utils/discovery';
import { Card, Button, Icon, ProgressCircle } from '@rneui/themed';
import MappingProgress from '../../components/MappingProgress';

const StatusLED = ({ state }) => {
    let color;
    switch (state) {
        case 'CONNECTED':
            color = '#4CAF50'; // Vert
            break;
        case 'SCANNING':
            color = '#2196F3'; // Bleu
            break;
        case 'WAITING':
            color = '#FFA000'; // Orange
            break;
        case 'ERROR':
            color = '#F44336'; // Rouge
            break;
        default:
            color = '#9E9E9E'; // Gris
    }

    return (
        <View style={[styles.led, { backgroundColor: color }]}>
            <View style={styles.ledGlow} />
        </View>
    );
};

export default function TransferScreen() {
    const { state, serverAddress, error, scanProgress, startDiscovery } = useDiscovery();
    const [serverInfo, setServerInfo] = useState(null);

    // Gérer l'affichage du statut
    const renderStatus = () => {
        switch (state) {
            case 'SCANNING':
                return (
                    <View style={styles.statusContainer}>
                        <View style={styles.statusHeader}>
                            <StatusLED state={state} />
                            <Text style={styles.statusTitle}>Recherche en cours</Text>
                        </View>
                        <ProgressCircle
                            value={scanProgress / 100}
                            size={100}
                            thickness={5}
                            color="#2089dc"
                            unfilledColor="#ededed"
                            showText
                            textStyle={styles.progressText}
                            animated
                        />
                        <Text style={styles.statusText}>
                            Scan des adresses {Math.floor((scanProgress / 100) * 255)}/255
                        </Text>
                    </View>
                );

            case 'CONNECTED':
                return (
                    <View style={styles.statusContainer}>
                        <View style={styles.statusHeader}>
                            <StatusLED state={state} />
                            <Text style={styles.statusTitle}>Connecté</Text>
                        </View>
                        <Icon
                            name="check-circle"
                            type="font-awesome"
                            size={50}
                            color="#4CAF50"
                        />
                        <Text style={styles.statusText}>
                            PC trouvé !
                        </Text>
                        <Text style={styles.serverInfo}>
                            {serverInfo?.computerName || 'PC'} ({serverAddress})
                        </Text>
                    </View>
                );

            case 'WAITING':
                return (
                    <View style={styles.statusContainer}>
                        <View style={styles.statusHeader}>
                            <StatusLED state={state} />
                            <Text style={styles.statusTitle}>En attente</Text>
                        </View>
                        <Icon
                            name="clock-o"
                            type="font-awesome"
                            size={50}
                            color="#FFA000"
                        />
                        <Text style={styles.statusText}>
                            Nouvelle tentative dans quelques secondes
                        </Text>
                    </View>
                );

            case 'ERROR':
                return (
                    <View style={styles.statusContainer}>
                        <View style={styles.statusHeader}>
                            <StatusLED state={state} />
                            <Text style={styles.statusTitle}>Erreur</Text>
                        </View>
                        <Icon
                            name="exclamation-circle"
                            type="font-awesome"
                            size={50}
                            color="#F44336"
                        />
                        <Text style={styles.errorText}>
                            {error || 'Une erreur est survenue'}
                        </Text>
                        <Button
                            title="Réessayer"
                            onPress={startDiscovery}
                            buttonStyle={styles.retryButton}
                        />
                    </View>
                );

            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            <Card containerStyle={styles.card}>
                <Card.Title>État de la connexion</Card.Title>
                <Card.Divider />
                {renderStatus()}
            </Card>

            <ScrollView style={styles.mappingsContainer}>
                <MappingProgress
                    title="Documents"
                    sourcePath="/storage/emulated/0/Documents"
                    destPath="C:/Users/User/Documents"
                    progress={75}
                    totalFiles={100}
                    copiedFiles={75}
                />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    card: {
        margin: 15,
        borderRadius: 10,
        elevation: 3,
    },
    statusContainer: {
        alignItems: 'center',
        padding: 20,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        width: '100%',
    },
    statusTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    led: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#4CAF50',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    ledGlow: {
        position: 'absolute',
        width: '140%',
        height: '140%',
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        opacity: 0.5,
    },
    statusText: {
        fontSize: 16,
        marginTop: 15,
        textAlign: 'center',
    },
    subStatusText: {
        fontSize: 14,
        color: '#666',
        marginTop: 5,
        textAlign: 'center',
    },
    serverInfo: {
        fontSize: 16,
        color: '#2089dc',
        marginTop: 5,
        textAlign: 'center',
    },
    errorText: {
        color: '#F44336',
        marginTop: 5,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 15,
        paddingHorizontal: 30,
        borderRadius: 20,
    },
    progressText: {
        fontSize: 16,
        color: '#2089dc',
    },
    mappingsContainer: {
        flex: 1,
        padding: 15,
    },
});
