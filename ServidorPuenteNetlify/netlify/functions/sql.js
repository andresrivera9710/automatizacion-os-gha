const https = require('https');
const crypto = require('crypto');
const sqlService = require('./src/services/sqlService');

const COOKIE_NAME = 'sio_gha_sid';
const MAX_AGE_SEC = 8 * 60 * 60;

function getSecret() {
    return process.env.SESSION_SECRET || 'sio_gha_laats_secure_session_secret_key_2026_production_9710';
}

function getNetlifyOutboundIp() {
    return new Promise((resolve) => {
        const req = https.get('https://api.ipify.org?format=json', { timeout: 3000 }, (res) => {
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(raw).ip || 'Dinámica (Netlify Cloud)');
                } catch (_) {
                    resolve('Dinámica (Netlify Cloud)');
                }
            });
        });
        req.on('error', () => resolve('Dinámica (Netlify Cloud)'));
        req.on('timeout', () => { req.destroy(); resolve('Dinámica (Netlify Cloud)'); });
    });
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
            out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
        }
    });
    return out;
}

exports.handler = async function (event) {
    const origin = event.headers?.origin || event.headers?.Origin || '*';
    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': origin === 'null' ? '*' : origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Access-Control-Request-Private-Network',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Private-Network': 'true'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    let body = {};
    if (event.httpMethod === 'POST' && event.body) {
        try {
            body = JSON.parse(event.body);
        } catch (_) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ resultado: -1, mensaje: 'JSON inválido en la petición.' })
            };
        }
    }

    const action = body.action || (event.httpMethod === 'GET' ? 'server_info' : 'test_connection');
    const cookies = parseCookies(event.headers?.cookie || event.headers?.Cookie);
    const sessionUser = verifySignedToken(cookies[COOKIE_NAME]);

    try {
        if (action === 'test_connection' || action === 'server_info') {
            const [resConn, serverIp] = await Promise.all([
                sqlService.testConnection(),
                getNetlifyOutboundIp()
            ]);

            if (resConn.ok) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        resultado: 1,
                        estado: 'CONECTADO',
                        mensaje: `Conexión exitosa a Azure SQL (${resConn.database})`,
                        servidor: resConn.server,
                        baseDatos: resConn.database,
                        netlifyServerIp: serverIp,
                        timestamp: new Date().toISOString()
                    })
                };
            }
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    resultado: -1,
                    estado: 'DESCONECTADO',
                    netlifyServerIp: serverIp,
                    mensaje: `Error de conexión: ${resConn.error}`
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
                headers['Set-Cookie'] = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${MAX_AGE_SEC}`;
            }
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result)
            };
        }

        if (action === 'logout') {
            headers['Set-Cookie'] = `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`;
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
                    body: JSON.stringify({ resultado: -1, mensaje: 'Datos insuficientes para la inserción masiva.' })
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
                body: JSON.stringify({ resultado: 1, mensaje: 'Archivo HTML procesado correctamente.' })
            };
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ resultado: -1, mensaje: `Acción '${action}' no reconocida.` })
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                resultado: -1,
                mensaje: `Error en el servidor puente Netlify: ${err.message}`
            })
        };
    }
};

