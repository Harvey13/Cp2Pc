import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FolderList from './components/FolderList';
import { useDiscovery } from './utils/discovery';
import * as Device from 'expo-device';

export default function App() {
  const { socket, isConnected, error, startDiscovery } = useDiscovery();
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);

  // Gestionnaire pour les dossiers mobiles
  React.useEffect(() => {
    if (socket) {
      console.log('📱 Mobile: Socket initialisé');
      
      // Annoncer la connexion
      socket.emit('mobile-connect', {
        deviceId: Device.deviceName + '_' + Device.modelName,
        deviceName: Device.deviceName || 'Unknown Device'
      });
      console.log('📱 Mobile: Envoi mobile-connect avec infos device');

      // Log tous les événements reçus
      const originalOn = socket.on;
      socket.on = function(event, ...args) {
        console.log(`[DEBUG] Socket.on enregistré pour l'événement: ${event}`);
        return originalOn.call(this, event, ...args);
      };

      // Log tous les événements émis
      const originalEmit = socket.emit;
      socket.emit = function(event, ...args) {
        console.log(`[DEBUG] Socket.emit appelé pour l'événement: ${event}`, args);
        return originalEmit.apply(this, arguments);
      };

      socket.on('connect', () => {
        console.log('📱 Mobile: Connecté au serveur, ID:', socket.id);
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ Mobile: Déconnecté du serveur');
      });

      socket.on('error', (error) => {
        console.error('[DEBUG] Erreur socket:', error);
      });

      // Gestion du redémarrage du scan
      socket.on('restart-scan', () => {
        console.log('[DEBUG] Redémarrage du scan demandé');
        startDiscovery();
      });

      socket.on('request-mobile-folders', async ({ mappingId }) => {
        console.log('[DEBUG] Demande de liste des dossiers reçue pour mapping:', mappingId);
        try {
          // TODO: Utiliser expo-file-system pour obtenir la vraie liste des dossiers
          const folders = [
            '/storage/emulated/0/DCIM/Camera',
            '/storage/emulated/0/Pictures',
            '/storage/emulated/0/Download',
            '/storage/emulated/0/Documents'
          ];
          
          console.log('[DEBUG] Envoi de la liste des dossiers:', folders);
          socket.emit('mobile-folders-list', { 
            mappingId,
            folders 
          });
        } catch (error) {
          console.error('[DEBUG] Erreur lors de la liste des dossiers:', error);
          socket.emit('mobile-folder-error', {
            mappingId,
            error: error.message
          });
        }
      });

      // Gestion des événements socket
      socket.on('list-mobile-folders', async ({ mappingId }) => {
        console.log('📱 Demande de liste des dossiers reçue pour le mapping:', mappingId);
        try {
          // Liste des dossiers standards Android
          const folders = [
            'DCIM/Camera',
            'Pictures',
            'Download',
            'Documents'
          ];

          // Envoyer la liste au serveur
          socket.emit('mobile-folders-list', {
            mappingId,
            folders
          });
          
        } catch (error) {
          console.error('❌ Erreur lors de la liste des dossiers:', error);
        }
      });

      socket.on('mobile-echo', (data) => {
        console.log('📱 Mobile: Echo reçu:', data);
        socket.emit('mobile-echo-response', data);
        console.log('📱 Mobile: Echo renvoyé');
      });
    }
  }, [socket, startDiscovery]);

  const handleFolderSelect = async (path) => {
    console.log('[DEBUG] Sélection du dossier:', path);
    setSelectedFolder(path);
    setShowFolderPicker(false);
    
    if (socket) {
      console.log('[DEBUG] Envoi de la sélection du dossier au serveur');
      socket.emit('folder-selected', { path });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cp2Pc Mobile</Text>
        <View style={[styles.statusDot, { backgroundColor: isConnected ? '#4CAF50' : '#f44336' }]} />
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={startDiscovery}
          >
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity 
        style={styles.button}
        onPress={() => setShowFolderPicker(true)}
      >
        <Text style={styles.buttonText}>Sélectionner un dossier</Text>
      </TouchableOpacity>

      {selectedFolder && (
        <View style={styles.selectedFolder}>
          <Text style={styles.selectedFolderText}>Sélectionné : {selectedFolder}</Text>
        </View>
      )}

      <Modal
        visible={showFolderPicker}
        animationType="slide"
        onRequestClose={() => setShowFolderPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sélectionner un dossier</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowFolderPicker(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <FolderList onFolderSelect={handleFolderSelect} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectedFolder: {
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
  },
  selectedFolderText: {
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  errorContainer: {
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
  },
  retryButton: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
