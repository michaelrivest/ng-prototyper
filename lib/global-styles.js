let autoprefixer = require('autoprefixer');
let postcss = require('postcss');
let path = require('path')
let fs = require('fs');

class GlobalStyles {
    constructor(project) {
        this.globalStylesPath = project.styles.find(s => path.basename(s) == 'styles.css');
        this.builtStylesPath = path.join(project.path, 'styles.css');
        this.getAddedLines(this.globalStylesPath, this.builtStylesPath, (err, importedCSS) => {
            if (err) console.log(err);
            this.importedCSS = importedCSS;
        })
    }

    getAddedLines(originalFile, modFile, cb) {
        let addedLines = [];
        fs.readFile(originalFile, { encoding: 'utf8' }, (err, originalFileData) => {
            if (err) return cb(err);
            fs.readFile(modFile, { encoding: 'utf8' }, (err, modFileData) => {
                if (err) return cb(err);
                postcss([autoprefixer({ grid: "no-autoplace" })]).process(originalFileData).then(function (result) {
                    result.warnings().forEach(function (warn) {
                        // console.warn(warn.toString());
                    });

                    result.css = result.css.split('\n').map(l => l.trim()).join('\n').replace(/\n+/g, '\n')
                    modFileData = modFileData.split('\n').map(l => l.trim()).join('\n').replace(/\n+/g, '\n')
                    let origFileSplit = result.css.split('\n')
                    let modFileSplit = modFileData.split('\n')


                    let origIndex = 0;
                    for (let modIndex = 0; modIndex < modFileSplit.length; modIndex++) {
                        while (origIndex < origFileSplit.length && origFileSplit[origIndex].includes("@import")) origIndex++;
                        if (modFileSplit[modIndex] == origFileSplit[origIndex]) {
                            origIndex++;
                        } else {
                            addedLines.push(modFileSplit[modIndex]);
                        }
                    }

                    return cb(null, addedLines.join(' '))
                });


            })
        })
    }


    replaceImports(stylePath, cb) {
        fs.readFile(stylePath, { encoding: 'utf8' }, (err, styles) => {
            let styleArr = [];
            let byLine = styles.split('\n');
            byLine.forEach(l => {
                if (!l.includes('@import')) styleArr.push(l)
            })
            styleArr.push(this.importedCSS)
            return cb(styleArr.join('\n'))
        })
    }

    cssUpdate(cb) {
        this.replaceImports(this.globalStylesPath, (globalStyles) => {
            fs.writeFile(this.builtStylesPath, globalStyles, (err) => {
                cb(err);
            })
        })
    }

}

module.exports = GlobalStyles;