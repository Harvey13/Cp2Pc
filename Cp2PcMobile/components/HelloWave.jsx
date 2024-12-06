import { StyleSheet } from 'react-native';
import { ThemedText } from './ThemedText';

export function HelloWave() {
  return (
    <ThemedText style={styles.wave} adjustsFontSizeToFit>
      👋
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  wave: {
    fontSize: 30,
    marginLeft: 10,
  },
});
