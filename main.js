
let htmlParser = require('angular-html-parser')
let fs = require('fs')
let path = require('path');

let projectDir = path.join(__dirname, "projects")
let protoDir = process.argv[2] ? path.join(process.cwd(), process.argv[2]) : process.cwd(); 
let srcDir = getAngSrcDir(protoDir);

let liveServer = require("live-server");

function startServer(projectDir) {
    let liveServerParams = {
        port: 8080, // Set the server port. Defaults to 8080.
        host: "0.0.0.0", // Set the address to bind to. Defaults to 0.0.0.0 or process.env.IP.
        root: projectDir, // Set root directory that's being served. Defaults to cwd.
        open: false, // When false, it won't load your browser by default.
        file: "index.html", // When set, serve this file (server root relative) for every 404 (useful for single-page applications)
        wait: 20, // Waits for all changes, before reloading. Defaults to 0 sec.
        logLevel: 1, // 0 = errors only, 1 = some, 2 = lots
        middleware: [function(req, res, next) { next(); }] // Takes an array of Connect-compatible middleware that are injected into the server middleware stack
    };

    liveServer.start(liveServerParams);
}

function getAngSrcDir(startDir) {
    let dirContent = fs.readdirSync(startDir)
    if (dirContent.includes('angular.json')) {
        return startDir;
    } else {
        if (startDir == '/') return false;
        else return getAngSrcDir(path.dirname(startDir))
    }
}


function getIndexHTML(project, cb) {
    let stylesHTML = `<link rel = "stylesheet" type = "text/css" href = "styles.css" /></head>`
    fs.readFile(project.index, {encoding: 'utf8'}, (err, data) => {
        if (err) console.log(err);
        let head = data.match(/(<head>.*)<\/head>/is)
        getProtoHTML(project, (err, proto) => {
            if (err) return cb(err);
            else {
                let html = `<!doctype html>` + head[0] + stylesHTML + `<body>` + proto + `</body>`;
                return cb(null, html);
            }
        
        })
    })
}

function getHTML(project, styles, cb) {
    fs.readFile(project.index, {encoding: 'utf8'}, (err, data) => {
        if (err) console.log(err);
        let head = data.match(/(<head>.*<\/head>)/is)
        getProtoHTML(project, (err, proto) => {
            if (err) return cb(err);
            else {
                let html = `<!doctype html>
                    ${head[0]}
                    <body>
                        ${proto}
                        <style>
                            ${styles}
                        </style>
                    </body>`;
                return cb(null, html);
            }
        
        })
    })

}

function getProtoHTML(project, cb) {
    fs.readFile(project.protoHTML[0], {encoding: 'utf8'}, cb);
}

function loadAngularJson() {
    if (!srcDir) {
        console.log("Failed to find angular.json file")
        return false;
    } else {
        try {
            let angularJson = require(path.join(srcDir, 'angular.json'))
            return angularJson;
        } catch(err) {
            console.log("Failed to load angular.json file");
            return false;
        }
    }
}

function getAbsImportPaths(styles) {
    let importReg = /@import (.*?);/g
    let importMatch;
    while ((importMatch = importReg.exec(styles)) !== null) {

    console.log(importMatch[0]);
    let matchEnd = importMatch.index + importMatch[0].length
    console.log(importMatch.index);
    console.log(matchEnd);

    }

}

function concatCSS (project, cb) {
    let styles = "";
    let styleIndex = 0;

    let allStyles = project.styles.concat(project.protoStyles)
    for (let stylesheet of allStyles) {
        fs.readFile(stylesheet, {encoding: 'utf8'}, (err, data) => {
            if (err) return cb(err);
            styles = styles + data; 
            styleIndex++;
            if (styleIndex == allStyles.length) {
                getAbsImportPaths(styles);
                return cb(null, styles)
            }
        }) 
    }
}

function loadProjectFiles(project, cb) {
        let cssPath = path.join(project.path, "styles.css");
        concatCSS(project, (err, styles) => {
            if (err) console.log(err);
            else {
            let htmlPath = path.join(project.path, 'index.html')
                getHTML(project, styles, (err, html) => {
                fs.writeFile(htmlPath, html, (err, saved) => {
                    if (err) cb(err);
                    else {
                        cb(null)
                    }
                })   
                })
            }
        })

        
/*
        getIndexHTML(project, (err, html) => {
            if (err) console.log(err);
            fs.writeFile(htmlPath, html, (err, saved) => {
                if (err) cb(err);
                else {
                }
            })
        })
        */
}

function getWatchFiles(project) {
    return [protoDir, project.index, ...project.styles, ...project.assets, ...project.scripts];
}

function initProject(project) {
    console.log(project);
    fs.mkdir(project.path, (err) => {
        if (err && err.code != 'EEXIST') cb(err);

        console.time('load files')
        loadProjectFiles(project, (err) => {
            if (err) console.log(err);
            else {
                console.timeEnd('load files')
                startServer(project.path)
            }
        })
    })
    
    let watchFiles = getWatchFiles(project);
    watchFiles.forEach(f => {
        fs.watch(f, {recursive:true}, (eventType, file) => {
            console.log(`File changed: ${file}`);
            console.log(eventType);
            loadProjectFiles(project, (err) => {
                if (err) console.log(err); 
            })    
        })
    })
    
}

function parseTemplate(nodes) {
    for (let ele of nodes) {
        if (ele.name == 'body') {
            parseElement(ele);
        }
    }
}

function parseElement(node) {
    console.log(node);
    if (node.children) {
        for (let child of node.children) {
                parseElement(child)
        }
    }
    
}

function initialize() {
    console.time("init")
    let ang = loadAngularJson();
    if (!ang) process.exit(1);


    let protoComponent = fs.readdirSync(protoDir).map(f => path.join(protoDir, f))

    let protoStyles = protoComponent.filter(f => path.extname(f) == '.css')
    let protoScripts = protoComponent.filter(f => path.extname(f) == '.ts')
    let protoHTML = protoComponent.filter(f => path.extname(f) == '.html')
    
    let projects = [];
    for (let project in ang.projects) {
        if (ang.projects[project].architect.build) {
            let pRoot = path.join(srcDir, ang.projects[project].root);
            let p = {path: path.join(projectDir, project), name: project, root: pRoot, protoStyles, protoScripts, protoHTML }
            p = Object.assign(p, ang.projects[project].architect.build.options)
            p.index = path.join(p.root, p.index);
            p.styles = p.styles.map(s => path.join(p.root, s))
            p.assets = p.assets.map(a => path.join(p.root, a))
            p.scripts = p.scripts.map(s => path.join(p.root, s))
            projects.push(p);        
        }
    }

    projects.forEach(p => {
        initProject(p);
    })

    console.timeEnd("init")
}



initialize();


