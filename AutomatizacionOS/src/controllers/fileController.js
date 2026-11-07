const fileService = require('../services/fileService');
const logger = require('../utils/logger');

async function guardarHtmlOs(req, res) {
    try {
        const { correlativo, contenidoHtml } = req.body;

        if (!correlativo || !contenidoHtml) {
            return res.status(400).json({
                resultado: -1,
                mensaje: 'Datos insuficientes para guardar el archivo HTML (correlativo o contenido vacíos).'
            });
        }

        const saved = fileService.saveHtmlOsFile(correlativo, contenidoHtml);

        return res.status(200).json({
            resultado: 1,
            mensaje: 'Archivo guardado exitosamente en la carpeta Información',
            ruta: saved.fullPath,
            nombreArchivo: saved.fileName
        });
    } catch (err) {
        logger.error('Error guardando archivo HTML de la OS', err);
        return res.status(500).json({
            resultado: -1,
            mensaje: `Error guardando HTML: ${err.message}`
        });
    }
}

module.exports = {
    guardarHtmlOs
};

