const { sql, getPool, testConnection } = require('../config/db');
const logger = require('../utils/logger');

/**
 * Autenticación por PIN para personal del departamento GHA (ID = 16)
 */
async function loginWithPin(pin) {
    if (!pin || typeof pin !== 'string' || !pin.trim()) {
        return {
            resultado: 0,
            mensaje: 'Debe proporcionar un PIN de acceso.'
        };
    }

    const pool = await getPool();
    const query = `
        SELECT TOP (1) 
            l.LoginId, 
            l.Usuario, 
            e.EmpleadoId, 
            e.Nombre,
            ISNULL(p.Nombre, 'COLABORADOR') AS Puesto,
            ISNULL(di.DepartamentoInternoId, 0) AS DepartamentoInternoId,
            ISNULL(di.DepartamentoInterno, 'SIN ASIGNAR') AS DepartamentoInterno
        FROM dbo.Login AS l
        INNER JOIN dbo.Empleado AS e ON e.EmpleadoId = l.EmpleadoId
        LEFT JOIN dbo.Puesto AS p ON p.PuestoId = e.PuestoId
        LEFT JOIN dbo.DepartamentoDepInterno AS ddi ON ddi.DepartamentoId = e.DepartamentoId
        LEFT JOIN dbo.DepartamentoInterno AS di ON di.DepartamentoInternoId = ddi.DepartamentoInternoId
        WHERE l.Password = @Pin AND l.EstaEliminado = 0;
    `;

    const request = pool.request();
    request.input('Pin', sql.VarChar(100), pin.trim());
    const result = await request.query(query);

    if (!result.recordset || result.recordset.length === 0) {
        logger.warn('Intento de login fallido: PIN no encontrado o inactivo.');
        return {
            resultado: 0,
            mensaje: 'PIN no encontrado o usuario inactivo en la base de datos SIO.'
        };
    }

    const row = result.recordset[0];
    const deptoId = parseInt(row.DepartamentoInternoId, 10);
    const deptoNombre = String(row.DepartamentoInterno || '').trim();
    const nombreColab = String(row.Nombre || '').trim();

    // Validar exclusividad para personal de GHA (DepartamentoInternoId = 16)
    if (deptoId !== 16 && deptoNombre.toUpperCase() !== 'GHA') {
        logger.warn(`Acceso denegado: '${nombreColab}' pertenece a '${deptoNombre}' (ID: ${deptoId}) y no a GHA.`);
        return {
            resultado: 0,
            mensaje: `Acceso denegado: El colaborador '${nombreColab}' pertenece al departamento '${deptoNombre}'. Este módulo es exclusivo para personal del departamento GHA.`
        };
    }

    const usuario = {
        LoginId: row.LoginId,
        Usuario: row.Usuario,
        EmpleadoId: row.EmpleadoId,
        Nombre: nombreColab,
        Puesto: row.Puesto,
        Departamento: deptoNombre,
        DepartamentoInternoId: deptoId
    };

    logger.success(`Login GHA exitoso: ${usuario.Nombre} (ID: ${usuario.LoginId})`);
    return {
        resultado: 1,
        mensaje: 'Autenticación exitosa (Departamento GHA)',
        usuario
    };
}

/**
 * Inserción Masiva de Orden de Servicio GHA
 * Implementa estrategia en 2 pasos:
 * 1. Procedimiento unificado dbo.InsertarOrdenServicioMasivaGHA
 * 2. Fallback con dbo.InsertarEncabezadoOS + dbo.InsertarDetalleOSGHA
 */
