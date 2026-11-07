const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const osController = require('../controllers/osController');
const fileController = require('../controllers/fileController');
const emailController = require('../controllers/emailController');
const logger = require('../utils/logger');

/**
 * Dispatcher para compatibilidad total con el puente original (POST /api/sql)
 */
router.post('/sql', async (req, res) => {
    const action = req.body?.action || 'consulta';
    logger.info(`Solicitud recibida en /api/sql: [Acción: ${action}]`);

    switch (action) {
        case 'login':
            return authController.login(req, res);

        case 'test_connection':
            return authController.testConnection(req, res);

        case 'insert_os_masiva':
            return osController.insertOsMasiva(req, res);

        case 'guardar_html_os':
            return fileController.guardarHtmlOs(req, res);

        case 'enviar_correo_os':
            return emailController.enviarCorreoOs(req, res);

        case 'shutdown':
            return handleShutdown(req, res);

        default:
            logger.warn(`Acción desconocida solicitada: ${action}`);
            return res.status(400).json({
                resultado: -1,
                mensaje: `Acción '${action}' no reconocida por el servidor`
            });
    }
});

/**
 * Manejo de apagado / cierre de ventana
 */
function handleShutdown(req, res) {
    const allowShutdown = process.env.ALLOW_SHUTDOWN === 'true';

    if (allowShutdown) {
        logger.warn('Cierre de ventana detectado. Apagando servidor según configuración ALLOW_SHUTDOWN=true...');
        res.status(200).json({
            resultado: 1,
            mensaje: 'Servidor detenido correctamente.'
        });
        setTimeout(() => {
            process.exit(0);
        }, 500);
    } else {
        logger.info('Notificación de cierre de sesión recibida. Servidor permanece en ejecución (ALLOW_SHUTDOWN=false).');
        res.status(200).json({
            resultado: 1,
            mensaje: 'Sesión finalizada. El servidor continúa activo.'
        });
    }
}

router.get('/shutdown', handleShutdown);
router.post('/shutdown', handleShutdown);

// Rutas REST estructuradas
router.post('/auth/login', authController.login);
router.get('/auth/test-connection', authController.testConnection);
router.post('/os/masiva', osController.insertOsMasiva);
router.post('/os/guardar-html', fileController.guardarHtmlOs);
router.post('/os/enviar-correo', emailController.enviarCorreoOs);

module.exports = router;

