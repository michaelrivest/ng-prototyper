
let fs = require('fs')
let path = require('path')
let common = require('./common')

function parseComponents(buildFile) {
    let components = [];
    let data = fs.readFileSync(buildFile, { encoding: 'utf8' })

    let componentDec = /(.*?)\s=\s__decorate\(([\s\S]*?)\["Component"\]\)\((\{[\s\S]*?\})\),/g
    let componentMatch;
    while ((componentMatch = componentDec.exec(data)) !== null) {
        let neededMeta = componentMatch[3].split('\n').filter((line) => {
            let nospace = line.trim()
            if (nospace.startsWith('{')) return true;
            if (nospace.startsWith('}')) return true;
            if (nospace.startsWith('selector')) return true;
            if (nospace.startsWith('template')) return true;
            if (nospace.startsWith('styles')) return true;

            return false;
        }).join('')
        if (!neededMeta.trim().endsWith("}")) neededMeta = neededMeta + "}"

        try {
            let evalC = new Function(`let __webpack_require__ = (p) => p; return ${neededMeta}`)();
            evalC.cName = componentMatch[1].trim();
            components.push(evalC)
        } catch (err) {
            console.log("Component: ")
            console.log(componentMatch[3])

            console.log("Meta:")
            console.log(neededMeta)
            console.log(err);
        }
    }
    return (components)
}

function filterDistFiles(files) {
    let excludeFiles = ['polyfills.js', 'runtime.js', 'styles.js', 'vendor.js']
    return files.filter(f => {
        if (path.extname(f) !== '.js') return false;
        else if (excludeFiles.includes(path.basename(f))) return false;
        else return true;
    })
}
function parseAll(files) {
    allComponents = [];
    for (let file of filterDistFiles(files)) {
        allComponents = allComponents.concat(parseComponents(file).filter(comp => {
            if (allComponents.find(ac => ac.cName == comp.cName)) return false;
            else return true;
        }))
    }
    return allComponents;
}

function buildComponents(project) {
    let components = parseAll(common.dirFileNames(project.path))
    for (let comp of components) {
        if (comp.styles) {
            comp.styles = comp.styles.map(s => path.join(project.root, s))
        }
        if (comp.template) {
            comp.template = path.join(project.root, comp.template)
        }

    }
    return components;
}

module.exports = buildComponents;

