module.exports = function (host, port, distFolder, cb) {
    let path = require('path')
        , fs = require('fs')
        , SSE = require('sse')
        , http = require('http');

    var server = http.createServer(function (request, response) {
        if (request.url == '/NGPROTO') {
            response.writeHead(200, { 'Content-Type': 'text/event-stream' });
            response.end('okay');
        }

        var filePath = '.' + request.url.split('?reload')[0]
        if (filePath == './')
            filePath = './index.html';

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

        fs.readFile(path.join(distFolder, filePath), function (error, content) {
            if (error) {
                if (error.code == 'ENOENT') {
                    fs.readFile(path.join(distFolder, './index.html'), function (error, content) {
                        response.writeHead(200, { 'Content-Type': contentType });
                        response.end(content, 'utf-8');
                    });
                }
                else {
                    response.writeHead(500);
                    response.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
                    response.end();
                }
            }
            else {
                response.writeHead(200, { 'Content-Type': contentType });
                response.end(content, 'utf-8');
            }
        });
    });

    server.listen(port, host, function () {
        var sse = new SSE(server, { path: "/NGPROTO" });
        sse.on('connection', function (client) {
            return cb(client);
        });
    });
}
