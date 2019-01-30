
let fs = require('fs')
let path = require('path')
let testFile = path.join(__dirname, '../projects/chad/cli-cli-module.js')

module.exports = parseComponents = function (buildFile, cb) {
    let components = [];
    let data = fs.readFileSync(buildFile, { encoding: 'utf8' })

    let componentDec = /(.*?)\s=\s__decorate\(([\s\S]*?)\)\((\{[\s\S]*?\})\),/g
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

let components = parseComponents(testFile);
console.log(components)
// AccountListComponent = __decorate([
//    Object(_angular_core__WEBPACK_IMPORTED_MODULE_0__["Component"])({
//        selector: 'app-account-list',
//       template: __webpack_require__(/*! ./account-list.component.html */ "./src/app/main/cli/account-list/account-list.component.html"),
//        styles: [__webpack_require__(/*! ./account-list.component.css */ "./src/app/main/cli/account-list/account-list.component.css")]
//    }),

