const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const logger = require('./utils/logger');

const app = express();

// Middleware CORS y Private Network Access (PNA para soporte file:// y localhost)
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Access-Control-Request-Private-Network');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

// Parsers para JSON y URL-Encoded con límite ampliado para contenido HTML
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir frontend estático
// 1. Si existe carpeta public, servir desde public
// 2. Si index.html está en la raíz del módulo, servirlo directamente
const publicDir = path.join(__dirname, '..', 'public');
const rootDir = path.join(__dirname, '..');

app.use(express.static(publicDir));
app.use(express.static(rootDir, {
    index: false // Evitar colisión con la ruta personalizada '/'
}));

// Rutas de la API
app.use(routes);

// Ruta principal para servir index.html
app.get(['/', '/index.html'], (req, res) => {
    const publicIndex = path.join(publicDir, 'index.html');
    const rootIndex = path.join(rootDir, 'index.html');

    const fs = require('fs');
    if (fs.existsSync(rootIndex)) {
        return res.sendFile(rootIndex);
    } else if (fs.existsSync(publicIndex)) {
        return res.sendFile(publicIndex);
    } else {
        return res.status(404).send('Archivo index.html no encontrado.');
    }
});

// Manejador de rutas no encontradas
app.use((req, res) => {
    res.status(404).json({
        resultado: -1,
        mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
    });
});

// Manejador global de errores
app.use((err, req, res, next) => {
    logger.error('Error no controlado en la aplicación Express', err);
    res.status(500).json({
        resultado: -1,
        mensaje: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

module.exports = app;

