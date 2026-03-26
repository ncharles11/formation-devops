const express = require('express');
const pinoHttp = require('pino-http');
const { Pool } = require('pg');

const app = express();
const logger = pinoHttp();
const PORT = process.env.PORT || 3001;

app.use(logger);
app.use(express.json());

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'formation',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: process.env.APP_VERSION || '1.1.0' });
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
