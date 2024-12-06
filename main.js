const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const log = require('./server/utils/logger');
const express = require('express');
const server = require('./server/server');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Charge le fichier HTML directement depuis le système de fichiers
    mainWindow.loadFile(path.join(__dirname, 'server', 'public', 'index.html'));

    // Ouvre les outils de développement en mode développement
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Gestion des événements de l'application
app.on('ready', () => {
    createWindow();
    server.start();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// Gestion de la sélection de dossiers
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.filePaths[0];
});
