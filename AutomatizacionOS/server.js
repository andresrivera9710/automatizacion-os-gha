require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { testConnection, closePool } = require('./src/config/db');
const logger = require('./src/utils/logger');

const PORT = parseInt(process.env.PORT, 10) || 3080;
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(app);

async function startServer() {
    logger.banner(
        `SERVIDOR SIO - AUTOMATIZACION OS GHA (Puerto: ${PORT})`,
        'Arquitectura Node.js + Express JS para Servidor'
    );
    logger.info(`Servidor Azure SQL: ${process.env.DB_SERVER || 'mysqullaats23.database.windows.net'}`);
    logger.info(`Base de Datos SIO: ${process.env.DB_NAME || 'SIO'}`);

    server.listen(PORT, HOST, () => {
        logger.success(`Servidor Node.js/Express escuchando en: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
        logger.info(`Endpoint API SQL: http://localhost:${PORT}/api/sql`);
        logger.info(`Endpoint Health Check: http://localhost:${PORT}/health`);
        logger.info(`Aplicación web disponible en: http://localhost:${PORT}/`);
        logger.info('Presione CTRL+C para detener el servidor.\n');
    });

    // Verificación de conectividad en segundo plano para no bloquear el inicio del servidor HTTP
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
