import React from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

const ProgressWheel = ({ progress, size = 100, color = '#007AFF' }) => {
    // Calcul de la rotation en fonction de la progression
    const rotation = React.useMemo(() => {
        return `${progress * 3.6}deg`; // 360 degrés / 100%
    }, [progress]);

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <View style={[styles.progressCircle, { borderColor: color }]} />
            <View
                style={[
                    styles.progressArc,
                    {
                        width: size,
                        height: size,
                        transform: [{ rotate: rotation }],
                        borderColor: color,
                    },
                ]}
            />
            <View style={styles.centerContainer}>
                <FontAwesome name="search" size={size * 0.4} color={color} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressCircle: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 1000,
        borderWidth: 3,
        borderColor: '#007AFF',
    },
    progressArc: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 1000,
        borderWidth: 3,
        borderLeftColor: 'transparent',
        borderBottomColor: 'transparent',
        borderRightColor: 'transparent',
        transform: [{ rotate: '0deg' }],
    },
    centerContainer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default ProgressWheel;
