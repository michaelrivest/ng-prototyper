(function NGPROTO_MAIN() {
    /* This code is injected by ng-proto for fast reloading */
    var ngProtoES = new EventSource("/NGPROTO");

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
            let preloaded = replaceStyle(data);
            if (!preloaded) {
                let existingS = NGPROTO.styles.find(s => s.selector == data.selector)
                if (existingS) existingS.styles = data.styles;
                else NGPROTO.styles.push(data)
            }
        } catch (err) {
            console.log("NGPROTO | Couldnt parse event data:")
            console.log(err)
        }
    };
}());