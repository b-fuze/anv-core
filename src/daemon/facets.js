"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Facet;
(function (Facet) {
    Facet["Provider"] = "provider";
    Facet["Mirror"] = "mirror";
    Facet["GenericResolver"] = "genericresolver";
    Facet["StreamResolver"] = "streamresolver";
})(Facet = exports.Facet || (exports.Facet = {}));
class Provider {
    constructor() {
    }
}
exports.Provider = Provider;
class Mirror {
    constructor() {
    }
}
exports.Mirror = Mirror;
class GenericResolver {
    constructor() {
    }
}
exports.GenericResolver = GenericResolver;
class StreamResolver {
    constructor() {
    }
}
exports.StreamResolver = StreamResolver;
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
function registerFacet(facet, facetId, facetData) {
}
exports.registerFacet = registerFacet;
