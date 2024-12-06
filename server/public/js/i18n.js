// Système de traduction
class I18nManager {
    constructor() {
        this.currentLanguage = localStorage.getItem('language') || 'fr';
        this.translations = {
            fr: {
                // États de connexion
                connected: 'Mobile connecté',
                disconnected: 'Non connecté',
                waitingMobile: 'En attente d\'un mobile',
                
                // Configuration
                settings: 'Paramètres',
                language: 'Langue',
                maxFiles: 'Nombre maximum de fichiers',
                save: 'Enregistrer',
                cancel: 'Annuler',
                
                // Interface principale
                addMapping: 'Ajouter un mapping',
                editMapping: 'Modifier',
                deleteMapping: 'Supprimer',
                sourcePath: 'Dossier source',
                targetPath: 'Dossier cible',
                selectFolder: 'Sélectionner un dossier',
                
                // Messages
                saveSuccess: 'Configuration enregistrée',
                saveError: 'Erreur lors de l\'enregistrement',
                confirmDelete: 'Voulez-vous vraiment supprimer ce mapping ?',
                
                // Erreurs
                error: 'Erreur',
                networkError: 'Erreur réseau',
                invalidPath: 'Chemin invalide',
                maxFilesReached: 'Nombre maximum de fichiers atteint'
            },
            en: {
                // Connection states
                connected: 'Mobile connected',
                disconnected: 'Not connected',
                waitingMobile: 'Waiting for mobile',
                
                // Configuration
                settings: 'Settings',
                language: 'Language',
                maxFiles: 'Maximum number of files',
                save: 'Save',
                cancel: 'Cancel',
                
                // Main interface
                addMapping: 'Add mapping',
                editMapping: 'Edit',
                deleteMapping: 'Delete',
                sourcePath: 'Source folder',
                targetPath: 'Target folder',
                selectFolder: 'Select folder',
                
                // Messages
                saveSuccess: 'Configuration saved',
                saveError: 'Error while saving',
                confirmDelete: 'Do you really want to delete this mapping?',
                
                // Errors
                error: 'Error',
                networkError: 'Network error',
                invalidPath: 'Invalid path',
                maxFilesReached: 'Maximum number of files reached'
            }
        };
    }

    async setLanguage(lang) {
        if (!this.translations[lang]) {
            console.error(`Language ${lang} not supported`);
            return;
        }

        this.currentLanguage = lang;
        localStorage.setItem('language', lang);
        
        // Mettre à jour tous les éléments avec data-i18n
        this.translatePage();

        // Si nous sommes dans Electron, propager le changement
        if (window.electron) {
            await window.electron.saveConfig({ language: lang });
        }

        // Émettre un événement pour informer les autres composants
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
    }

    translate(key, params = {}) {
        const translation = this.translations[this.currentLanguage]?.[key] || key;
        
        // Remplacer les paramètres si présents
        return translation.replace(/\{(\w+)\}/g, (match, param) => {
            return params[param] !== undefined ? params[param] : match;
        });
    }

    translatePage() {
        // Traduire tous les éléments avec data-i18n
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (key) {
                // Si l'élément a des paramètres stockés dans data-i18n-params
                let params = {};
                try {
                    const paramsAttr = element.getAttribute('data-i18n-params');
                    if (paramsAttr) {
                        params = JSON.parse(paramsAttr);
                    }
                } catch (error) {
                    console.error('Error parsing i18n params:', error);
                }
                
                element.textContent = this.translate(key, params);
            }
        });
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    getSupportedLanguages() {
        return Object.keys(this.translations);
    }
}

// Créer une instance globale
window.i18nManager = new I18nManager();

// Initialiser les traductions au chargement
document.addEventListener('DOMContentLoaded', () => {
    window.i18nManager.translatePage();
});
