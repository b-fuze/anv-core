import {MediaSourceItem, MediaSourceSubItem} from "anv";
import {FacetTiers} from "./facets";

export interface RankMap {
  mirror: {
    [facetName: string]: {
      [rank: string]: number;
    }
  }
  provider: {
    [facetName: string]: {
      [rank: string]: number;
    }
  }
}

export function buildRankMap(tiers: FacetTiers): RankMap {
  const rankMap: RankMap = {
    mirror: {},
    provider: {},
  };

  // FIXME: Unstupidify this...
  for (const [facet, data] of (<any>Object).entries(tiers) as [keyof FacetTiers, FacetTiers["mirror"]][]) {
    ((<any>Object).entries(tiers[facet]) as [string, string[]][]).forEach(([name, facetTiers]) => {
      rankMap[facet][name] = {};

      facetTiers.forEach((tier, index) => {
        rankMap[facet][name][tier[0]] = Math.pow(index, 2);
      });
    });
  }

  return rankMap;
}

export function rankItems(facet: keyof FacetTiers, facetName: string, items: (MediaSourceItem | MediaSourceSubItem)[], tiers: FacetTiers, tierRankMap?: RankMap): (MediaSourceItem | MediaSourceSubItem)[] {
  if (!tierRankMap) {
    tierRankMap = buildRankMap(tiers);
  }

  const copy = items.slice();
  copy.sort((a, b) => {
    const aRank = (a.tiers || []).reduce((tier1, tier2) => tier1 + tierRankMap[facet][facetName][tier2], 0);
    const bRank = (b.tiers || []).reduce((tier1, tier2) => tier1 + tierRankMap[facet][facetName][tier2], 0);

    return aRank - bRank;
  });

  return copy;
}
