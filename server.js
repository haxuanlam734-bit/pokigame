/**
 * SIMPLE HTTP SERVER FOR LOCAL DEVELOPMENT
 * 
 * Usage: node server.js
 * Then visit: http://localhost:8000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8000;
const HOST = 'localhost';

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
};

const server = http.createServer((req, res) => {
    // Parse URL
    const parsedUrl = url.parse(req.url);
    let pathname = `.${parsedUrl.pathname}`;
    
    // Root index
    if (pathname === './') {
        pathname = './index.html';
    }
    
    const ext = path.parse(pathname).ext;
    
    // Read file
    fs.readFile(pathname, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // 404
                res.statusCode = 404;
                res.end('404: File Not Found');
            } else {
                // Error
                res.statusCode = 500;
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            // Success
            res.statusCode = 200;
            res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain');
            res.end(data);
        }
    });
});

server.listen(PORT, HOST, () => {
    console.log(`\n🎮 Fortress Defense - Development Server`);
    console.log(`${'='.repeat(50)}`);
    console.log(`🌐 Server running at: http://${HOST}:${PORT}/`);
    console.log(`\nPress CTRL+C to stop`);
    console.log(`${'='.repeat(50)}\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down server...');
    server.close(() => {
        console.log('✅ Server stopped\n');
        process.exit(0);
    });
});
