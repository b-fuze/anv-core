export enum Facet {
  Provider = "provider",
  Mirror = "mirror",
  GenericResolver = "genericresolver",
  StreamResolver = "streamresolver",
}

export
class Provider {
  provider: string;

  constructor() {

  }
}

export
class Mirror {
  mirror: string;

  constructor() {

  }
}

export
class GenericResolver {
  generic: string;

  constructor() {

  }
}

export
class StreamResolver {
  stream: string;

  constructor() {

  }
}

export interface FacetStore {
  provider: {
    [facet: string]: Provider[];
  }
  mirror: {
    [facet: string]: Mirror[];
  }
  genericresolver: {
    [facet: string]: GenericResolver[];
  }
  streamresolver: {
    [facet: string]: StreamResolver[];
  }
}

export interface FacetIdMap {
  provider: {
    [facetId: string]: Provider;
  }
  mirror: {
    [facetId: string]: Mirror;
  }
  genericresolver: {
    [facetId: string]: GenericResolver;
  }
  streamresolver: {
    [facetId: string]: StreamResolver;
  }
}

export const facetStore: FacetStore = {
  provider: {},
  mirror: {},
  genericresolver: {},
  streamresolver: {},
}

export const facetIdMap: FacetIdMap = {
  provider: {},
  mirror: {},
  genericresolver: {},
  streamresolver: {},
}

interface FacetMap {
  provider: Provider;
  mirror: Mirror;
  genericresolver: GenericResolver;
  streamresolver: StreamResolver;
}

export function registerFacet<K extends keyof FacetMap>(facet: K, facetId: string, facetData: FacetMap[K]): void {

}
