const express = require('express');
const pinoHttp = require('pino-http');
const { Pool } = require('pg');
const client = require('prom-client');

const app = express();
const logger = pinoHttp();
const PORT = process.env.PORT || 3001;

// Prometheus — métriques par défaut (CPU, mémoire, etc.)
const register = new client.Registry();

// Compteur de requêtes HTTP
const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
});

// Histogramme de la durée des requêtes HTTP
const httpRequestDurationSeconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [register],
});

app.use(logger);
app.use(express.json());

// Middleware d'instrumentation Prometheus
app.use((req, res, next) => {
    const end = httpRequestDurationSeconds.startTimer();
    res.on('finish', () => {
        const route = req.route ? req.route.path : req.path;
        const labels = { method: req.method, route, status_code: res.statusCode };
        httpRequestsTotal.inc(labels);
        end(labels);
    });
    next();
});

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'formation',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: process.env.APP_VERSION || '1.0.0' });
});

app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

app.get('/api/items', async (req, res) => {
    const result = await pool.query('SELECT id, name, created_at FROM items ORDER BY created_at DESC LIMIT 50');
    res.json(result.rows);
});

app.post('/api/items', async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'name is required' });
    }
    const result = await pool.query(
        'INSERT INTO items (name) VALUES ($1) RETURNING id, name, created_at',
        [name.trim()],
    );
    res.status(201).json(result.rows[0]);
});

app.listen(PORT, () => {
    process.stdout.write(`Server listening on port ${PORT}\n`);
});

module.exports = app;
