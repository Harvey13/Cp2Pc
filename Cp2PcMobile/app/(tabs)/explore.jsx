import { StyleSheet } from 'react-native';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import useDiscovery from '@/utils/discovery';

export default function ExploreScreen() {
  const { state, serverAddress } = useDiscovery();

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="folder-open"
          style={styles.headerImage}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">File Explorer</ThemedText>
      </ThemedView>

      {state === 'CONNECTED' && serverAddress ? (
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="subtitle">Connected to PC</ThemedText>
          <ThemedText>Browse and manage your PC files here.</ThemedText>
          {/* TODO: Add file browser component */}
        </ThemedView>
      ) : (
        <ThemedView style={styles.contentContainer}>
          <ThemedText type="subtitle">Not Connected</ThemedText>
          <ThemedText>
            Please connect to a PC using the Transfer tab before browsing files.
          </ThemedText>
        </ThemedView>
      )}
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    opacity: 0.2,
  },
  titleContainer: {
    padding: 20,
  },
  contentContainer: {
    padding: 20,
    gap: 10,
  },
});
