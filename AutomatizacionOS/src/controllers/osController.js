const sqlService = require('../services/sqlService');
const logger = require('../utils/logger');

async function insertOsMasiva(req, res) {
    try {
        const { loginId: bodyLoginId, nombreModificado: bodyNombre, fechaOS, filas } = req.body;

        // Seguridad Contextual / Prevención IDOR:
        // Priorizar siempre la identidad almacenada en la sesión del servidor (req.session.user)
        const sessionUser = req.session?.user;
        if (sessionUser) {
            if (sessionUser.DepartamentoInternoId !== 16 && String(sessionUser.Departamento).toUpperCase() !== 'GHA') {
                logger.warn(`[SEGURIDAD IDOR/RLS] Usuario ${sessionUser.Usuario} intentó insertar OS sin pertenecer a GHA.`);
                return res.status(403).json({
                    resultado: -1,
                    mensaje: 'Acceso denegado: Su sesión no pertenece al departamento GHA (16).'
                });
            }
        }

        const effectiveLoginId = sessionUser ? sessionUser.LoginId : bodyLoginId;
        const effectiveNombre = sessionUser ? (sessionUser.Nombre || sessionUser.Usuario) : bodyNombre;

        if (!effectiveLoginId || !filas || !Array.isArray(filas) || filas.length === 0) {
            return res.status(400).json({
                resultado: -1,
                mensaje: 'Datos insuficientes o sesión no válida para la inserción masiva.'
            });
        }

        const result = await sqlService.insertOsMasiva({
            loginId: effectiveLoginId,
            nombreModificado: effectiveNombre,
            fechaOS,
            operadorId: 19, // Forzado en servidor: AVIANCA (19)
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
