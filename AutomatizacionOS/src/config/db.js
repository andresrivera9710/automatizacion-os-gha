const sql = require('mssql');
const logger = require('../utils/logger');

const dbConfig = {
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT, 10) || 1433,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: process.env.DB_ENCRYPT !== 'false',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
        enableArithAbort: true,
        connectTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 30000,
        requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT, 10) || 180000
    },
    pool: {
        max: 10,
        min: 1,
        idleTimeoutMillis: 30000
    }
};

let poolPromise = null;

async function getPool() {
    if (!poolPromise) {
        poolPromise = new sql.ConnectionPool(dbConfig)
            .connect()
            .then(pool => {
                logger.success(`Conexión establecida con Azure SQL Database (${dbConfig.database})`);
                return pool;
            })
            .catch(err => {
                logger.error('Error al conectar con la base de datos Azure SQL', err);
                poolPromise = null;
                throw err;
            });
    }
    return poolPromise;
}

async function testConnection() {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT @@VERSION AS Version, DB_NAME() AS BaseDatos;');
        return {
            ok: true,
            database: result.recordset[0]?.BaseDatos || dbConfig.database,
            server: dbConfig.server ? 'Azure SQL (Configurado)' : 'No definido',
            version: result.recordset[0]?.Version
        };
    } catch (err) {
        return {
            ok: false,
            error: err.message
        };
    }
}

async function closePool() {
    if (poolPromise) {
        try {
            const pool = await poolPromise;
            await pool.close();
            poolPromise = null;
            logger.info('Pool de conexiones a SQL Server cerrado.');
        } catch (err) {
            logger.error('Error cerrando el pool de conexiones', err);
        }
    }
}

module.exports = {
    sql,
    dbConfig,
    getPool,
    testConnection,
    closePool
};
