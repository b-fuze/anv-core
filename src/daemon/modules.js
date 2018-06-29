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
const sanitize_1 = require("./sanitize");
const facets_1 = require("./facets");
let curModule = null;
exports.modules = {};
exports.validModule = /[a-zA-Z\d-]\.mod\.js/;
// Set current instance
anv_1.setInstance(class {
    static register(facet, facetOptions) {
        if (curModule) {
            if (sanitize_1.sanitize.hasOwnProperty(facet)) {
                const { errors, data } = sanitize_1.sanitize[facet](facetOptions);
                const facetId = curModule + ":" + facetOptions.name;
                data.facetId = facetId;
                const conflict = !!facets_1.getFacetById(facet, facetId);
                if (errors.length || conflict) {
                    if (conflict) {
                        errors.push("Facet conflict: " + facetId + " already exists");
                    }
                    console.error("Errors processing " + facet + " " + facetId + "\n" + errors.join("\n") + "\n");
                }
                else {
                    // Add lastUse
                    data.lastUse = 0;
                    if (facet === "mirror") {
                        data.connectionCount = 0;
                    }
                    facets_1.registerFacet(facet, facetId, data);
                    console.log("Registered " + facet + " " + facetId);
                }
            }
            else {
                console.error("Error loading " + curModule + ": No such facet \"" + facet + "\"");
            }
        }
    }
    static genericResolver(name, url, done, options) {
        const resolver = facets_1.getFacet("genericresolver", name);
        if (resolver) {
            resolver.resolve(url, done, options);
        }
        return !!resolver;
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
