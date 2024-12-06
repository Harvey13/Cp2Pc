import { useState } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

export function Collapsible({ title, children }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <ThemedView style={styles.container}>
      <Pressable onPress={() => setIsExpanded(!isExpanded)} style={styles.header}>
        <ThemedText type="subtitle">{title}</ThemedText>
        <IconSymbol
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color="gray"
        />
      </Pressable>
      {isExpanded && <ThemedView style={styles.content}>{children}</ThemedView>}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  content: {
    padding: 16,
    paddingTop: 0,
  },
});
