const logger = require('../utils/logger');

/**
 * Orígenes permitidos para CORS (evita comodín * en producción)
 */
function getAllowedOrigins() {
    const envOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
        : [];
    const defaults = [
        'https://automatizacion-os-gha.netlify.app',
        'http://localhost:3080',
        'http://127.0.0.1:3080'
    ];
    return Array.from(new Set([...defaults, ...envOrigins]));
}

/**
 * Middleware de Cabeceras HTTP de Seguridad (equivalente a Helmet) y CORS restringido
 */
function securityHeadersMiddleware(req, res, next) {
    // 1. Cabeceras de Seguridad HTTP
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
    );
    res.setHeader(
        'Content-Security-Policy',
        [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "connect-src 'self' http://localhost:3080 http://127.0.0.1:3080 https://api.ipify.org",
            "frame-src 'self' blob: data:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ].join('; ')
    );

    // 2. Política CORS restringida por lista blanca
    const origin = req.headers.origin;
    const allowedOrigins = getAllowedOrigins();
    if (origin && (allowedOrigins.includes(origin) || origin === 'null')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (!origin) {
        // Peticiones same-origin
        res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-CSRF-Token, Access-Control-Request-Private-Network'
    );
    res.setHeader('Access-Control-Allow-Private-Network', 'true');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
}

/**
 * Rate Limiter en memoria para mitigar ataques de fuerza bruta y abuso de endpoints
 */
function createRateLimiter({ windowMs = 15 * 60 * 1000, maxRequests = 15, message = 'Demasiadas solicitudes desde esta IP. Intente nuevamente más tarde.' }) {
    const hits = new Map();

    // Limpieza periódica para evitar fugas de memoria
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits.entries()) {
            if (now > entry.resetAt) {
                hits.delete(key);
            }
        }
    }, Math.min(windowMs, 60000)).unref();

    return function rateLimitMiddleware(req, res, next) {
        const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
        const now = Date.now();
        let record = hits.get(clientIp);

        if (!record || now > record.resetAt) {
            record = { count: 0, resetAt: now + windowMs };
            hits.set(clientIp, record);
        }

        record.count += 1;
        const remaining = Math.max(0, maxRequests - record.count);
        res.setHeader('X-RateLimit-Limit', String(maxRequests));
        res.setHeader('X-RateLimit-Remaining', String(remaining));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));

        if (record.count > maxRequests) {
            logger.warn(`[SEGURIDAD - RATE LIMIT] IP bloqueada temporalmente por exceso de peticiones: ${clientIp}`);
            return res.status(429).json({
                resultado: -1,
                mensaje: message
            });
        }

        next();
    };
}

/**
 * Validación contra bots mediante campo Honeypot
 */
function verifyAntiBotHoneypot(req, res, next) {
    const honeypot = req.body?.website_hp || req.body?.honeypot;
    if (honeypot && String(honeypot).trim() !== '') {
        logger.warn(`[SEGURIDAD - ANTI-BOT] Detección de bot por campo honeypot desde IP: ${req.ip}`);
        return res.status(403).json({
            resultado: -1,
            mensaje: 'Solicitud rechazada por validación de seguridad anti-bot.'
        });
    }
    next();
}

const loginRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 12,
    message: 'Demasiados intentos de inicio de sesión con PIN. Por seguridad, espere 15 minutos antes de volver a intentar.'
});

const apiRateLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 120,
    message: 'Límite de peticiones excedido. Por favor espere unos segundos.'
});

module.exports = {
    securityHeadersMiddleware,
    createRateLimiter,
    loginRateLimiter,
    apiRateLimiter,
    verifyAntiBotHoneypot
};

