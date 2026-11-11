const crypto = require('crypto');
const sqlService = require('../../src/services/sqlService');

const COOKIE_NAME = 'sio_gha_sid';
const MAX_AGE_SEC = 8 * 60 * 60; // 8 horas
const FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

const ALLOWED_ORIGINS = [
    'https://automatizacion-os-gha.netlify.app',
    'http://localhost:3080',
    'http://127.0.0.1:3080'
];

function getSecret() {
    return process.env.SESSION_SECRET || FALLBACK_SECRET;
}

function createSignedToken(user) {
    const payload = Buffer.from(JSON.stringify({
        u: user,
        exp: Date.now() + MAX_AGE_SEC * 1000
    }), 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
    return `${payload}.${sig}`;
}

function verifySignedToken(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [payload, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!decoded || Date.now() > decoded.exp) return null;
        return decoded.u;
    } catch (_) {
        return null;
    }
}

function parseCookies(cookieHeader) {
    const out = {};
    if (!cookieHeader) return out;
    cookieHeader.split(';').forEach(part => {
        const idx = part.indexOf('=');
        if (idx > 0) {
            const k = part.slice(0, idx).trim();
            const v = decodeURIComponent(part.slice(idx + 1).trim());
            out[k] = v;
        }
    });
    return out;
}

exports.handler = async function (event) {
    const reqOrigin = event.headers?.origin || event.headers?.Origin || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0];
    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': allowedOrigin,
        'Vary': 'Origin',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ resultado: -1, mensaje: 'Método no permitido. Use POST.' })
        };
    }

    let body = {};
    try {
        body = event.body ? JSON.parse(event.body) : {};
    } catch (_) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ resultado: -1, mensaje: 'Cuerpo JSON inválido.' })
        };
    }

    const action = body.action || 'test_connection';
    const cookies = parseCookies(event.headers?.cookie || event.headers?.Cookie);
    const sessionUser = verifySignedToken(cookies[COOKIE_NAME]);

    try {
        if (action === 'test_connection') {
            const resConn = await sqlService.testConnection();
            if (resConn.ok) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        resultado: 1,
                        mensaje: `Conexión exitosa a Azure SQL (${resConn.database})`,
                        servidor: resConn.server
                    })
                };
            }
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    resultado: -1,
                    mensaje: 'No se pudo establecer conexión con el servicio de base de datos.'
                })
            };
        }

        if (action === 'login') {
            if (body.website_hp && String(body.website_hp).trim() !== '') {
                return {
                    statusCode: 403,
                    headers,
                    body: JSON.stringify({ resultado: -1, mensaje: 'Solicitud bloqueada por protección anti-bot.' })
                };
            }

            const result = await sqlService.loginWithPin(body.pin);
            if (result.resultado === 1 && result.usuario) {
                const token = createSignedToken(result.usuario);
                headers['Set-Cookie'] = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SEC}`;
            }
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result)
            };
        }

        if (action === 'logout') {
            headers['Set-Cookie'] = `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ resultado: 1, mensaje: 'Sesión cerrada correctamente.' })
            };
        }

        if (action === 'session') {
            if (sessionUser) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ resultado: 1, autenticado: true, usuario: sessionUser })
                };
            }
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ resultado: 0, autenticado: false, mensaje: 'Sin sesión activa.' })
            };
        }

        if (action === 'insert_os_masiva') {
            const effectiveLoginId = sessionUser ? sessionUser.LoginId : body.loginId;
            const effectiveNombre = sessionUser ? (sessionUser.Nombre || sessionUser.Usuario) : body.nombreModificado;

            if (!effectiveLoginId || !Array.isArray(body.filas) || body.filas.length === 0) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ resultado: -1, mensaje: 'Datos insuficientes o sesión no válida para la inserción masiva.' })
                };
            }

            const resInsert = await sqlService.insertOsMasiva({
                loginId: effectiveLoginId,
                nombreModificado: effectiveNombre,
                fechaOS: body.fechaOS,
                operadorId: 19,
                filas: body.filas
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(resInsert)
            };
        }

        if (action === 'guardar_html_os') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    resultado: 1,
                    mensaje: 'Archivo HTML procesado y descargado en el navegador.'
                })
            };
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ resultado: -1, mensaje: `Acción '${action}' no reconocida.` })
        };
    } catch (_) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                resultado: -1,
                mensaje: 'Error interno procesando la solicitud en el servicio seguro.'
            })
        };
    }
};

