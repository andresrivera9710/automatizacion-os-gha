const express = require('express');
const fs = require('fs');
const path = require('path');
const routes = require('./routes');
const { securityHeadersMiddleware } = require('./middlewares/securityMiddleware');
const { sessionMiddleware, requireAuthView } = require('./middlewares/sessionMiddleware');
const logger = require('./utils/logger');

const app = express();
app.disable('x-powered-by');

// 1. Cabeceras HTTP de Seguridad (CSP, HSTS, X-Frame-Options, nosniff) y CORS restringido
app.use(securityHeadersMiddleware);

// 2. Parsers para JSON y URL-Encoded con límite controlado
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// 3. Gestión de Sesiones y Cookies Seguras (HttpOnly, SameSite=Lax, Secure)
app.use(sessionMiddleware);

const publicDir = path.join(__dirname, '..', 'public');
const rootDir = path.join(__dirname, '..');

function resolveIndexHtmlPath() {
    const publicIndex = path.join(publicDir, 'index.html');
    const rootIndex = path.join(rootDir, 'index.html');
    if (fs.existsSync(publicIndex)) return publicIndex;
    if (fs.existsSync(rootIndex)) return rootIndex;
    return null;
}

// 4. Flujo de Arranque: Redirección obligatoria de '/' a '/login'
app.get('/', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    return res.redirect('/welcome');
});

// 5. Ruta de Login (/login)
app.get('/login', (req, res) => {
    const indexPath = resolveIndexHtmlPath();
    if (!indexPath) {
        return res.status(404).send('Archivo index.html no encontrado.');
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.sendFile(indexPath);
});

// 6. Rutas Protegidas (/welcome, /gantt, /control-turnos, /habilitaciones, /app)
// Si el usuario no tiene sesión activa en servidor, se redirige de inmediato a /login
app.get(['/welcome', '/gantt', '/control-turnos', '/habilitaciones', '/app'], requireAuthView, (req, res) => {
    const indexPath = resolveIndexHtmlPath();
    if (!indexPath) {
        return res.status(404).send('Archivo index.html no encontrado.');
    }
    res.setHeader('Cache-Control', 'private, no-cache');
    return res.sendFile(indexPath);
});

// 7. Servir activos estáticos con políticas de Caché y ETag
app.use(express.static(publicDir, {
    index: false,
    etag: true,
    maxAge: '7d',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        }
    }
}));

// 8. Rutas de la API
app.use(routes);

// 9. Manejador de rutas no encontradas
app.use((req, res) => {
    res.status(404).json({
        resultado: -1,
        mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
    });
});

// 10. Manejador global de errores (sin filtrar trazas internas en producción)
app.use((err, req, res, next) => {
    logger.error('Error no controlado en la aplicación Express', err);
    res.status(500).json({
        resultado: -1,
        mensaje: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

module.exports = app;
