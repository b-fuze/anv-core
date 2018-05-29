"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
exports.facetStateIdMap = {
    provider: {},
    mirror: {},
    genericresolver: {},
    streamresolver: {},
};
exports.facetTiers = {
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
        exports.facetTiers[facet][facetId] = Object.keys(facetData.tiers);
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
