// AlphaRadar Full-Stack Server: CORS proxy + Static Asset Server
const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Batch symbols list for Yahoo Finance quote endpoint
const BATCH_SYMBOLS = 'QQQ,SPY,SCHD,JEPQ,GOOGL,AMZN,000660.KS,005380.KS,017670.KS,086790.KS';

// Realistic browser User-Agent to prevent Yahoo Finance from blocking requests
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function fetchHTTPS(targetURL, callback) {
    const options = {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json'
        }
    };
    
    https.get(targetURL, options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            callback(null, res.statusCode, data);
        });
    }).on('error', (err) => {
        callback(err, null, null);
    });
}

const server = http.createServer((req, res) => {
    // Injects CORS headers for local app development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle CORS preflight options
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;
    console.log(`[AlphaRadar Server] Requested: ${req.method} ${pathname}`);
    
    // Serve Static Assets (HTML, CSS, JS, PNG)
    if (!pathname.startsWith('/api/')) {
        if (pathname === '/' || pathname === '/index.html') {
            pathname = '/index.html';
        }
        
        const filePath = path.join(__dirname, pathname);
        const ext = path.extname(filePath);
        let contentType = 'text/plain';
        if (ext === '.html') contentType = 'text/html; charset=utf-8';
        else if (ext === '.css') contentType = 'text/css';
        else if (ext === '.js') contentType = 'application/javascript';
        else if (ext === '.png') contentType = 'image/png';
        
        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'File not found' }));
                return;
            }
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            res.end(content);
        });
        return;
    }
    
    // Route 1: Batch Real-time quotes proxy
    if (pathname === '/api/quote') {
        const symbols = parsedUrl.query.symbols || BATCH_SYMBOLS;
        // Sanitize symbols list
        const sanitizedSymbols = symbols.replace(/[^a-zA-Z0-9.,-]/g, '');
        const yahooURL = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sanitizedSymbols)}`;
        
        fetchHTTPS(yahooURL, (err, statusCode, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to request Yahoo Finance quotes', details: err.message }));
                return;
            }
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(data);
        });
    } 
    // Route 2: Historical chart series proxy
    else if (pathname === '/api/chart') {
        const symbol = parsedUrl.query.symbol;
        if (!symbol) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Query parameter symbol is required' }));
            return;
        }
        
        const yahooURL = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5y&interval=1d`;
        
        fetchHTTPS(yahooURL, (err, statusCode, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to request Yahoo Finance chart data', details: err.message }));
                return;
            }
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(data);
        });
    }
    // Route 3: Yahoo Finance symbol Search suggestions proxy
    else if (pathname === '/api/search') {
        const query = parsedUrl.query.q;
        if (!query) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Query parameter q is required' }));
            return;
        }
        
        const yahooURL = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=0`;
        
        fetchHTTPS(yahooURL, (err, statusCode, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to request Yahoo Finance search suggestions', details: err.message }));
                return;
            }
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(data);
        });
    }
    // Route 4: Run Quantitative optimization backtest (Asynchronous stale-while-revalidate)
    else if (pathname === '/api/optimize') {
        const { exec } = require('child_process');
        const jsonPath = path.join(__dirname, 'optimization_results.json');
        const isWindows = process.platform === 'win32';
        const pythonCmd = isWindows ? 'python' : 'python3';
        
        // Read existing JSON results file and return immediately to prevent browser timeouts
        fs.readFile(jsonPath, 'utf8', (err, jsonContent) => {
            if (err) {
                // If it doesn't exist, we must run it once to create it
                console.log(`[AlphaRadar Server] No existing results JSON. Running ${pythonCmd} quant_optimizer.py first time...`);
                exec(`${pythonCmd} quant_optimizer.py`, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`[AlphaRadar Server] Python execution error: ${error.message}`);
                        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ error: 'Failed to run optimization script', details: error.message }));
                        return;
                    }
                    
                    fs.readFile(jsonPath, 'utf8', (err2, jsonContent2) => {
                        if (err2) {
                            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({ error: 'Failed to read results file after execution' }));
                            return;
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(jsonContent2);
                    });
                });
            } else {
                // Return existing results immediately! (Instant UI update!)
                console.log('[AlphaRadar Server] Returning existing optimization results instantly.');
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(jsonContent);
                
                // Trigger background update asynchronously
                console.log(`[AlphaRadar Server] Triggering background ${pythonCmd} quant_optimizer.py update...`);
                exec(`${pythonCmd} quant_optimizer.py`, { maxBuffer: 1024 * 1024 * 10 }, (bgError) => {
                    if (bgError) {
                        console.error(`[AlphaRadar Server] Asynchronous background update failed: ${bgError.message}`);
                    } else {
                        console.log('[AlphaRadar Server] Asynchronous background update completed successfully.');
                    }
                });
            }
        });
    }
});

server.listen(PORT, () => {
    console.log(`[AlphaRadar Server] Running at http://localhost:${PORT}`);
    console.log(`[AlphaRadar Server] To access from mobile phone: http://<YOUR-PC-IP>:${PORT}`);
});
