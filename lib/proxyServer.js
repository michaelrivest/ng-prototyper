module.exports = function (host, port, distFolder, ngPort, cb) {
    let path = require('path')
        , fs = require('fs')
        , SSE = require('sse')
        , http = require('http')
        , httpRequest = require('request')
        , modVendor = require('./mod-vendor-file')
        , forward = require('http-forward')



    let serveUrl = `http://localhost:${ngPort}`

    var server = http.createServer(function (request, response) {
        if (request.url == '/NGPROTO') {
            response.writeHead(200, { 'Content-Type': 'text/event-stream' });
            return response.end('okay');
        } else {
            var filePath = request.url.split('?reload')[0]
            console.log(filePath)
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
                case '.png':
                    contentType = 'image/png';
                    break;
                case '.jpg':
                    contentType = 'image/jpg';
                    break;
                case '.wav':
                    contentType = 'audio/wav';
                    break;
            }
            if (false && (filePath == '/index.html' || filePath == '/vendor.js' || filePath == '/styles.css')) {
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
                console.log(serveUrl)
                request.forward = { target: serveUrl }
                response.writeHead(200, { 'Content-Type': contentType });
                forward(request, response, (err) => {
                    if (err) console.log(err);
                });
                /*
                httpRequest(serveUrl, (err, res, body) => {
                    if (err) console.log(err);
                    response.writeHead(200, { 'Content-Type': contentType });
                    response.end(body, 'utf-8')
                })
                */
            }


        }
    })
    server.on('error', (err) => conosle.log(err));
    server.on('listening', () => console.log("Listening"));
    server.on('connection', (socket) => {
        socket.setTimeout(500000)
    })
    server.listen(port, host, function () {
        var sse = new SSE(server, { path: "/NGPROTO" });
        sse.on('connection', function (client) {
            return cb(client);
        });
    });
}
