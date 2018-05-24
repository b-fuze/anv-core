"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const anv_1 = require("anv");
let curModule = null;
exports.modules = {};
exports.validModule = /[a-zA-Z\d-]\.mod\.js/;
// Set current instance
anv_1.setInstance(class {
    static register(facet, facetOptions) {
        if (curModule) {
            console.log("MOD Register: " + curModule + ":" + facetOptions.name + " " + facet);
        }
    }
    static genericResolver(...args) {
    }
});
function loadModules(curPath, recursive = false, base = curPath, first = true) {
    const files = fs.readdirSync(curPath);
    for (const file of files) {
        const filePath = curPath + "/" + file;
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (recursive) {
                loadModules(filePath, recursive, base);
            }
        }
        else {
            if (exports.validModule.test(file)) {
                let moduleId = (path.relative(base, curPath) + path.sep + file).slice(0, -".mod.js".length);
                if (moduleId.substr(0, path.sep.length) === path.sep) {
                    moduleId = moduleId.substr(1);
                }
                curModule = moduleId;
                try {
                    exports.modules[moduleId] = require(filePath);
                }
                catch (err) {
                    // FIXME: Better error reporting
                    console.error("ANV.loadModules: Error loading " + moduleId + " \"" + filePath + "\"", err);
                }
            }
        }
    }
    if (first)
        curModule = null;
}
exports.loadModules = loadModules;
