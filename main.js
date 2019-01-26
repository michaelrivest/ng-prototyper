
let fs = require('fs')
let path = require('path');

let htmlParser = require('angular-html-parser')
let liveServer = require("live-server");

let projectDir = path.join(__dirname, "projects")
let protoDir = process.argv[2] ? path.join(process.cwd(), process.argv[2]) : process.cwd(); 
let srcDir = getAngSrcDir(protoDir);


function startServer(projectDir) {
    let liveServerParams = {
        port: 8080, host: "0.0.0.0", 
        root: projectDir, open: false, file: "index.html", 
        wait: 20, logLevel: 1, middleware: [function(req, res, next) { next(); }] 
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
                let html = `
                    <!doctype html> 
                    ${head[0]} 
                    ${stylesHTML} 
                    </head>
                    <body> 
                         ${proto} 
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

function loadProjectHTML(project, cb) {
    let htmlPath = path.join(project.path, 'index.html')
    getIndexHTML(project, (err, html) => {
            if (err) cb(err);
            fs.writeFile(htmlPath, html, (err, saved) => {
                if (err) cb(err);
                else cb(null) 
            })
        })

}

function loadProjectCSS(project, cb) {
        let cssPath = path.join(project.path, "styles.css");
        concatCSS(project, (err, styles) => {
        fs.writeFile(cssPath, styles, (err, saved) => {
                    if (err) cb(err);
                    else cb(null)
                }) 
        })
}

function getWatchFiles(project) {
    return [protoDir, project.index, ...project.styles, ...project.assets, ...project.scripts];
}

function initProject(project) {
    console.log(project);
    fs.mkdir(project.path, (err) => {
        if (err && err.code != 'EEXIST') cb(err);

     loadProjectHTML(project, (err) => {
        if (err) console.log(err)
        else loadProjectCSS(project, (err) => {
            if (err) console.log(err);
            else startServer(project.path)
        })
     })
    })
    
    let watchFiles = getWatchFiles(project);
    watchFiles.forEach(f => {
        fs.watch(f, {recursive:true}, (eventType, file) => {
            console.log(`File changed: ${file}`);
            console.log(eventType);
            let ftype = path.extname(file)
            if (ftype == '.css') {
                loadProjectCSS(project, (err) => {})
            } else if (ftype == '.html') {
                loadProjectHTML(project, (err) => {})
            }
            /*
            loadProjectFiles(project, (err) => {
                if (err) console.log(err); 
            })    
            */
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


