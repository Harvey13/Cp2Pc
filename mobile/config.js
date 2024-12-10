// Configuration pour la découverte du serveur
export const CONFIG = {
    // Port du serveur
    PORT: 3000,

    // Délai avant de réessayer en cas d'échec (en ms)
    RETRY_DELAY: 3000,

    // Timeout pour le scan d'une IP (en ms)
    SCAN_TIMEOUT: 1000,

    // Nombre d'IPs à scanner en parallèle
    BATCH_SIZE: 10,

    // IPs à scanner en priorité (derniers octets)
    PRIORITY_IPS: [1],

    // Intervalle entre les pings de keepalive (en ms)
    KEEPALIVE_INTERVAL: 1000
};
