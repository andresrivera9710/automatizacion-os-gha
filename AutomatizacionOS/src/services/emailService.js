const fs = require('fs');
const { mailConfig, getTransporter } = require('../config/mail');
const fileService = require('./fileService');
const logger = require('../utils/logger');

function buildEmailHtml({ correlativo, fechaOS, tecnico, totalGuias, totalMonto, nombreArchivo, emisor = '' }) {
    const year = new Date().getFullYear();
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px; }
  .card { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 10px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 20px 24px; }
  .header h2 { margin: 0; font-size: 1.25rem; font-weight: 800; }
  .header p { margin: 4px 0 0 0; font-size: 0.85rem; color: #94a3b8; }
  .badge-os { display: inline-block; background: #dc2626; color: #ffffff; font-weight: 800; font-size: 1.1rem; padding: 4px 12px; border-radius: 6px; margin-top: 8px; font-family: monospace; }
  .content { padding: 24px; line-height: 1.6; font-size: 0.92rem; }
  .table-resumen { width: 100%; border-collapse: collapse; margin: 16px 0; }
  .table-resumen td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 0.88rem; }
  .table-resumen td.lbl { font-weight: 700; color: #475569; width: 40%; background: #f8fafc; }
  .table-resumen td.val { font-weight: 600; color: #0f172a; }
  .alert-info { background: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 4px; font-size: 0.85rem; color: #1e40af; margin-top: 18px; }
  .footer { background: #f1f5f9; padding: 14px 24px; font-size: 0.78rem; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>Notificación de Orden de Servicio Registrada</h2>
      <p>Sistema de Información Operativa (SIO) - Módulo GHA Avianca</p>
      <div class="badge-os">OS-${correlativo} (GHA-${correlativo}-AVIANCA-NA)</div>
    </div>
    <div class="content">
      <p>Estimado equipo,</p>
      <p>Se ha registrado exitosamente una nueva <strong>Orden de Servicio</strong> en la base de datos SIO con el siguiente resumen de liquidación:</p>
      
      <table class="table-resumen">
        <tr>
          <td class="lbl">Correlativo Asignado:</td>
          <td class="val"><strong style="color: #dc2626;">OS-${correlativo}</strong> (GHA-${correlativo}-AVIANCA-NA)</td>
        </tr>
        <tr>
          <td class="lbl">Cliente / Operador:</td>
          <td class="val">AVIANCA (Operador 19)</td>
        </tr>
        <tr>
          <td class="lbl">Departamento / División:</td>
          <td class="val">GHA (16) | Importación (12)</td>
        </tr>
        <tr>
          <td class="lbl">Fecha de la Orden:</td>
          <td class="val">${fechaOS}</td>
        </tr>
        <tr>
          <td class="lbl">Técnico Responsable:</td>
          <td class="val">${tecnico}</td>
        </tr>
        <tr>
          <td class="lbl">Total Guías (Código 281):</td>
          <td class="val"><strong>${totalGuias}</strong> guías registradas</td>
        </tr>
        <tr>
          <td class="lbl">Monto Total Liquidado:</td>
          <td class="val"><strong style="color: #047857; font-size: 1.05rem;">Q ${totalMonto}</strong></td>
        </tr>
      </table>

      <div class="alert-info">
        📎 <strong>Archivo Adjunto:</strong> Se adjunta el documento oficial en formato HTML (<code>${nombreArchivo}</code>) estructurado con sellos, firmas digitales y el detalle de servicios para su archivo y trámite de facturación correspondiente.
      </div>
    </div>
    <div class="footer">
      Mensaje enviado automáticamente desde el Servidor SIO GHA ${emisor ? `(${emisor})` : ''}.<br>
      LAATS, S. A. &copy; ${year} - Todos los derechos reservados.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Enviar correo a través de SMTP utilizando Nodemailer
 */
async function sendViaSmtp({ correlativo, fechaOS, tecnico, totalGuias, totalMonto, destinatarios, rutaAdjunto, nombreArchivo }) {
    const transporter = getTransporter();
    if (!transporter) {
        throw new Error('Servicio SMTP no configurado en variables de entorno (SMTP_USER y SMTP_PASS requeridos)');
    }

    const toList = destinatarios.split(/[;,]/).map(e => e.trim()).filter(Boolean);

    const htmlBody = buildEmailHtml({
        correlativo,
        fechaOS,
        tecnico,
        totalGuias,
        totalMonto,
        nombreArchivo,
        emisor: mailConfig.from
    });

    const mailOptions = {
        from: mailConfig.from,
        to: toList,
        subject: `Orden de Servicio GHA-${correlativo} - AVIANCA`,
        html: htmlBody,
        attachments: [
            {
                filename: nombreArchivo,
                path: rutaAdjunto
            }
        ]
    };

    logger.info(`Enviando correo vía SMTP a: ${toList.join(', ')}...`);
    const info = await transporter.sendMail(mailOptions);
    logger.success(`Correo enviado exitosamente vía SMTP. MessageID: ${info.messageId}`);
    return {
        cuentaEmisora: mailConfig.from,
        messageId: info.messageId
    };
}

/**
 * Orquestador principal de envío de correo (exclusivamente SMTP)
 */
async function sendOsNotificationEmail(payload) {
    const correlativo = String(payload.correlativo || '').trim();
    const fechaOS = String(payload.fechaOS || '').trim();
    const tecnico = String(payload.tecnico || '').trim();
    const totalGuias = String(payload.totalGuias || '0').trim();
    const totalMonto = String(payload.totalMonto || '0.00').trim();
    const destinatarios = String(payload.destinatarios || mailConfig.defaultRecipients).trim();

    if (!correlativo) {
        throw new Error('No se especificó el correlativo de la Orden de Servicio.');
    }

    const { fileName, fullPath } = fileService.getHtmlOsFilePath(correlativo);

    if (!fs.existsSync(fullPath) && payload.contenidoHtml) {
        fileService.saveHtmlOsFile(correlativo, payload.contenidoHtml);
    }

    if (!fs.existsSync(fullPath)) {
        throw new Error(`Error: No se encontró el archivo HTML de la orden para adjuntar (${fullPath}).`);
    }

    const result = await sendViaSmtp({
        correlativo,
        fechaOS,
        tecnico,
        totalGuias,
        totalMonto,
        destinatarios,
        rutaAdjunto: fullPath,
        nombreArchivo: fileName
    });

    return {
        resultado: 1,
        mensaje: 'Correo electrónico enviado exitosamente a los destinatarios configurados.',
        cuentaEmisora: result?.cuentaEmisora || 'Servidor SIO',
        destinatarios,
        adjunto: fileName
    };
}

module.exports = {
    sendOsNotificationEmail,
    buildEmailHtml
};
