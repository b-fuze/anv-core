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
    mirror: {},
    provider: {},
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
        for (const host of facetData.hosts) {
            exports.facetHostMap[facet][host] = facetData.name;
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
    const facetName = exports.facetHostMap[facet][parsed.host];
    if (!facetName) {
        return null;
    }
    return getFacet(facet, facetName);
}
exports.getFacetByHost = getFacetByHost;
