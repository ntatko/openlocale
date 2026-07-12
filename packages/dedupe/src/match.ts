import { hashValue, normalize, normalizedHash } from "./normalize.js";

export type Candidate = {
  keyId: string;
  keyName: string;
  value: string;
  valueHash: string;
  normalizedHash: string;
};

export type MatchType = "exact" | "normalized" | "fuzzy";

export type Match = {
  keyId: string;
  keyName: string;
  matchedValue: string;
  matchType: MatchType;
  /** 0-100 */
  score: number;
};

export type DedupeOptions = {
  /** trigram Jaccard threshold for fuzzy matches (default 0.85) */
  fuzzyThreshold?: number;
  /** skip fuzzy matching above this corpus size (default 20000) */
  fuzzyMaxCorpus?: number;
};

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const grams = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const gram of small) if (large.has(gram)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

export type DedupeIndex = {
  byValueHash: Map<string, Candidate[]>;
  byNormalizedHash: Map<string, Candidate[]>;
  fuzzy: { candidate: Candidate; normalized: string; grams: Set<string> }[] | null;
};

/**
 * Build a reusable index over existing translations. Fuzzy structures are
 * precomputed unless the corpus exceeds fuzzyMaxCorpus (exact + normalized
 * still work at any size).
 */
export function buildIndex(candidates: Candidate[], opts?: DedupeOptions): DedupeIndex {
  const byValueHash = new Map<string, Candidate[]>();
  const byNormalizedHash = new Map<string, Candidate[]>();
  for (const c of candidates) {
    (byValueHash.get(c.valueHash) ?? byValueHash.set(c.valueHash, []).get(c.valueHash)!).push(c);
    (
      byNormalizedHash.get(c.normalizedHash) ??
      byNormalizedHash.set(c.normalizedHash, []).get(c.normalizedHash)!
    ).push(c);
  }
  const maxCorpus = opts?.fuzzyMaxCorpus ?? 20_000;
  const fuzzy =
    candidates.length <= maxCorpus
      ? candidates.map((candidate) => {
          const normalized = normalize(candidate.value);
          return { candidate, normalized, grams: trigrams(normalized) };
        })
      : null;
  return { byValueHash, byNormalizedHash, fuzzy };
}

/** Find the best duplicate match for an incoming value, or null. */
export function findMatch(
  value: string,
  index: DedupeIndex,
  opts?: DedupeOptions
): Match | null {
  const exact = index.byValueHash.get(hashValue(value));
  if (exact && exact.length > 0) {
    const c = exact[0]!;
    return {
      keyId: c.keyId,
      keyName: c.keyName,
      matchedValue: c.value,
      matchType: "exact",
      score: 100
    };
  }

  const norm = index.byNormalizedHash.get(normalizedHash(value));
  if (norm && norm.length > 0) {
    const c = norm[0]!;
    return {
      keyId: c.keyId,
      keyName: c.keyName,
      matchedValue: c.value,
      matchType: "normalized",
      score: 95
    };
  }

  if (!index.fuzzy) return null;
  const threshold = opts?.fuzzyThreshold ?? 0.85;
  const normalized = normalize(value);
  const grams = trigrams(normalized);
  const len = normalized.length;

  let best: { candidate: Candidate; score: number } | null = null;
  for (const entry of index.fuzzy) {
    // length band pruning: strings differing by >20% length can't clear 0.85
    const otherLen = entry.normalized.length;
    if (otherLen < len * 0.8 || otherLen > len * 1.25) continue;
    const score = jaccard(grams, entry.grams);
    if (score >= threshold && (!best || score > best.score)) {
      best = { candidate: entry.candidate, score };
    }
  }
  if (!best) return null;
  return {
    keyId: best.candidate.keyId,
    keyName: best.candidate.keyName,
    matchedValue: best.candidate.value,
    matchType: "fuzzy",
    score: Math.round(best.score * 100)
  };
}
