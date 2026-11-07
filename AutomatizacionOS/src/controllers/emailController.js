const emailService = require('../services/emailService');
const logger = require('../utils/logger');

async function enviarCorreoOs(req, res) {
    try {
        const payload = req.body;
        const result = await emailService.sendOsNotificationEmail(payload);
        return res.status(200).json(result);
    } catch (err) {
        logger.error('Error enviando correo de notificación de la OS', err);
        return res.status(500).json({
            resultado: -1,
            mensaje: `Error al enviar correo: ${err.message}`,
            errorTecnico: err.message
        });
    }
}

module.exports = {
    enviarCorreoOs
};

