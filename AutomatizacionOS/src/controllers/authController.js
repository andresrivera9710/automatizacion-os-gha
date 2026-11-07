const sqlService = require('../services/sqlService');
const logger = require('../utils/logger');

async function login(req, res) {
    try {
        const { pin } = req.body;
        const result = await sqlService.loginWithPin(pin);
        return res.status(200).json(result);
    } catch (err) {
        logger.error('Error en controlador de login', err);
        return res.status(500).json({
            resultado: -1,
            mensaje: `Error interno en el servidor: ${err.message}`
        });
    }
}

async function testConnection(req, res) {
    try {
        const result = await sqlService.testConnection();
        if (result.ok) {
            return res.status(200).json({
                resultado: 1,
                mensaje: `Conexión exitosa a Azure SQL (${result.database})`,
                servidor: result.server,
                version: result.version
            });
        } else {
            return res.status(500).json({
                resultado: -1,
                mensaje: `Error de conexión: ${result.error}`,
                servidor: result.server
            });
        }
    } catch (err) {
        logger.error('Error verificando conexión', err);
        return res.status(500).json({
            resultado: -1,
            mensaje: `Error interno de conexión: ${err.message}`
        });
    }
}

module.exports = {
    login,
    testConnection
};

