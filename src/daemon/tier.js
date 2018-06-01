"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function buildRankMap(tiers) {
    const rankMap = {};
    // for (const )
    return rankMap;
}
exports.buildRankMap = buildRankMap;
function rankItems(items, tiers, tierRankMap) {
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
exports.rankItems = rankItems;
