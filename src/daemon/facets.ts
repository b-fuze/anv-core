import {parse} from "url";
import {FacetTiers} from "./utils";
import {state, defaultState} from "./state";

export {FacetTiers} from "./utils";

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
  MediaSourceItem,
  ProviderItem,
  MirrorResult,
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

// DEBUG
;(<any> global).ANV.facetStore = facetStore;

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

export const facetTiers = {
  mirror: {},
  provider: {},
}

// Mirror and provider host maps

export interface FacetHostMap {
  mirror: {
    [host: string]: string;
  }

  provider: {
    [host: string]: string;
  }
}

export const facetHostMap: FacetHostMap = {
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
    const curFacetTiers = (<any>facetData).tiers;

    // FIXME: Fix these types
    (<any>facetTiers)[facet][facetId] = curFacetTiers;
    (<any>state.task.tiers)[facet][facetData.name] = curFacetTiers;
    (<any>defaultState.task.tiers)[facet][facetData.name] = curFacetTiers;

    for (const host of (<any>facetData).hosts as string[]) {
      (<any>facetHostMap)[facet][host] = facetData.name;
    }
  }
}

export function getFacet<K extends keyof FacetMap>(facet: K, facetName: string): FacetMap[K] {
  return (facetStore[facet][facetName] || [null])[0];
}

export function getFacetById<K extends keyof FacetMap>(facet: K, facetId: string): FacetMap[K] {
  return facetIdMap[facet][facetId] || null;
}

export function getFacetByHost<K extends keyof FacetMap>(facet: K, url: string): FacetMap[K] {
  const parsed = parse(url);

  if (!parsed.host) {
    return null;
  }

  const facetName: string = (<any>facetHostMap)[facet][parsed.host];

  if (!facetName) {
    return null;
  }

  return getFacet(facet, facetName);
}
