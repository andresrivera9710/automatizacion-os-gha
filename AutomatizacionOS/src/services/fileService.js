const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

function getInformacionDir() {
    const customDir = process.env.INFORMACION_DIR;
    let baseDir;
    if (customDir) {
        baseDir = path.isAbsolute(customDir)
            ? customDir
            : path.resolve(__dirname, '..', '..', customDir);
    } else {
        baseDir = path.resolve(__dirname, '..', '..', '..', 'Informacion');
    }

    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
        logger.info(`Directorio de Información creado en: ${baseDir}`);
    }
    return baseDir;
}

function sanitizeCorrelativo(correlativo) {
    const cleaned = String(correlativo || '').replace(/[^0-9A-Za-z_-]/g, '').slice(0, 30);
    if (!cleaned) {
        throw new Error('Correlativo inválido.');
    }
    return cleaned;
}

function getHtmlOsFilePath(correlativo) {
    const safeCorrelativo = sanitizeCorrelativo(correlativo);
    const fileName = `GHA-${safeCorrelativo}-AVIANCA-NA.html`;
    const dir = getInformacionDir();
    return {
        fileName,
        fullPath: path.join(dir, fileName)
    };
}

function saveHtmlOsFile(correlativo, contenidoHtml) {
    if (!correlativo || !contenidoHtml) {
        throw new Error('Datos insuficientes para guardar el archivo HTML (correlativo o contenido vacíos)');
    }
    const { fileName, fullPath } = getHtmlOsFilePath(correlativo);
    fs.writeFileSync(fullPath, contenidoHtml, 'utf8');
    logger.success(`Archivo HTML de la OS guardado exitosamente en: ${fullPath}`);
    return {
        fileName,
        fullPath
    };
}

function existsHtmlOsFile(correlativo) {
    const { fullPath } = getHtmlOsFilePath(correlativo);
    return fs.existsSync(fullPath);
}

module.exports = {
    getInformacionDir,
    getHtmlOsFilePath,
    saveHtmlOsFile,
    existsHtmlOsFile
};
