import {
  ProviderFacet as Provider,
  MirrorFacet as Mirror,
  GenericResolverFacet as GenericResolver,
  StreamResolverFacet as StreamResolver,
} from "anv";

export {
  ProviderFacet as Provider,
  MirrorFacet as Mirror,
  GenericResolverFacet as GenericResolver,
  StreamResolverFacet as StreamResolver,
} from "anv";

export enum Facet {
  Provider = "provider",
  Mirror = "mirror",
  GenericResolver = "genericresolver",
  StreamResolver = "streamresolver",
}

export interface FacetStore {
  provider: {
    [facetId: string]: Provider[];
  }
  mirror: {
    [facetId: string]: Mirror[];
  }
  genericresolver: {
    [facetId: string]: GenericResolver[];
  }
  streamresolver: {
    [facetId: string]: StreamResolver[];
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

// Facet state

export interface FacetStateIdMap {
  [facet: string]: {
    [facetId: string]: FacetState;
  }
}

export interface FacetState {
  lastUse: number;
  activeUserCount: number;
}

export const facetStateIdMap: FacetStateIdMap = {
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

// Facet tiers
export interface FacetTiers {
  mirror: {
    [facetId: string]: string[];
  }

  provider: {
    [facetId: string]: string[];
  }
}

export const facetTiers = {
  mirror: {},
  provider: {},
}

export function registerFacet<K extends keyof FacetMap>(facet: K, facetId: string, facetData: FacetMap[K]): void {
  if (!facetStore[facet][facetData.name]) {
    facetStore[facet][facetData.name] = [];
  }

  // FIXME: Check why I had to cast this to any[]
  (<any[]>facetStore[facet][facetData.name]).push(facetData);
  (<any[]>facetStore[facet][facetData.name]).sort((a, b) => b.weight - a.weight);

  facetIdMap[facet][facetId] = facetData;
  facetStateIdMap[facet][facetId] = {
    lastUse: 0,
    activeUserCount: 0,
  };

  // Load tiers
  if (facet === "mirror" || facet === "provider") {
    (<any>facetTiers)[facet][facetId] = Object.keys((<any>facetData).tiers);
  }
}

export function getFacet<K extends keyof FacetMap>(facet: K, facetName: string): FacetMap[K] {
  return (facetStore[facet][facetName] || [null])[0];
}

export function getFacetById<K extends keyof FacetMap>(facet: K, facetId: string): FacetMap[K] {
  return facetIdMap[facet][facetId] || null;
}
