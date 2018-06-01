export interface RankedItem {
  tiers: string[];
}

export interface RankMap {
  [rank: string]: number;
}

export function buildRankMap(tiers: string[]): RankMap {
  const rankMap: RankMap = {};

  // for (const )

  return rankMap;
}

export function rankItems<ArbitraryRankedItem extends RankedItem>(items: ArbitraryRankedItem[], tiers: string[], tierRankMap?: RankMap): ArbitraryRankedItem[] {
  if (!tierRankMap) {
    tierRankMap = buildRankMap(tiers);
  }

  const copy = items.slice();
  copy.sort((a, b) => {
    const aRank = a.tiers.reduce((tier1, tier2) => tier1 + tierRankMap[tier2], 0);
    const bRank = b.tiers.reduce((tier1, tier2) => tier1 + tierRankMap[tier2], 0);

    return aRank - bRank;
  });

  return copy;
}
