// Vue affichée quand aucun mapping n'existe
class NoMappingView extends HTMLElement {
    constructor() {
        super();
        this.render();
    }

    render() {
        this.innerHTML = `
            <div class="no-mapping">
                <button class="large-add-btn" id="firstMappingBtn">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="48" height="48">
                        <path fill="currentColor" d="M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm144 276c0 6.6-5.4 12-12 12h-92v92c0 6.6-5.4 12-12 12h-56c-6.6 0-12-5.4-12-12v-92h-92c-6.6 0-12-5.4-12-12v-56c0-6.6 5.4-12 12-12h92v-92c0-6.6 5.4-12 12-12h56c6.6 0 12 5.4 12 12v92h92c6.6 0 12 5.4 12 12v56z"/>
                    </svg>
                    <span>Créer un nouveau mapping</span>
                </button>
            </div>
        `;

        // Ajouter l'écouteur d'événement
        this.querySelector('#firstMappingBtn').addEventListener('click', () => {
            if (window.api) {
                window.api.addMapping();
            }
        });
    }
}

// Enregistrer le composant
customElements.define('no-mapping-view', NoMappingView);
