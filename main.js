#! /usr/bin/env node

let fs = require('fs')
let path = require('path')
let cp = require('child_process')

let css = require('css')
let argParser = require('mr-arg-parser');

let createServer = require('./lib/server');
let createProxyServer = require('./lib/proxyServer');

let GlobalStyles = require('./lib/global-styles')
let common = require('./lib/common')
let buildComponents = require('./lib/component-parser');
let modVendorFile = require('./lib/mod-vendor-file');

let prototyperArgs = [
    { arg: '-h', name: 'host', type: 'string', default: '0.0.0.0' }, // host for the reload server
    { arg: '-p', name: 'port', type: 'number', default: 8000 }, // port for the reload server

    { arg: '-s', name: 'serve', type: 'boolean' }, // Use ng serve and proxy requests to serve updates 

    { arg: '-n', name: 'noBuild', type: 'boolean' }, // Use the last build used for this project and just restart the server
    { arg: '-d', name: 'dist', type: 'string' }, // Use an already build dist directory to skip building 

    { arg: '-o', name: 'buildOptions', type: 'array' }, // additional options to the ng build command
]

let args = argParser(prototyperArgs)

let servePort = 4201;

let projectDir = path.join(__dirname, "projects")
let protoDir = args._[0] ? path.join(process.cwd(), args._[0]) : process.cwd();

function buildProjectAndStartServer(project) {
    if (args.serve && args.noBuild) {
        console.log("Skipping Project Build and Starting in serve mode")
        postBuild(project, (err, gStyles) => {
            serveProject(project, (err) => {
                if (err) console.log(err);
            })
            postServe(project, gStyles)
        })
    } else if (args.serve) {
        console.log("Starting in serve mode")
        buildProject(project, (err) => {
            if (err) console.log(err)
            else console.log("Project Built Successfully")
            postBuild(project, (err, gStyles) => {
                if (err) console.log(err);
                serveProject(project, (err) => {
                    if (err) console.log(err);
                })
                postServe(project, gStyles)
            })
        })

    } else {
        fs.mkdir(project.path, (err) => {
            if (err && err.code != 'EEXIST') cb(err);

            if (args.noBuild) {
                console.log(`Skipping Project Build - Executing post build and starting server...`)
                postBuild(project)
            } else if (args.dist) {
                let absDistDir = path.isAbsolute(args.dist) ? args.dist : path.join(process.cwd(), args.dist);
                copyDir(absDistDir, project.path, (err) => {
                    if (err) throw err;
                    console.log(`Copied Project Build from ${args.dist} - Executing post build and starting server...`)
                    postBuild(project);
                })
            } else {
                buildProject(project, (err) => {
                    console.log("Project Build Complete - Executing post build and starting server...")
                    postBuild(project);
                })
            }
        })
    }
}

function serveProject(project, cb) {
    let defaultOpts = `--sourceMap=false `;
    let buildCommand = `ng serve --host ${args.host} --port ${servePort} --live-reload false `
    if (!args.buildOptions || !args.buildOptions.length) buildCommand += defaultOpts;
    else buildCommand += defaultOpts + args.buildOptions.join(' ');
    console.log(`Serving Project ${project.name} | ${buildCommand}`)
    cp.exec(`(cd ${protoDir} && ${buildCommand})`, (err, stdout, stderr) => {
        if (err) return cb(err)
        if (stderr) return cb(stderr);
        return cb(null);
    })
}
function postServe(project, globalStyles) {
    let distDir = project.path;
    let changeBuffer = null;
    let bufferedChanges = [];
    let clients = [];

    function handleChanges() {
        let handledFiles = [];
        let reload = false;
        while (bufferedChanges.length) {
            let change = bufferedChanges.pop();
            if (handledFiles.includes(change.file)) {
                // ignore older update on same file
            } else {
                if (change.type == 'css') {
                    cssUpdate(clients, change.comp, change.file)
                } else if (change.type == 'globalcss') {
                    globalCssUpdate(clients, globalStyles)
                } else if (change.type == 'reload') {
                    reload = true;
                }
                handledFiles.push(change.file)
            }
        }
        if (reload) reloadPage(clients);
    }
    createProxyServer(args.host, args.port, distDir, servePort, (client) => {
        clients.push(client);
        console.log("Client connected. Live reloading on changes")
    })
    project.files.forEach(f => {
        if (path.extname(f) == '.ts') {
            fs.watch(f, (eventType, file) => {
                console.log(`Detected TS change: ${file}`)
                bufferedChanges.push({ type: "reload" })
                clearTimeout(changeBuffer)
                changeBuffer = setTimeout(() => { handleChanges() }, 30)
            })
        }
    })

    project.components.forEach((c) => {
        if (c.template.endsWith('html')) {
            fs.watch(c.template, (eventType, file) => {
                console.log(`Detected HTML change: ${file} - ${c.cName}`)
                bufferedChanges.push({ type: "reload" })
                clearTimeout(changeBuffer)
                changeBuffer = setTimeout(() => { handleChanges() }, 30)
            })
        }
        if (c.styles) {
            c.styles.forEach((s) => {
                fs.watch(s, (eventType, file) => {
                    console.log(`Detected CSS change: ${file} - ${c.cName}`)
                    bufferedChanges.push({ type: "css", comp: c, file: s })
                    clearTimeout(changeBuffer)
                    changeBuffer = setTimeout(() => { handleChanges() }, 30)
                })
            })
        }
    })
}

