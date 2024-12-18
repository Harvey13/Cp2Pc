class IHM {
    constructor() {
        console.log('🔧 IHM: Constructor called');
    }    

    static disableAllCopyButtons() {
        console.log('🔒 IHM: Désactivation des boutons de copie');
        // Désactiver le bouton de copie globale
        const globalCopyBtn = document.querySelector('.start-copy-btn');
        if (globalCopyBtn) {
            console.log('- Désactivation du bouton global');
            globalCopyBtn.disabled = true;
            globalCopyBtn.classList.add('disabled');
        }

        // Désactiver tous les boutons de lancement
        const startMappingBtns = document.querySelectorAll('.start-mapping-btn');
        console.log(`- Désactivation de ${startMappingBtns.length} boutons individuels`);
        startMappingBtns.forEach(btn => {
            btn.disabled = true;
            btn.classList.add('disabled');
        });
    }

    static enableAllCopyButtons() {
        console.log('🔓 IHM: Activation des boutons de copie');
        // Réactiver le bouton de copie globale
        const globalCopyBtn = document.querySelector('.start-copy-btn');
        if (globalCopyBtn) {
            console.log('- Activation du bouton global');
            globalCopyBtn.disabled = false;
            globalCopyBtn.classList.remove('disabled');
        }

        // Réactiver tous les boutons de lancement
        const startMappingBtns = document.querySelectorAll('.start-mapping-btn');
        console.log(`- Activation de ${startMappingBtns.length} boutons individuels`);
        startMappingBtns.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('disabled');
        });
    }
}

window.IHM = IHM;
console.log('📚 IHM: Classe chargée et enregistrée globalement');