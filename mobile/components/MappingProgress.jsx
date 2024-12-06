import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearProgress } from '@rneui/themed';
import ThemedText from './ThemedText';

const MappingProgress = ({ title, progress, current, total }) => {
    return (
        <View style={styles.container}>
            <ThemedText style={styles.title}>{title}</ThemedText>
            <LinearProgress
                style={styles.progressBar}
                value={progress}
                variant="determinate"
                color="primary"
            />
            <View style={styles.statsContainer}>
                <ThemedText style={styles.statsText}>
                    {current} / {total} fichiers
                </ThemedText>
                <ThemedText style={styles.percentText}>
                    {Math.round(progress * 100)}%
                </ThemedText>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    progressBar: {
        height: 8,
        borderRadius: 4,
        marginBottom: 8,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statsText: {
        fontSize: 14,
        color: '#666',
    },
    percentText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2196F3',
    },
});

export default MappingProgress;
