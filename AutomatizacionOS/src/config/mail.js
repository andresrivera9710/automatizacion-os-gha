const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const mailConfig = {
    method: process.env.MAIL_METHOD || 'smtp',
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.office365.com',
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || ''
        },
        tls: {
            ciphers: 'SSLv3',
            rejectUnauthorized: false
        }
    },
    from: process.env.SMTP_FROM || '"Sistema SIO GHA" <notificaciones@laats.net>',
    defaultRecipients: process.env.MAIL_DEFAULT_RECIPIENTS || 'programadorit@laats.net; monicaaracely@laats.net; facturacion@laats.net'
};

let transporter = null;

function getTransporter() {
    if (!transporter && mailConfig.smtp.auth.user && mailConfig.smtp.auth.pass) {
        transporter = nodemailer.createTransport(mailConfig.smtp);
    }
    return transporter;
}

module.exports = {
    mailConfig,
    getTransporter
};

