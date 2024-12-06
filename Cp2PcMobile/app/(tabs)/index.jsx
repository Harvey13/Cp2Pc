import { Image, StyleSheet, Platform } from 'react-native';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import useDiscovery from '@/utils/discovery';

export default function HomeScreen() {
  const { state, serverAddress, error, scanProgress, startDiscovery } = useDiscovery();

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Cp2Pc Mobile</ThemedText>
        <HelloWave />
      </ThemedView>

      <ThemedView style={styles.statusContainer}>
        <ThemedText type="subtitle">Connection Status</ThemedText>
        <ThemedText>
          State: <ThemedText type="defaultSemiBold">{state}</ThemedText>
        </ThemedText>
        {serverAddress && (
          <ThemedText>
            Server: <ThemedText type="defaultSemiBold">{serverAddress}</ThemedText>
          </ThemedText>
        )}
        {error && (
          <ThemedText style={styles.error}>
            Error: <ThemedText type="defaultSemiBold">{error}</ThemedText>
          </ThemedText>
        )}
        {state === 'SCANNING' && (
          <ThemedText>
            Progress: <ThemedText type="defaultSemiBold">{Math.round(scanProgress)}%</ThemedText>
          </ThemedText>
        )}
      </ThemedView>

      <ThemedView style={styles.actionContainer}>
        <ThemedText type="subtitle">Actions</ThemedText>
        <ThemedText type="button" onPress={startDiscovery}>
          Scan Network
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  statusContainer: {
    padding: 20,
    gap: 10,
  },
  actionContainer: {
    padding: 20,
    gap: 10,
  },
  error: {
    color: '#ff4444',
  },
  reactLogo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
  },
});
