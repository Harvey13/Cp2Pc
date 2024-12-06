import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';

export default function FolderList({ onFolderSelect }) {
  const [currentPath, setCurrentPath] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        setHasPermission(true);
        // Commencer avec le répertoire de téléchargements
        const dir = FileSystem.documentDirectory;
        setCurrentPath(dir);
        loadDirectory(dir);
      } else {
        setError('Permission d\'accès aux fichiers refusée');
      }
    } catch (err) {
      console.error('Error requesting permissions:', err);
      setError('Erreur lors de la demande de permissions');
    }
  };

  const loadDirectory = async (path) => {
    try {
      if (!path) return;

      const result = await FileSystem.readDirectoryAsync(path);
      const itemsWithInfo = await Promise.all(
        result.map(async (name) => {
          try {
            const fullPath = path + name;
            const info = await FileSystem.getInfoAsync(fullPath);
            return {
              name,
              path: fullPath,
              isDirectory: info.isDirectory || false,
              size: info.size || 0,
            };
          } catch (err) {
            console.warn(`Impossible de lire les infos pour ${name}:`, err);
            return null;
          }
        })
      );

      // Filtrer les éléments null et trier
      const validItems = itemsWithInfo
        .filter(item => item !== null)
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

      setItems(validItems);
      setError(null);
    } catch (err) {
      console.error('Error reading directory:', err);
      setError('Erreur lors de la lecture du dossier');
      setItems([]);
    }
  };

  const navigateUp = () => {
    if (!currentPath || currentPath === FileSystem.documentDirectory) return;
    const parentPath = currentPath.slice(0, currentPath.slice(0, -1).lastIndexOf('/') + 1);
    setCurrentPath(parentPath);
    loadDirectory(parentPath);
  };

  const navigateToFolder = (path) => {
    const newPath = path.endsWith('/') ? path : path + '/';
    setCurrentPath(newPath);
    loadDirectory(newPath);
  };

  if (!hasPermission) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>
          Veuillez autoriser l'accès aux fichiers pour continuer
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={requestPermissions}
        >
          <Text style={styles.retryText}>Autoriser l'accès</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => loadDirectory(currentPath)}
        >
          <Text style={styles.retryText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.upButton}
        onPress={navigateUp}
        disabled={!currentPath || currentPath === FileSystem.documentDirectory}
      >
        <Ionicons name="arrow-up" size={24} color="#2196F3" />
        <Text style={styles.upButtonText}>Dossier parent</Text>
      </TouchableOpacity>

      <FlatList
        data={items}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => {
              if (item.isDirectory) {
                navigateToFolder(item.path);
              } else {
                onFolderSelect(item.path);
              }
            }}
          >
            <Ionicons
              name={item.isDirectory ? 'folder' : 'document'}
              size={24}
              color={item.isDirectory ? '#FFC107' : '#2196F3'}
            />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              {!item.isDirectory && (
                <Text style={styles.itemSize}>
                  {(item.size / 1024).toFixed(1)} KB
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.path}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  messageText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
    color: '#666',
  },
  upButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  upButtonText: {
    marginLeft: 10,
    color: '#2196F3',
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemInfo: {
    marginLeft: 15,
    flex: 1,
  },
  itemName: {
    fontSize: 16,
  },
  itemSize: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  errorText: {
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
  },
});
