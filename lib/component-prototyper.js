
let fs = require('fs')
let path = require('path');
let cp = require('child_process');

let htmlParser = require('angular-html-parser')
let liveServer = require("live-server");
let argParser = require('mr-arg-parser');

let common = require('./lib/common')

let prototyperArgs = [
    { arg: '-p', name: 'port', type: 'number', default: 8080 },
    { arg: '-h', name: 'host', type: 'string', default: '0.0.0.0' },
    { arg: '--css', name: 'css', type: 'boolean', default: false }
]

let args = argParser(prototyperArgs)

let projectDir = path.join(__dirname, "projects")
let protoDir = args._[0] ? path.join(process.cwd(), args._[0]) : process.cwd();
let srcDir = common.getAngSrcDir(protoDir);



function startServer(projectDir) {
    let liveServerParams = {
        port: args.port, host: args.host,
        root: projectDir, open: false, file: "index.html",
        wait: 20, logLevel: 1, middleware: [function (req, res, next) { next(); }]
    };
    liveServer.start(liveServerParams);
}


function getIndexHTML(project, cb) {
    let stylesHTML = `<link rel = "stylesheet" type = "text/css" href = "styles.css" /></head>`
    fs.readFile(project.index, { encoding: 'utf8' }, (err, data) => {
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
    fs.readFile(project.protoHTML[0], { encoding: 'utf8' }, cb);
}

function absPath(importStatement, project) {
    let root = project.root;
    if (importStatement.indexOf("~@angular") >= 0) {
        importStatement = importStatement.replace("~@angular", path.join(root, 'node_modules/@angular'))
    } else {
        let absPSplit = importStatement.split(' ')
        absPSplit[1] = absPSplit[1].replace(/'|"|;/g, "")
        if (!absPSplit[1].startsWith(root)) absPSplit[1] = path.join(root, absPSplit[1])
        absPSplit[1] = `"${absPSplit[1]}";`
        importStatement = absPSplit.join(' ');
    }

    return importStatement;
}

function getAbsImportPaths(styles, project) {
    let importReg = /@import (.*?);/g
    let importMatch;
    while ((importMatch = importReg.exec(styles)) !== null) {
        let matchEnd = importMatch.index + importMatch[0].length
        let absP = absPath(importMatch[0], project)
        console.log(`Attempted to translate ${importMatch[0]} to absolute path: ${absP}`)
        styles = styles.slice(0, importMatch.index) + absP + styles.slice(matchEnd, styles.length)
    }
    return styles;
}

function concatCSS(project, cb) {
    let styles = "";
    let styleIndex = 0;

    let allStyles = project.styles.concat(project.protoStyles)
    for (let stylesheet of allStyles) {
        fs.readFile(stylesheet, { encoding: 'utf8' }, (err, data) => {
            if (err) return cb(err);
            styles = styles + data;
            styleIndex++;
            if (styleIndex == allStyles.length) {
                let absStyles = getAbsImportPaths(styles, project);
                return cb(null, absStyles)
            }
        })
    }
}

function loadProjectHTML(project, cb) {
    let htmlPath = path.join(project.path, 'index.html')
    getIndexHTML(project, (err, html) => {
        if (err) cb(err);

        setComponentState(html);
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
        fs.watch(f, { recursive: true }, (eventType, file) => {
            console.log(`File changed: ${file}`);
            console.log(eventType);
            let ftype = path.extname(file)
            if (ftype == '.css') {
                loadProjectCSS(project, (err) => { })
            } else if (ftype == '.html') {
                loadProjectHTML(project, (err) => { })
            }
        })
    })
}
function setComponentState(html) {
    let { rootNodes, htmlParseErrors } = htmlParser.parse(html)
    parseTemplate(rootNodes)

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

function componentProto() {
    let ang = common.loadAngularJson(protoDir);
    if (!ang) process.exit(1);
    let protoComponent = fs.readdirSync(protoDir).map(f => path.join(protoDir, f))

    let protoStyles = protoComponent.filter(f => path.extname(f) == '.css')
    let protoScripts = protoComponent.filter(f => path.extname(f) == '.ts')
    let protoHTML = protoComponent.filter(f => path.extname(f) == '.html')

    let projects = [];
    for (let project in ang.projects) {
        if (ang.projects[project].architect.build) {
            let pRoot = path.join(srcDir, ang.projects[project].root);
            let p = { path: path.join(projectDir, project), name: project, root: pRoot, protoStyles, protoScripts, protoHTML }
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

}

function cssProto() {
    console.log("Executing Fast CSS Mode")
    cp.execFile(path.join(__dirname, './fast-css.js'), {}, (err, stdout, stderr) => {
        if (err) console.log(err);
        if (stderr) console.log(stderr)
        console.log(stdout)
    })
}

function initialize() {
    if (args.css) {
        cssProto();
    } else {
        componentProto();
    }
}



initialize();
