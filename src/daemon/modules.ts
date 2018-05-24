import * as fs from "fs";
import * as path from "path";
import {setInstance, RegisterFacetTypeMap} from "anv";
import {registerFacet} from "./facets";

let curModule: string = null;

export const modules: {
  [module: string]: Object;
} = {};

export const validModule = /[a-zA-Z\d-]\.mod\.js/;

// Set current instance
setInstance(class {
  static register<facet extends keyof RegisterFacetTypeMap>(facet: facet, facetOptions: RegisterFacetTypeMap[facet]) {
    if (curModule) {
      console.log("MOD Register: " + curModule + ":" + facetOptions.name + " " + facet);
    }
  }

  static genericResolver(...args: any[]) {

  }
});

export
function loadModules(curPath: string, recursive: boolean = false, base: string = curPath, first: boolean = true) {
  const files = fs.readdirSync(curPath);

  for (const file of files) {
    const filePath = curPath + "/" + file;
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (recursive) {
        loadModules(filePath, recursive, base);
      }
    } else {
      if (validModule.test(file)) {
        let moduleId = (path.relative(base, curPath) + path.sep + file).slice(0, -".mod.js".length);
        if (moduleId.substr(0, path.sep.length) === path.sep) {
          moduleId = moduleId.substr(1);
        }

        curModule = moduleId;

        try {
          modules[moduleId] = require(filePath);
        } catch (err) {
          // FIXME: Better error reporting
          console.error("ANV.loadModules: Error loading " + moduleId + " \"" + filePath + "\"", err);
        }
      }
    }
  }

  if (first) curModule = null;
}
