require('dotenv').config();
const http = require('http');
const { validateEnvironment } = require('./src/config/envValidator');
const app = require('./src/app');
const { testConnection, closePool } = require('./src/config/db');
const logger = require('./src/utils/logger');

// Validar variables críticas de entorno antes de arrancar el servidor
validateEnvironment();

const PORT = parseInt(process.env.PORT, 10) || 3080;
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(app);

async function startServer() {
    logger.banner(
        `SERVIDOR SIO - AUTOMATIZACION OS GHA (Puerto: ${PORT})`,
        'Arquitectura Blindada Node.js + Express JS (RLS, Rate-Limit, CSP & Sesiones HttpOnly)'
    );
    logger.info(`Base de Datos SIO: ${process.env.DB_NAME}`);

    server.listen(PORT, HOST, () => {
        const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
        logger.success(`Servidor Node.js/Express escuchando en: http://${displayHost}:${PORT}`);
        logger.info(`Ruta de Autenticación Obligatoria: http://${displayHost}:${PORT}/login`);
        logger.info(`Endpoint API SQL: http://${displayHost}:${PORT}/api/sql`);
        logger.info(`Endpoint Health Check: http://${displayHost}:${PORT}/health`);
        logger.info('Presione CTRL+C para detener el servidor.\n');
    });

    logger.info('Verificando conectividad inicial con Azure SQL Database...');
    testConnection().then(testResult => {
        if (testResult.ok) {
            logger.success(`Conexión verificada exitosamente: Base de Datos '${testResult.database}'`);
        } else {
            logger.warn(`Advertencia de conexión a BD: ${testResult.error}`);
            logger.warn('El servidor HTTP está activo, pero las consultas a la BD fallarán hasta corregir conectividad o firewall.');
        }
    }).catch(err => {
        logger.warn(`Error verificando BD: ${err.message}`);
    });
}

function handleTermination(signal) {
    logger.info(`\nSeñal ${signal} recibida. Cerrando servidor ordenadamente...`);
    server.close(async () => {
        logger.info('Servidor HTTP cerrado.');
        await closePool();
        process.exit(0);
    });

    setTimeout(() => {
        logger.error('Tiempo de espera agotado para cierre ordenado. Forzando salida.');
        process.exit(1);
    }, 10000);
}

process.on('SIGINT', () => handleTermination('SIGINT'));
process.on('SIGTERM', () => handleTermination('SIGTERM'));

startServer().catch(err => {
    logger.error('Error crítico iniciando el servidor', err);
    process.exit(1);
});
