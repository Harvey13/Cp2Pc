import SMB2 from '@marsaud/smb2';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

class SMBServer {
    constructor() {
        this.server = null;
        this.isRunning = false;
        this.shareConfig = {
            share: 'MobileFiles',
            path: FileSystem.documentDirectory,
            username: 'mobile',
            password: 'cp2pc',
        };
    }

    async start() {
        if (this.isRunning) return;

        try {
            const netInfo = await NetInfo.fetch();
            if (!netInfo.isConnected) {
                throw new Error('Pas de connexion réseau');
            }

            const ipAddress = netInfo.details?.ipAddress;
            if (!ipAddress) {
                throw new Error('Impossible d\'obtenir l\'adresse IP');
            }

            this.server = new SMB2({
                share: `\\\\${ipAddress}\\${this.shareConfig.share}`,
                domain: 'WORKGROUP',
                username: this.shareConfig.username,
                password: this.shareConfig.password,
            });

            // Configuration du partage
            await this.server.mkdir('.');
            await this.server.writeFile('.', Buffer.from(''));

            this.isRunning = true;
            console.log(`Serveur SMB démarré sur ${ipAddress}`);
            
            // Informer le serveur principal
            if (global.socket) {
                global.socket.emit('smb-share-ready', {
                    ip: ipAddress,
                    share: this.shareConfig.share,
                    username: this.shareConfig.username,
                    password: this.shareConfig.password,
                });
            }

        } catch (error) {
            console.error('Erreur lors du démarrage du serveur SMB:', error);
            throw error;
        }
    }

    async stop() {
        if (!this.isRunning) return;

        try {
            if (this.server) {
                await this.server.close();
                this.server = null;
            }
            this.isRunning = false;
            console.log('Serveur SMB arrêté');
        } catch (error) {
            console.error('Erreur lors de l\'arrêt du serveur SMB:', error);
        }
    }

    isServerRunning() {
        return this.isRunning;
    }

    getShareInfo() {
        return this.shareConfig;
    }
}

export default new SMBServer();
