const express = require('express');
const router = express.Router();
const sqlRoutes = require('./sqlRoutes');
const { testConnection } = require('../config/db');

router.use('/api', sqlRoutes);

router.get('/health', async (req, res) => {
    const dbStatus = await testConnection();
    res.status(dbStatus.ok ? 200 : 503).json({
        status: dbStatus.ok ? 'healthy' : 'degraded',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: dbStatus,
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage()
    });
});

module.exports = router;

