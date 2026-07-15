export type MTRequest = {
  sourceLocale: string;
  targetLocale: string;
  items: { key: string; text: string; context?: string }[];
};

export type MTResult = { key: string; text: string }[];

/** Machine translation provider. Add DeepL/Google/etc. by implementing this. */
export interface MTProvider {
  id: string;
  translate(request: MTRequest): Promise<MTResult>;
}

export type JudgeCandidate = {
  id: string;
  incoming: string;
  existing: string;
};

/**
 * Semantic dedupe judge (licensed AI feature): given near-miss string pairs,
 * decide which are actually the same meaning and safely mergeable.
 */
export interface SemanticJudge {
  id: string;
  judge(
    candidates: JudgeCandidate[],
    locale: string
  ): Promise<{ id: string; sameMeaning: boolean; confidence: number }[]>;
}
