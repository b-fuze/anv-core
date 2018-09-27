import * as fs from "fs";
import * as path from "path";
import {setInstance, RegisterFacetTypeMap} from "anv";
import {sanitize} from "./sanitize";
import {Mirror, registerFacet, getFacet, getFacetById, GenericResolver} from "./facets";
import {state} from "./state";

let curModule: string = null;

export const modules: {
  [module: string]: Object;
} = {};

export const validModule = /[a-zA-Z\d-]\.mod\.js/;

// Set current instance
setInstance(class {
  static register<facet extends keyof RegisterFacetTypeMap>(facet: facet, facetOptions: RegisterFacetTypeMap[facet]) {
    if (curModule) {
      if (sanitize.hasOwnProperty(facet)) {
        const {errors, data} = sanitize[facet](facetOptions);
        const facetId = curModule + ":" + facetOptions.name;
        data.facetId = facetId;

        const conflict = !!getFacetById(facet, facetId);

        if (errors.length || conflict) {
          if (conflict) {
            errors.push("Facet conflict: " + facetId + " already exists");
          }

          console.error("Errors processing " + facet + " " + facetId + "\n" + errors.join("\n") + "\n");
        } else {
          // Add lastUse
          data.lastUse = 0;

          if (facet === "mirror") {
            (<Mirror> data).connectionCount = 0;
          }

          registerFacet(facet, facetId, <any>data);
          console.log("Registered " + facet + " " + facetId);
        }
      } else {
        console.error("Error loading " + curModule + ": No such facet \"" + facet + "\"");
      }
    }
  }

  static genericResolver(name: string, url: string, done: (data: any) => void, options: any): boolean {
    const resolver = <GenericResolver> getFacet("genericresolver", name);

    if (resolver) {
      resolver.resolve(url, done, options);
    }

    return !!resolver;
  }
});

export
function loadModules(curPath: string, recursive: boolean = false, base: string = curPath, first: boolean = true) {
  const files = fs.readdirSync(curPath);
  const syncFn = state.moduleFollowSymlinks ? fs.statSync : fs.lstatSync;

  for (const file of files) {
    const filePath = curPath + "/" + file;
    const stat = syncFn(filePath);

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
