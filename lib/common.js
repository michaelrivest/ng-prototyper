let fs = require('fs')
let path = require('path')

module.exports.getAngSrcDir = getAngSrcDir = function (startDir) {
    let dirContent = fs.readdirSync(startDir)
    if (dirContent.includes('angular.json')) {
        return startDir;
    } else {
        if (startDir == '/') return false;
        else return getAngSrcDir(path.dirname(startDir))
    }
}

module.exports.loadAngularJson = loadAngularJson = function (startDir) {
    let srcDir = getAngSrcDir(startDir)
    if (!srcDir) {
        console.log("Failed to find angular.json file")
        return false;
    } else {
        try {
            let angularJson = require(path.join(srcDir, 'angular.json'))
            return angularJson;
        } catch (err) {
            console.log("Failed to load angular.json file");
            return false;
        }
    }
}

module.exports.getFileNames = getFileNames = (files, dirName) => files.map(file => path.join(dirName, file));
module.exports.dirFileNames = dirFileNames = (dir) => getFileNames(fs.readdirSync(dir), dir);

module.exports.getDirFiles = getDirFiles = (files) => files.reduce((all, file) => {
    return file.type == 'dir' ? all.concat(getDirFiles(file.files)) : all.concat([file])
}, []);

module.exports.getFileData = getFileData = function (files) {
    return files.map((file) => {
        let stats;
        try {
            stats = fs.statSync(file);
        } catch (e) {
            exitMessage("File Not Found: " + file)
        }

        if (stats.isFile(file)) return { path: file, type: "file" };
        else if (stats.isDirectory(file)) {
            return { name: file, type: 'dir', files: getFileData(dirFileNames(file)) };
        }
    })
}

module.exports.flattenFileData = flattenFileData = function (fileData) {
    let allFiles = [];
    function flatFiles (files) {
        files.forEach((f) => {
            if (f.type == 'dir') flatFiles(f.files);
            else allFiles.push(f.path)
        })
    }    
    flatFiles(fileData);
    return allFiles;
}