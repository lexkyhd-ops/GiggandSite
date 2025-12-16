const express = require('express');
const path = require('path');

const app = express();

// Serve static files with correct MIME types
app.get('/style.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(__dirname, '..', 'style.css'));
});

app.get('/client.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(__dirname, '..', 'client.js'));
});

module.exports = app;