function buildProject(project, cb) {
    let defaultOpts = `--extractCss=true --sourceMap=false `;
    let buildCommand = `ng build --outputPath ${project.path} `
    if (!args.buildOptions || !args.buildOptions.length) buildCommand += defaultOpts;
    else buildCommand += defaultOpts + args.buildOptions.join(' ');
    console.log(`Building Project ${project.name}, this might take a minute... | ${buildCommand}`)
    cp.exec(`(cd ${protoDir} && ${buildCommand})`, (err, stdout, stderr) => {
        if (err) return cb(err)
        if (stderr) return cb(stderr);
        return cb(null);
    })

}

function postBuild(project, proxy) {
    let globalStyles = new GlobalStyles(project)
    project.components = buildComponents(project);
    modVendorFile.save(project, (err) => {
        if (err) throw err;
        if (!proxy) startServer(project, globalStyles)
        else return proxy(err, globalStyles);
    })
}

function copyDir(srcdir, dstdir, cb) {
    cp.exec(`cp -r ${srcdir}/* ${dstdir}`, (err, stdout, stderr) => {
        if (err) cb(err);
        else if (stderr) cb(stderr);
        else cb(null);
    })
}



function startServer(project, globalStyles) {
    let distDir = project.path;
    let changeBuffer = null;
    let bufferedChanges = [];
    let clients = [];

    function handleChanges() {
        let handledFiles = [];
        while (bufferedChanges.length) {
            let change = bufferedChanges.pop();
            if (handledFiles.includes(change.file)) {
                // ignore older update on same file
            } else {
                if (change.type == 'css') {
                    cssUpdate(clients, change.comp, change.file)
                } else if (change.type == 'globalcss') {
                    globalCssUpdate(clients, globalStyles)
                }
                handledFiles.push(change.file)
            }
        }
    }

    console.log(`Project is running on ${args.host}:${args.port}`)
    createServer(args.host, args.port, distDir, (client) => {
        clients.push(client);
        console.log("Client connected. Live reloading on changes")
    })

    fs.watch(globalStyles.globalStylesPath, (eventType, file) => {
        bufferedChanges.push({ type: "globalcss", file })
        clearTimeout(changeBuffer)
        changeBuffer = setTimeout(() => { handleChanges() }, 30)
    })

    let nowBuilding = false;
    project.components.forEach((c) => {
        if (c.styles) {
            c.styles.forEach((s) => {
                fs.watch(s, (eventType, file) => {
                    console.log(`Detected CSS change: ${file} - ${c.cName}`)
                    bufferedChanges.push({ type: "css", comp: c, file: s })
                    clearTimeout(changeBuffer)
                    changeBuffer = setTimeout(() => { handleChanges() }, 30)
                })
            })
        }
        if (c.template.endsWith('html')) {
            fs.watch(c.template, (eventType, file) => {
                if (!nowBuilding) {
                    nowBuilding = true
                    buildProject(project, (err) => {
                        if (err) console.log(err);
                        console.log("Project build complete")
                        nowBuilding = false;
                    })
                }
            })
        }
    })
}



function mapStyles(stylesheet, filename = "") {
    let parsed;
    try {
        parsed = css.parse(stylesheet);
    } catch (err) {
        console.log(`Error: ${err.reason} in ${path.basename(filename)} ${err.line}:${err.column}`)
        return null;
    }

    if (parsed.stylesheet.parsingErrors.length != 0) {
        parsed.stylesheet.parsingErrors.forEach(err => console.log(err))
        throw (Error("Error parsing stylesheet - exiting"))
    }

    for (let rule of (parsed.stylesheet.rules)) {
        if (rule.selectors) {
            rule.selectors = rule.selectors.map(s => {
                let shimmed = s.split(/\s+/g).map(i => `${i}[_ngcontent-%COMP%]`).join(' ')
                return shimmed;
            })
        }
    }
    return css.stringify(parsed).replace(/\n/g, ' ');
}

function getSelector(file, project) {
    let component;
    if (path.extname(file) == '.css') {
        component = project.components.find((comp) => {
            if (!comp.styles) return false;
            return (comp.styles.includes(file))
        })

    } else if (path.extname(file) == '.html') {
        component = project.components.find((comp) => {
            return comp.template == file;
        })
    }
    return component.selector;
}

function cssUpdate(clients, comp, file) {
    fs.readFile(file, { encoding: 'utf8' }, (err, data) => {
        if (err) console.log(err)
        let selector = comp.selector;
        let styles = mapStyles(data, file);
        clients.forEach(client => {
            if (styles) client.send(JSON.stringify({ type: 'component-css', selector, styles }));
            else client.send(JSON.stringify({ type: 'error' }))
        })
    })
}

function globalCssUpdate(clients, globalStyles) {
    globalStyles.cssUpdate((err) => {
        if (err) console.log(err);
        else {
            clients.forEach(client => {
                client.send(JSON.stringify({ type: 'global-css' }));
            })
        }
    })
}
function reloadPage(clients) {
    clients.forEach(client => {
        client.send(JSON.stringify({ type: 'reload' }));
    })
}

function initialize() {
    console.log("Gathering Project Info...")
    let ang = common.loadAngularJson(protoDir);
    if (!ang) {
        console.log("Couldnt find angular.json file")
        process.exit(1);
    }

    let srcDir = common.getAngSrcDir(protoDir)

    let project = ang.projects[ang.defaultProject]

    let pRoot = path.join(srcDir, project.root);
    let srcRoot = path.join(pRoot, project.sourceRoot)
    let p = { path: path.join(projectDir, ang.defaultProject), name: ang.defaultProject, root: pRoot, sourceRoot: srcRoot }
    p = Object.assign(p, project.architect.build.options)
    p.index = path.join(p.root, p.index);
    p.styles = p.styles.map(s => {
        return path.join(pRoot, s)
    })

    let allFiles = common.getFileData([srcRoot])
    p.files = common.flattenFileData(allFiles)

    buildProjectAndStartServer(p)
}


initialize();
