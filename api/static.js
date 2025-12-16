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

// Serve images
app.get('/images/:filename', (req, res) => {
    const filename = req.params.filename;
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'image/png';
    
    if (ext === '.jpg' || ext === '.jpeg') {
        contentType = 'image/jpeg';
    } else if (ext === '.gif') {
        contentType = 'image/gif';
    } else if (ext === '.webp') {
        contentType = 'image/webp';
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache images for 24 hours
    res.sendFile(path.join(__dirname, '..', 'images', filename));
});

module.exports = app;

