
function accessLog(request) {
    console.log(`${request.method} ${request.url}`)
}

module.exports = function (host, port, distFolder, ngPort, cb) {
    let path = require('path')
        , fs = require('fs')
        , SSE = require('sse')
        , http = require('http')
        , httpRequest = require('request')
        , modVendor = require('./mod-vendor-file')
        , forward = require('http-forward')


    let pServer = { serveError: null, compiled: false };

    let serveUrl = `http://localhost:${ngPort}`

    pServer.onServeCompiled = function () {
        this.serveError = null;
        this.compiled = true;
    }

    pServer.onServeError = function (err) {
        this.serveError = err;
    }

    pServer.server = http.createServer((request, response) => {
        accessLog(request);
        if (!pServer.compiled) {
            response.writeHead(500, { 'Content-Type': 'text/plain' })
            return response.end("NG Serve build not yet completed")
        }
        if (pServer.serveError) {
            response.writeHead(500, { 'Content-Type': 'text/plain' })
            return response.end(pServer.serveError)
        }

        if (request.url == '/NGPROTO') {
            response.writeHead(200, { 'Content-Type': 'text/event-stream' });
            return response.end('okay');
        } else {
            var filePath = request.url.split('?reload')[0]
            if (filePath == '/') filePath = '/index.html';
            var extname = path.extname(filePath);
            var contentType = 'text/html';
            switch (extname) {
                case '.js':
                    contentType = 'text/javascript';
                    break;
                case '.css':
                    contentType = 'text/css';
                    break;
                case '.json':
                    contentType = 'application/json';
                    break;
            }

            if (filePath == '/index.html' || filePath == '/styles.css') {
                fs.readFile(path.join(distFolder, '.' + filePath), function (error, content) {
                    if (error) console.log(error);
                    response.writeHead(200, { 'Content-Type': contentType });
                    return response.end(content, 'utf-8');
                })
            } else if (filePath == '/vendor.js') {
                httpRequest(serveUrl + filePath, (err, res, body) => {
                    if (err) console.log(err);
                    modVendor.noSave(body, (err, modded) => {
                        response.writeHead(200, { 'Content-Type': contentType });
                        response.end(modded, 'utf-8')
                    })
                })

            } else {
                request.forward = { target: serveUrl }
                response.writeHead(200, { 'Content-Type': contentType });
                forward(request, response, (err) => {
                    if (err) console.log(err);
                });
            }


        }
    })
    pServer.server.on('error', (err) => console.log(err));
    pServer.server.on('connection', (socket) => {
        socket.setTimeout(500000)
    })
    pServer.server.listen(port, host, function () {
        var sse = new SSE(pServer.server, { path: "/NGPROTO" });
        sse.on('connection', function (client) {
            return cb(client);
        });
    });
    return pServer;
}
