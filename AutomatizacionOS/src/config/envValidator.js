const crypto = require('crypto');
const logger = require('../utils/logger');

const REQUIRED_ENV_VARS = [
    'DB_SERVER',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD'
];

/**
 * Valida la presencia de variables críticas de entorno al iniciar el servidor.
 * Nunca imprime valores sensibles en consola.
 */
function validateEnvironment() {
    const missing = REQUIRED_ENV_VARS.filter(key => {
        const val = process.env[key];
        return !val || String(val).trim() === '';
    });

    if (missing.length > 0) {
        logger.error(`[SEGURIDAD] Faltan variables de entorno críticas en el archivo .env: ${missing.join(', ')}`);
        logger.error('Por seguridad, el servidor no puede iniciar sin credenciales configuradas en variables de entorno.');
        if (process.env.STRICT_ENV_VALIDATION !== 'false') {
            process.exit(1);
        }
    }

    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
        process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
        logger.warn('[SEGURIDAD] SESSION_SECRET no definido en .env. Se generó una clave efímera de 256 bits para esta instancia.');
    }

    logger.success('[SEGURIDAD] Variables de entorno validadas correctamente.');
}

module.exports = {
    validateEnvironment,
    REQUIRED_ENV_VARS
};

