#! /usr/bin/env node

let fs = require('fs')
let path = require('path')
let cp = require('child_process')

let css = require('css')
let argParser = require('mr-arg-parser');

let sseServer = require('./lib/server');

let common = require('./lib/common')

let prototyperArgs = [
    { arg: '-p', name: 'port', type: 'number', default: 8000 },
    { arg: '-s', name: 'skipBuild', type: 'boolean' },
    { arg: '-h', name: 'host', type: 'string', default: '0.0.0.0' },
]

let args = argParser(prototyperArgs)

let projectDir = path.join(__dirname, "projects")
let protoDir = args._[0] ? path.join(process.cwd(), args._[0]) : process.cwd();

function buildProject(project) {
    fs.mkdir(project.path, (err) => {
        if (err && err.code != 'EEXIST') cb(err);


        let distDir = project.path;
        if (args.skipBuild) {
            startServer(project)
        } else {
            console.log("Building Project, this might take a minute...")
            let buildCommand = `ng build --outputPath ${distDir}`
            console.log(buildCommand)
            cp.exec(`(cd ${protoDir} && ${buildCommand})`, (err, stdout, stderr) => {
                if (err) throw err;
                if (stderr) console.log(stderr)
                console.log("Completed Project Build")
                modVendorFile(distDir, (err) => {
                    if (err) throw err;
                    console.log(`Project is running on ${args.host}:${args.port}`)
                    startServer(project)
                })
            })
        }
    })
}

function startServer(project) {
    let distDir = project.path;
    sseServer(args.host, args.port, distDir, (client) => {
        console.log("Client connected. Live reloading on changes")
        let onUpdate = sseUpdater(project, client)
        project.files.filter(f => path.extname(f).toLowerCase() == '.css').forEach(f => {
            fs.watch(f, (eventType, file) => {
                console.log("Detected change: " + f)
                onUpdate(f)
            })
        })
    })
}


function modVendorFile(distFolder, cb) {
    let vendorFile = path.join(distFolder, 'vendor.js')

    let vendorInsertText = fs.readFileSync(path.join(__dirname, 'vendorInsert'), { encoding: 'utf8' });
    let styleInsertText = [`styleEl.setAttribute('ngp-style-id', component.id)`]
    let style2InsertText = ['let cId = (style.match(/\\[_ngcontent-(.*?)\\]/))', `if (cId) {`,
        `console.log(cId[1])`, `styleEl.setAttribute('ngp-style-id', cId[1])`, '}']

    fs.readFile(vendorFile, { encoding: 'utf8' }, (err, data) => {
        if (err) return cb(err);
        let vendorSplit = data.split('\n')
        let domInsertStart = `renderer.applyToHost(element)`
        let domInsertText = [`if (element) {`, `window.NGPROTO.components[element.nodeName] = renderer.contentAttr.replace('_ngcontent-', '')`, `}`]
        let styleInsertStart = `var styleEl = document.createElement('style')`
        let styleInsertEnd = `_this.shadowRoot.appendChild(styleEl);`
        let style2InsertStart = `DomSharedStylesHost.prototype._addStylesToHost = function (styles, host) {`
        vendorSplit.forEach((line, i) => {
            if (line.includes(domInsertStart)) {
                let startIndex = i + 1;
                vendorSplit.splice(startIndex, 0, ...domInsertText);
            }
            if (line.includes(styleInsertStart) && vendorSplit[i + 1].includes(styleInsertEnd)) {
                let startIndex = i + 1;
                vendorSplit.splice(startIndex, 0, ...styleInsertText);
            }
            if (line.includes(style2InsertStart)) {
                let startIndex = i + 4;
                vendorSplit.splice(startIndex, 0, ...style2InsertText);
            }
        })

        let modVendorText = vendorInsertText + '\n' + vendorSplit.join('\n');
        fs.writeFile(vendorFile, modVendorText, (err) => {
            if (err) return cb(err);
            else return cb(null)
        })

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

function getSelector(file, prefix) {
    let name = path.basename(file);
    let componentName = name.split('.component')[0]
    console.log(prefix, componentName)
    return `${prefix}-${componentName}`;
}

function sseUpdater(project, client) {
    return function (file) {
        fs.readFile(file, { encoding: 'utf8' }, (err, data) => {
            if (err) console.log(err)
            let selector = getSelector(file, project.componentPrefix)
            let styles = mapStyles(data);
            client.send(JSON.stringify({ selector, styles }));
        })
    }

}

function initialize() {
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