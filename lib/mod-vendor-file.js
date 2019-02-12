let fs = require('fs');
let path = require('path');

module.exports.save = function (project, cb) {
    let distFolder = project.path

    let vendorFile = path.join(distFolder, 'vendor.js')

    let vendorInsertText = fs.readFileSync(path.join(__dirname, 'vendorInsert.js'), { encoding: 'utf8' });
    let domInsertText = [`if (element) {`, `window.NGPROTO.addComp(element.nodeName, renderer.contentAttr)`, `}`]
    let styleInsertText = [`styleEl.setAttribute('ngp-style-id', component.id)`]
    let style2InsertText = ['let cId = (style.match(/\\[_ngcontent-(.*?)\\]/))', `if (cId) {`, `styleEl.setAttribute('ngp-style-id', cId[1])`, '}']

    fs.readFile(vendorFile, { encoding: 'utf8' }, (err, data) => {
        if (err) return cb(err);

        if (data.slice(0, 200) == vendorInsertText.slice(0, 200)) return cb(null)

        // data = data.replace(/\.\/node_modules/g, project.root + "/node_modules")
        let vendorSplit = data.split('\n')
        let domInsertStart = `renderer.applyToHost(element)`
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


module.exports.noSave = function (data, cb) {

    fs.readFile(path.join(__dirname, 'vendorInsert.js'), { encoding: 'utf8' }, (err, vendorInsertText) => {

        let domInsertText = [`if (element) {`, `window.NGPROTO.addComp(element.nodeName, renderer.contentAttr)`, `}`]
        let styleInsertText = [`styleEl.setAttribute('ngp-style-id', component.id)`]
        let style2InsertText = ['let cId = (style.match(/\\[_ngcontent-(.*?)\\]/))', `if (cId) {`, `styleEl.setAttribute('ngp-style-id', cId[1])`, '}']

        if (err) return cb(err);

        let vendorSplit = data.split('\n')
        let domInsertStart = `renderer.applyToHost(element)`
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
        return cb(null, modVendorText)

    })
} 