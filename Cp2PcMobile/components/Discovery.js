import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import useDiscovery from '../utils/discovery';
import ProgressWheel from './ProgressWheel';

const Discovery = () => {
    const { state, message, scanProgress, startDiscovery } = useDiscovery();

    // Démarrer la découverte au montage du composant
    React.useEffect(() => {
        startDiscovery();
    }, []);

    return (
        <View style={styles.container}>
            <ProgressWheel progress={scanProgress} size={120} />
            <Text style={styles.message}>{message}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    message: {
        marginTop: 20,
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
    },
});

export default Discovery;
