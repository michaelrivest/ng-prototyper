(function NGPROTO_MAIN() {
    /* This code is injected by ng-proto for fast reloading */
    var ngProtoES = new EventSource("/NGPROTO");
    function ngpLog(item) {
        if (typeof item == typeof "") {
            console.log(`-ngp: ${item}`)
        } else {
            console.log('-ngp: ')
            console.log(item)
        }
    }
    function flashError(err) {
        let errDiv = document.createElement('div')
        errDiv.id = "ngp-err-div"
        errDiv.style = "overflow-y:auto;padding: 10%;color: white; height: 100vh; width: 100%; background-color: red; position: absolute; top: 0px; left: 0px; transition: all .3s; z-index:10000; opacity: .95;"
        if (err) {
            let errText = document.createElement('span');
            errText.style = "font-size:17px;"
            errText.innerText = err;
            errDiv.appendChild(errText)
        }
        let errClose = document.createElement('div');
        errClose.style = "position: absolute; top: 0px;right: 45px;font-size: 80px;cursor: pointer;"
        errClose.innerText = "x";
        errClose.addEventListener('click', (e) => {
            errDiv.style.opacity = '0'
            setTimeout(() => {
                docbody.removeChild(errDiv)
            }, 300)

        })
        errDiv.appendChild(errClose)
        let docbody = document.getElementsByTagName('body')[0];
        docbody.appendChild(errDiv)
    }

    function replaceStyle(data) {
        let cId = NGPROTO.components[data.selector.toUpperCase()];
        let sel = `style[ngp-style-id='${cId}']`
        let styleEl = document.querySelectorAll(sel)
        if (styleEl && styleEl[0]) {
            styleEl[0].innerText = data.styles.replace(/%COMP%/g, cId)
            return true;
        } else {
            return false;
        }
    }
    function reloadStylesheets() {
        let queryString = '?reload=' + new Date().getTime();
        let ssheets = document.querySelectorAll('link[rel="stylesheet"]');
        ssheets.forEach((ssheet) => {
            if (ssheet.href.indexOf('styles.css') >= 0) ssheet.href = ssheet.href.replace(/\?.*|$/, queryString);
        })
    }
    window.NGPROTO = {
        components: {},
        styles: [],
        addComp: function (compName, contentAttr) {
            this.components[compName] = contentAttr.replace('_ngcontent-', '')
            this.styles.forEach((s, i) => {
                if (s.selector.toUpperCase() == compName) {
                    if (replaceStyle(s)) this.styles.splice(i, 1)
                }
            })
        }
    };

    ngProtoES.onmessage = function (event) {
        try {
            let data = JSON.parse(event.data);
            if (data.type == 'component-css') {
                ngpLog("Refreshing component styles: " + data.selector)
                let preloaded = replaceStyle(data);
                if (!preloaded) {
                    let existingS = NGPROTO.styles.find(s => s.selector == data.selector)
                    if (existingS) existingS.styles = data.styles;
                    else NGPROTO.styles.push(data)
                }
            } else if (data.type == 'global-css') {
                ngpLog("Refreshing Global Styles")
                reloadStylesheets();
            } else if (data.type == 'error') {
                ngpLog("Encountered an error - Check log output")
                flashError(data.error)
            } else if (data.type == 'reload') {
                ngpLog("HTML/TS Change - Reloading...")
                window.location.reload()
            }
        } catch (err) {
            ngpLog("NGPROTO | Couldnt parse event data:")
            ngpLog(err)
        }
    };
}());