async function insertOsMasiva({ loginId, nombreModificado, fechaOS, operadorId = 19, filas = [] }) {
    if (!loginId || !Array.isArray(filas) || filas.length === 0) {
        throw new Error('Datos insuficientes para la inserción masiva (loginId o lista de filas vacía).');
    }

    logger.info(`Iniciando inserción masiva: ${filas.length} registros por LoginId ${loginId}...`);
    const pool = await getPool();
    const parsedFechaOS = new Date(fechaOS);

    // Intento 1: Procedimiento Almacenado Unificado dbo.InsertarOrdenServicioMasivaGHA
    try {
        logger.info('Invocando procedimiento unificado dbo.InsertarOrdenServicioMasivaGHA...');
        const detallesJson = JSON.stringify(filas);

        const request = pool.request();
        request.input('LoginId', sql.Int, parseInt(loginId, 10));
        request.input('Modificado', sql.VarChar(150), String(nombreModificado || 'SISTEMA'));
        request.input('FechaOS', sql.DateTime, parsedFechaOS);
        request.input('OperadorId', sql.Int, parseInt(operadorId, 10) || 19);
        request.input('DepartamentoId', sql.Int, 16); // GHA
        request.input('DivisionId', sql.Int, 12);     // Importación NA
        request.input('DetallesJson', sql.NVarChar(sql.MAX), detallesJson);

        const result = await request.execute('dbo.InsertarOrdenServicioMasivaGHA');
        if (result.recordset && result.recordset.length > 0) {
            const row = result.recordset[0];
            const res = parseInt(row.Resultado, 10);
            const msj = row.Mensaje;
            const correlativo = parseInt(row.Correlativo, 10);
            const totalInsertados = parseInt(row.TotalInsertados, 10);

            if (res === 1) {
                logger.success(`Inserción completada vía dbo.InsertarOrdenServicioMasivaGHA: Correlativo ${correlativo}`);
                return {
                    resultado: 1,
                    mensaje: 'Orden de Servicio insertada exitosamente.',
                    correlativo,
                    totalInsertados,
                    totalEsperados: filas.length,
                    procedimiento: 'dbo.InsertarOrdenServicioMasivaGHA',
                    errores: []
                };
            } else {
                throw new Error(msj || 'El procedimiento unificado retornó resultado negativo');
            }
        }
    } catch (unifErr) {
        logger.warn(`Procedimiento unificado devolvió: ${unifErr.message}. Evaluando fallback tradicional...`);
    }

    // Intento 2 (Fallback): dbo.InsertarEncabezadoOS + dbo.InsertarDetalleOSGHA
    logger.info('Ejecutando fallback: dbo.InsertarEncabezadoOS + dbo.InsertarDetalleOSGHA...');
    let totalMonto = 0.0;
    for (const f of filas) {
        totalMonto += parseFloat(f.monto || 0);
    }

    // A. Insertar Encabezado
    const reqEnc = pool.request();
    reqEnc.input('LoginId', sql.Int, parseInt(loginId, 10));
    reqEnc.input('Modificado', sql.VarChar(150), String(nombreModificado || 'SISTEMA'));
    reqEnc.input('ItinerarioId', sql.Int, 0);
    reqEnc.input('DepartamentoId', sql.Int, 16); // GHA
    reqEnc.input('DivisionId', sql.Int, 12);     // NA
    reqEnc.input('Observaciones', sql.VarChar(255), 'CARGA MASIVA GHA - GUIA DE IMPORTACION');
    reqEnc.input('FechaOS', sql.DateTime, parsedFechaOS);
    reqEnc.input('OperadorId', sql.Int, parseInt(operadorId, 10) || 19);
    reqEnc.input('HayTaller', sql.Int, 0);
    reqEnc.input('MaquinariaEquipo', sql.VarChar(50), '');
    reqEnc.input('Marca', sql.VarChar(50), '');
    reqEnc.input('TipoMovilidad', sql.Int, 0);
    reqEnc.input('TipoMonedaId', sql.Int, 0);
    reqEnc.input('Total', sql.VarChar(50), totalMonto.toFixed(2));
    reqEnc.input('EstaCancelado', sql.Int, 0);
    reqEnc.input('AreaId', sql.Int, 0);
    reqEnc.input('ItinerarioOperador', sql.Int, 0);
    reqEnc.input('FirmaCliente', sql.VarChar(sql.MAX), '');
    reqEnc.input('FirmaEmpleado', sql.VarChar(sql.MAX), '');
    reqEnc.input('NombreF', sql.VarChar(100), '');
    reqEnc.input('HayMatricula', sql.Int, 0);
    reqEnc.input('FBO', sql.Int, 0);
    reqEnc.input('EsComercial', sql.Int, 1);

    const resEnc = await reqEnc.execute('dbo.InsertarEncabezadoOS');
    let correlativoCreado = 0;
    if (resEnc.recordset && resEnc.recordset.length > 0) {
        correlativoCreado = parseInt(resEnc.recordset[0].Resultado, 10);
    }

    if (correlativoCreado <= 0) {
        throw new Error('No se pudo obtener el correlativo del EncabezadoOS.');
    }

    logger.success(`Encabezado creado con éxito. Correlativo asignado: ${correlativoCreado}`);

    // B. Insertar cada detalle
    let insertados = 0;
    const errores = [];

    for (const fila of filas) {
        try {
            const reqDet = pool.request();
            reqDet.input('LoginId', sql.Int, parseInt(loginId, 10));
            reqDet.input('DepartamentoId', sql.Int, 16);
            reqDet.input('CodigoServiciosId', sql.Int, 271); // Código 281 en catálogo
            reqDet.input('Cantidand', sql.Int, 1);
            reqDet.input('HoraInicio', sql.VarChar(10), '00:00');
            reqDet.input('HoraFinal', sql.VarChar(10), '00:00');
            reqDet.input('TotalDif', sql.Int, 1);
            reqDet.input('Comentarios', sql.VarChar(255), String(fila.comentarios || ''));
            reqDet.input('KilogramosNeto', sql.VarChar(20), '');
            reqDet.input('KilogramosVolumen', sql.VarChar(20), '');
            reqDet.input('Monto', sql.Decimal(18, 2), parseFloat(fila.monto || 0));
            reqDet.input('NoGuia', sql.VarChar(50), String(fila.guia || ''));
            reqDet.input('DivisionId', sql.Int, 12); // NA
            reqDet.input('MetodoId', sql.Int, parseInt(fila.metodoPagoId, 10) || 0);
            reqDet.input('NoBoleta', sql.VarChar(50), '');
            reqDet.input('Depositante', sql.VarChar(100), '');
            reqDet.input('FechaPago', sql.DateTime, parsedFechaOS);
            reqDet.input('ClientesFacturacionId', sql.Int, 0);

            const resDet = await reqDet.execute('dbo.InsertarDetalleOSGHA');
            if (resDet.recordset && resDet.recordset.length > 0) {
                const res = parseInt(resDet.recordset[0].Resultado, 10);
                if (res === 1) {
                    insertados++;
                } else {
                    errores.push(`Guía ${fila.guia}: ${resDet.recordset[0].Mensaje}`);
                }
            }
        } catch (detErr) {
            errores.push(`Guía ${fila.guia}: ${detErr.message}`);
        }
    }

    logger.success(`Finalizado: ${insertados} de ${filas.length} detalles insertados exitosamente.`);
    return {
        resultado: 1,
        mensaje: 'Orden de Servicio insertada exitosamente.',
        correlativo: correlativoCreado,
        totalInsertados: insertados,
        totalEsperados: filas.length,
        procedimiento: 'dbo.InsertarEncabezadoOS + dbo.InsertarDetalleOSGHA',
        errores
    };
}

module.exports = {
    loginWithPin,
    testConnection,
    insertOsMasiva
};

