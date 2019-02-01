#! /usr/bin/env node

let fs = require('fs')
let path = require('path')
let cp = require('child_process')

let css = require('css')
let argParser = require('mr-arg-parser');

let createServer = require('./lib/server');

let common = require('./lib/common')
let buildComponents = require('./lib/component-parser');
let modVendorFile = require('./lib/mod-vendor-file');

let prototyperArgs = [
    { arg: '-h', name: 'host', type: 'string', default: '0.0.0.0' }, // host for the reload server
    { arg: '-p', name: 'port', type: 'number', default: 8000 }, // port for the reload server

    { arg: '-s', name: 'skipBuild', type: 'boolean' }, // Use the last build used for this project and just restart the server
    { arg: '-d', name: 'dist', type: 'string' }, // Use an already build dist directory to skip building 

    { arg: '-o', name: 'buildOptions', type: 'array' }, // additional options to the ng build command

]

let args = argParser(prototyperArgs)

let projectDir = path.join(__dirname, "projects")
let protoDir = args._[0] ? path.join(process.cwd(), args._[0]) : process.cwd();

function buildProject(project) {
    fs.mkdir(project.path, (err) => {
        if (err && err.code != 'EEXIST') cb(err);

        if (args.skipBuild) {
            project.components = buildComponents(project);
            startServer(project)
        } else if (args.dist) {
            let absDistDir = args.dist.includes(protoDir) ? args.dist : path.join(protoDir, args.dist);
            copyDir(absDistDir, project.path, (err) => {
                if (err) throw err;
                postBuild(project); 
            })
        } else {
            console.log("Building Project, this might take a minute...")
            let buildCommand = `ng build --outputPath ${project.path}`
            if (args.buildOptions) buildCommand += args.buildOptions.join(' ');
            cp.exec(`(cd ${protoDir} && ${buildCommand})`, (err, stdout, stderr) => {
                if (err) throw err;
                if (stderr) console.log(stderr);
                console.log("Completed Project Build")
                postBuild(project);
          })
        }
    })
}

function postBuild(project) {
        project.components = buildComponents(project);
                modVendorFile(project.path, (err) => {
                    if (err) throw err;
                    startServer(project)
                })

}

function copyDir(srcdir, dstdir, cb) {
    cp.exec(`cp -r ${srcdir}/* ${dstdir}`, (err, stdout, stderr) => {
        if (err) cb(err);
        else if (stderr) cb(stderr);
        else cb(null);
    })
}

function handleChanges(changes, clients) {
    let handledFiles = [];
    while (changes.length) {
        let change = changes.pop();
        if (handledFiles.includes(change.file)) {
            // ignore older update on same file
        } else {
            if (change.type == 'css')  {
                cssUpdate(clients, change.comp, change.file)
            }
            handledFiles.push(change.file)
        }
    }
}

function startServer(project) {
    let distDir = project.path;
    let changeBuffer = null;
    let bufferedChanges = [];

    console.log(`Project is running on ${args.host}:${args.port}`)
    let clients = [];
    createServer(args.host, args.port, distDir, (client) => {
        clients.push(client);
        console.log("Client connected. Live reloading on changes")
    })

    project.components.forEach((c) => {
        if (c.styles) {
            c.styles.forEach((s) => {
                fs.watch(s, (eventType, file) => {
                    console.log(`Detected CSS change: ${file} - ${c.cName}`)

                    bufferedChanges.push({ type: "css", comp: c, file: s })
                    clearTimeout(changeBuffer)
                    changeBuffer = setTimeout(() => {
                        handleChanges(bufferedChanges, clients)
                    }, 30)

                })
            })
        }
    })
}



function mapStyles(stylesheet) {
    let parsed = css.parse(stylesheet);
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
    return css.stringify(parsed);
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
        let styles = mapStyles(data);
        clients.forEach(client => {
            client.send(JSON.stringify({ selector, styles }));
        })
    })
}
function sseUpdater(project, client) {
    return function (file) {
        fs.readFile(file, { encoding: 'utf8' }, (err, data) => {
            if (err) console.log(err)
            let selector = getSelector(file, project)
            let styles = mapStyles(data);
            client.send(JSON.stringify({ selector, styles }));
        })
    }

}

function initialize() {
    console.log("Gathering Project Info...")
    console.log(args);
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

    p.componentPrefix = ang["schematics"]["@schematics/angular:component"]["prefix"]

    let allFiles = common.getFileData([srcRoot])
    p.files = common.flattenFileData(allFiles)

    buildProject(p)
}


initialize();
