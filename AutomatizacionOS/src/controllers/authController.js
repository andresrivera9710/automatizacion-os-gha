const sqlService = require('../services/sqlService');
const logger = require('../utils/logger');

async function login(req, res) {
    try {
        const { pin } = req.body;
        const result = await sqlService.loginWithPin(pin);

        if (result.resultado === 1 && result.usuario && req.session) {
            // Rotación de ID de sesión para prevenir Session Fixation y establecer cookie HttpOnly
            req.session.regenerate(result.usuario);
        }

        return res.status(200).json(result);
    } catch (err) {
        logger.error('Error en controlador de login', err);
        return res.status(500).json({
            resultado: -1,
            mensaje: 'Error interno procesando la autenticación.'
        });
    }
}

function logout(req, res) {
    if (req.session) {
        req.session.destroy();
    }
    return res.status(200).json({
        resultado: 1,
        mensaje: 'Sesión cerrada correctamente.'
    });
}

function getSession(req, res) {
    if (req.session && req.session.user) {
        return res.status(200).json({
            resultado: 1,
            autenticado: true,
            usuario: req.session.user
        });
    }
    return res.status(401).json({
        resultado: 0,
        autenticado: false,
        mensaje: 'No existe una sesión activa.'
    });
}

async function testConnection(req, res) {
    try {
        const result = await sqlService.testConnection();
        if (result.ok) {
            return res.status(200).json({
                resultado: 1,
                mensaje: `Conexión exitosa a Azure SQL (${result.database})`,
                servidor: result.server
            });
        } else {
            return res.status(500).json({
                resultado: -1,
                mensaje: `Error de conexión: ${result.error}`
            });
        }
    } catch (err) {
        logger.error('Error verificando conexión', err);
        return res.status(500).json({
            resultado: -1,
            mensaje: 'Error interno verificando conexión a la base de datos.'
        });
    }
}

module.exports = {
    login,
    logout,
    getSession,
    testConnection
};
