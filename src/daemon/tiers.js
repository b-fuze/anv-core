"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function buildRankMap(tiers) {
    const rankMap = {
        mirror: {},
        provider: {},
    };
    // FIXME: Unstupidify this...
    for (const [facet, data] of Object.entries(tiers)) {
        Object.entries(tiers[facet]).forEach(([name, facetTiers]) => {
            rankMap[facet][name] = {};
            facetTiers.forEach((tier, index) => {
                rankMap[facet][name][tier[0]] = Math.pow(index, 2);
            });
        });
    }
    return rankMap;
}
exports.buildRankMap = buildRankMap;
function rankItems(facet, facetName, items, tiers, tierRankMap) {
    if (!tierRankMap) {
        tierRankMap = buildRankMap(tiers);
    }
    const copy = items.slice();
    copy.sort((a, b) => {
        const aRank = a.tiers.reduce((tier1, tier2) => tier1 + tierRankMap[facet][facetName][tier2], 0);
        const bRank = b.tiers.reduce((tier1, tier2) => tier1 + tierRankMap[facet][facetName][tier2], 0);
        return aRank - bRank;
    });
    return copy;
}
exports.rankItems = rankItems;
