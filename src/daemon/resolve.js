"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const url_1 = require("url");
const facets_1 = require("./facets");
function resolvePromise(promise, done) {
    // TODO: Add error reporting here
    promise.then(resolution => {
        if (resolution instanceof Promise) {
            resolvePromise(resolution, done);
        }
        else {
            done(null, resolution);
        }
    });
}
function resolveProvider(url, done) {
    const provider = facets_1.getFacetByHost("provider", url);
    if (provider) {
        const gresolver = facets_1.getFacet("genericresolver", provider.resolvers.mediaList);
        if (gresolver) {
            gresolver.resolve(url, (err, resource) => {
                if (!err) {
                    const resolution = provider.mediaList(resource);
                    if (resolution instanceof Promise) {
                        resolvePromise(resolution, done);
                    }
                    else {
                        done(null, resolution);
                    }
                }
                else {
                    done(err, null);
                }
            });
            provider.lastUse = Date.now();
            gresolver.lastUse = Date.now();
        }
        else {
            done("No generic resolver found for provider " + provider.facetId, null);
        }
    }
}
exports.resolveProvider = resolveProvider;
function resolveProviderSource(url, direct, done) {
    const parsed = url_1.parse(url);
    if (!parsed.host) {
        done("Invalid url", null);
    }
    const provider = facets_1.getFacetByHost("provider", url);
    if (provider) {
        if (provider.validUrl(url, false)) {
            const gresolver = facets_1.getFacet("genericresolver", provider.resolvers.mediaSource);
            if (gresolver) {
                gresolver.resolve(url, (err, data) => {
                    if (!err) {
                        const sources = provider.mediaSource(data, direct);
                        done(null, sources);
                    }
                    else {
                        done(err, null);
                    }
                });
                provider.lastUse = Date.now();
                gresolver.lastUse = Date.now();
            }
            else {
                done("No generic resolver found for provider " + provider.facetId, null);
            }
        }
        else {
            done("Invalid source url for provider", null);
        }
    }
    else {
        done("No provider found for " + parsed.host, null);
    }
}
exports.resolveProviderSource = resolveProviderSource;
// FIXME: Make `url`'s type more specific
function resolveMirror(url, done, tier = null) {
    const parsed = url_1.parse(url);
    if (!parsed.host) {
        done("Invalid url", null);
    }
    const mirror = facets_1.getFacetByHost("mirror", url);
    if (mirror) {
        const gresolver = facets_1.getFacet("genericresolver", mirror.resolver);
        if (gresolver) {
            gresolver.resolve(url, (err, data) => {
                if (!err) {
                    const streamUrl = mirror.media(data, tier, url);
                    done(null, streamUrl);
                }
                else {
                    done(err, null);
                }
            });
            mirror.lastUse = Date.now();
            gresolver.lastUse = Date.now();
        }
        else {
            done("No generic resolver found for mirror " + mirror.facetId, null);
        }
    }
    else {
        done("No mirror found for " + parsed.host, null);
    }
}
exports.resolveMirror = resolveMirror;
