"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const url_1 = require("url");
const state_1 = require("./state");
var Facet;
(function (Facet) {
    Facet["Provider"] = "provider";
    Facet["Mirror"] = "mirror";
    Facet["GenericResolver"] = "genericresolver";
    Facet["StreamResolver"] = "streamresolver";
})(Facet = exports.Facet || (exports.Facet = {}));
exports.facetStore = {
    provider: {},
    mirror: {},
    genericresolver: {},
    streamresolver: {},
};
exports.facetIdMap = {
    provider: {},
    mirror: {},
    genericresolver: {},
    streamresolver: {},
};
global.ANV.facetStore = exports.facetStore;
exports.facetStateIdMap = {
    provider: {},
    mirror: {},
    genericresolver: {},
    streamresolver: {},
};
// Facet tiers
exports.facetTiers = {
    mirror: {},
    provider: {},
};
exports.facetHostMap = {
    mirror: {
        string: {},
        regex: [],
    },
    provider: {
        string: {},
        regex: [],
    },
};
function registerFacet(facet, facetId, facetData) {
    if (!exports.facetStore[facet][facetData.name]) {
        exports.facetStore[facet][facetData.name] = [];
    }
    // FIXME: Check why I had to cast this to any[]
    exports.facetStore[facet][facetData.name].push(facetData);
    exports.facetStore[facet][facetData.name].sort((a, b) => b.weight - a.weight);
    exports.facetIdMap[facet][facetId] = facetData;
    exports.facetStateIdMap[facet][facetId] = {
        lastUse: 0,
        activeUserCount: 0,
    };
    // Load tiers
    if (facet === "mirror" || facet === "provider") {
        const curFacetTiers = facetData.tiers;
        // FIXME: Fix these types
        exports.facetTiers[facet][facetId] = curFacetTiers;
        state_1.state.task.tiers[facet][facetData.name] = curFacetTiers;
        state_1.defaultState.task.tiers[facet][facetData.name] = curFacetTiers;
        const facetHostBase = exports.facetHostMap[facet];
        for (const host of facetData.hosts) {
            if (typeof host === "string") {
                facetHostBase.string[host] = facetData.name;
            }
            else {
                facetHostBase.regex.push([host, facetData.facetId]);
            }
        }
    }
}
exports.registerFacet = registerFacet;
function getFacet(facet, facetName) {
    return (exports.facetStore[facet][facetName] || [null])[0];
}
exports.getFacet = getFacet;
function getFacetById(facet, facetId) {
    return exports.facetIdMap[facet][facetId] || null;
}
exports.getFacetById = getFacetById;
function getFacetByHost(facet, url) {
    const parsed = url_1.parse(url);
    if (!parsed.host) {
        return null;
    }
    const facetBase = exports.facetHostMap[facet];
    const facetName = facetBase.string[parsed.host];
    if (!facetName) {
        // Try to get it by regex
        for (const [regex, facetId] of facetBase.regex) {
            if (regex.test(parsed.host)) {
                // FIXME: Test for others too
                return getFacetById(facet, facetId);
            }
        }
        return null;
    }
    return getFacet(facet, facetName);
}
exports.getFacetByHost = getFacetByHost;
