import {parse} from "url";
import {
  Provider,
  Mirror,
  GenericResolver,
  StreamResolver,
  MediaSourceItem,
  ProviderItem,
  MirrorResult,
  getFacet,
  getFacetById,
  getFacetByHost,
} from "./facets";

type ResolveProviderCallback = (err: string, metadata: ProviderItem) => void;

function resolvePromise(promise: Promise<any>, done: ResolveProviderCallback) {
  // TODO: Add error reporting here
  promise.then(resolution => {
    if (resolution instanceof Promise) {
      resolvePromise(resolution, done);
    } else {
      done(null, resolution);
    }
  });
}

export function resolveProvider(url: string, done: ResolveProviderCallback) {
  const provider = getFacetByHost("provider", url);

  if (provider) {
    const gresolver = getFacet("genericresolver", provider.resolvers.mediaList);

    if (gresolver) {
      gresolver.resolve(url, (err, resource) => {
        if (!err) {
          const resolution: ProviderItem | Promise<any> = provider.mediaList(resource);

          if (resolution instanceof Promise) {
            resolvePromise(resolution, done);
          } else {
            done(null, resolution);
          }
        } else {
          done(err, null);
        }
      });

      provider.lastUse = Date.now();
      gresolver.lastUse = Date.now();
    } else {
      done("No generic resolver found for provider " + provider.facetId, null);
    }
  }
}

export function resolveProviderSource(url: string, direct: boolean, done: (err: string, sources: MediaSourceItem[]) => void) {
  const parsed = parse(url);

  if (!parsed.host) {
    done("Invalid url", null);
  }

  const provider = getFacetByHost("provider", url);

  if (provider) {
    if (provider.validUrl(url, false)) {
      const gresolver = getFacet("genericresolver", provider.resolvers.mediaSource);

      if (gresolver) {
        gresolver.resolve(url, (err, data) => {
          if (!err) {
            const sources = provider.mediaSource(data, direct);
            done(null, sources);
          } else {
            done(err, null);
          }
        });

        provider.lastUse = Date.now();
        gresolver.lastUse = Date.now();
      } else {
        done("No generic resolver found for provider " + provider.facetId, null);
      }
    } else {
      done("Invalid source url for provider", null);
    }
  } else {
    done("No provider found for " + parsed.host, null);
  }
}

// FIXME: Make `url`'s type more specific
export function resolveMirror(url: string, done: (err: string, url: any) => void, tier: string = null) {
  const parsed = parse(url);

  if (!parsed.host) {
    done("Invalid url", null);
  }

  const mirror = getFacetByHost("mirror", url);

  if (mirror) {
    const gresolver = getFacet("genericresolver", mirror.resolver);

    if (gresolver) {
      gresolver.resolve(url, (err, data) => {
        if (!err) {
          const resolution: string | MirrorResult | Promise<MirrorResult> = mirror.media(data, tier, url);

          if (resolution instanceof Promise) {
            resolvePromise(resolution, done);
          } else {
            done(null, resolution);
          }
        } else {
          done(err, null);
        }
      }, mirror.resolverOptions || null);

      mirror.lastUse = Date.now();
      gresolver.lastUse = Date.now();
    } else {
      done("No generic resolver \"" + mirror.resolver + "\" found for mirror " + mirror.facetId, null);
    }
  } else {
    done("No mirror found for " + parsed.host, null);
  }
}
