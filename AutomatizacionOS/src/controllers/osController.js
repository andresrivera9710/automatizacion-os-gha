const sqlService = require('../services/sqlService');
const logger = require('../utils/logger');

async function insertOsMasiva(req, res) {
    try {
        const { loginId, nombreModificado, fechaOS, operadorId, filas } = req.body;

        if (!loginId || !filas || !Array.isArray(filas) || filas.length === 0) {
            return res.status(400).json({
                resultado: -1,
                mensaje: 'Datos insuficientes para la inserción masiva.'
            });
        }

        const result = await sqlService.insertOsMasiva({
            loginId,
            nombreModificado,
            fechaOS,
            operadorId,
            filas
        });

        return res.status(200).json(result);
    } catch (err) {
        logger.error('Error en controlador insertOsMasiva', err);
        return res.status(500).json({
            resultado: -1,
            mensaje: `Error durante la inserción: ${err.message}`
        });
    }
}

module.exports = {
    insertOsMasiva
};

