const crypto = require('crypto');

const SESSION_COOKIE_NAME = 'sio_gha_sid';
const SESSION_MAX_AGE_MS = parseInt(process.env.SESSION_MAX_AGE_MS, 10) || 8 * 60 * 60 * 1000; // 8 horas
const sessionStore = new Map();

// Limpieza periódica de sesiones expiradas
setInterval(() => {
    const now = Date.now();
    for (const [sid, data] of sessionStore.entries()) {
        if (now > data.expiresAt) {
            sessionStore.delete(sid);
        }
    }
}, 5 * 60 * 1000).unref();

function getSecret() {
    return process.env.SESSION_SECRET || 'default-fallback-secret-change-in-env-32bytes';
}

function signSessionId(sid) {
    const mac = crypto.createHmac('sha256', getSecret()).update(sid).digest('base64url');
    return `${sid}.${mac}`;
}

function unsignSessionId(signedValue) {
    if (!signedValue || typeof signedValue !== 'string' || !signedValue.includes('.')) {
        return null;
    }
    const [sid, mac] = signedValue.split('.');
    const expectedMac = crypto.createHmac('sha256', getSecret()).update(sid).digest('base64url');
    const a = Buffer.from(mac);
    const b = Buffer.from(expectedMac);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return null;
    }
    return sid;
}

function parseCookies(cookieHeader) {
    const list = {};
    if (!cookieHeader) return list;
    cookieHeader.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        const key = parts.shift()?.trim();
        if (key) {
            list[key] = decodeURIComponent(parts.join('=')?.trim() || '');
        }
    });
    return list;
}

function serializeSessionCookie(signedSid, req, maxAgeMs = SESSION_MAX_AGE_MS) {
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    const parts = [
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(signedSid)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${Math.floor(maxAgeMs / 1000)}`
    ];
    // Solo activar flag Secure cuando la conexión es HTTPS para no romper localhost HTTP
    if (isSecure && (req.secure || req.headers['x-forwarded-proto'] === 'https')) {
        parts.push('Secure');
    }
    return parts.join('; ');
}

function sessionMiddleware(req, res, next) {
    const cookies = parseCookies(req.headers.cookie);
    const rawCookie = cookies[SESSION_COOKIE_NAME];
    let sid = unsignSessionId(rawCookie);
    let sessionRecord = sid ? sessionStore.get(sid) : null;

    if (sessionRecord && Date.now() > sessionRecord.expiresAt) {
        sessionStore.delete(sid);
        sessionRecord = null;
        sid = null;
    }

    if (!sessionRecord) {
        sid = crypto.randomBytes(24).toString('hex');
        sessionRecord = {
            id: sid,
            user: null,
            createdAt: Date.now(),
            expiresAt: Date.now() + SESSION_MAX_AGE_MS
        };
        sessionStore.set(sid, sessionRecord);
    } else {
        // Rolling expiration
        sessionRecord.expiresAt = Date.now() + SESSION_MAX_AGE_MS;
    }

    req.session = {
        get id() {
            return sid;
        },
        get user() {
            return sessionRecord.user;
        },
        set user(val) {
            sessionRecord.user = val;
            res.setHeader('Set-Cookie', serializeSessionCookie(signSessionId(sid), req));
        },
        /**
         * Rotación segura de ID de sesión tras login exitoso (previene Session Fixation)
         */
        regenerate(userPayload) {
            if (sid) sessionStore.delete(sid);
            sid = crypto.randomBytes(24).toString('hex');
            sessionRecord = {
                id: sid,
                user: userPayload || null,
                createdAt: Date.now(),
                expiresAt: Date.now() + SESSION_MAX_AGE_MS
            };
            sessionStore.set(sid, sessionRecord);
            res.setHeader('Set-Cookie', serializeSessionCookie(signSessionId(sid), req));
        },
        destroy() {
            if (sid) sessionStore.delete(sid);
            res.setHeader('Set-Cookie', serializeSessionCookie('', req, 0));
        }
    };

    next();
}

/**
 * Middleware de protección de rutas de vistas y APIs sensibles
 */
function requireAuthView(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    next();
}

module.exports = {
    sessionMiddleware,
    requireAuthView,
    SESSION_COOKIE_NAME
};

