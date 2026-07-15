import Anthropic from "@anthropic-ai/sdk";
import type { JudgeCandidate, MTProvider, MTRequest, MTResult, SemanticJudge } from "./types.js";

const BATCH_SIZE = 50;

const TRANSLATION_SCHEMA = {
  type: "object",
  properties: {
    translations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          text: { type: "string" }
        },
        required: ["key", "text"],
        additionalProperties: false
      }
    }
  },
  required: ["translations"],
  additionalProperties: false
} as const;

const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          sameMeaning: { type: "boolean" },
          confidence: { type: "integer" }
        },
        required: ["id", "sameMeaning", "confidence"],
        additionalProperties: false
      }
    }
  },
  required: ["results"],
  additionalProperties: false
} as const;

function textOf(response: Anthropic.Message): string {
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error(`claude returned no text (stop_reason: ${response.stop_reason})`);
  }
  return block.text;
}

/**
 * Server-side machine translation via the Claude API. Used when the admin's
 * browser can't run Chrome's built-in translator (or by explicit choice).
 */
export class ClaudeProvider implements MTProvider, SemanticJudge {
  id = "claude";
  private client: Anthropic;
  private model: string;

  constructor(opts?: { apiKey?: string; model?: string }) {
    this.client = new Anthropic({
      ...(opts?.apiKey ? { apiKey: opts.apiKey } : {})
    });
    this.model = opts?.model ?? process.env.OPENLOCALE_AI_MODEL ?? "claude-opus-4-8";
  }

  static available(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async translate(request: MTRequest): Promise<MTResult> {
    const out: MTResult = [];
    for (let i = 0; i < request.items.length; i += BATCH_SIZE) {
      const batch = request.items.slice(i, i + BATCH_SIZE);
      const listing = batch
        .map(
          (item) =>
            `key: ${item.key}\ntext: ${item.text}${item.context ? `\ncontext: ${item.context}` : ""}`
        )
        .join("\n---\n");

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 16000,
        system:
          "You are a professional software localizer. Translate UI strings faithfully, " +
          "preserving placeholders ({{name}}, {name}, %s, %1$s, {0}), ICU plural syntax, " +
          "HTML tags, and leading/trailing whitespace exactly. Use each string's context " +
          "note (if given) to pick appropriate register and terminology. Return every key.",
        output_config: {
          format: { type: "json_schema", schema: TRANSLATION_SCHEMA }
        },
        messages: [
          {
            role: "user",
            content:
              `Translate the following UI strings from ${request.sourceLocale} to ${request.targetLocale}.\n\n` +
              listing
          }
        ]
      });

      const parsed = JSON.parse(textOf(response)) as { translations: MTResult };
      out.push(...parsed.translations);
    }
    return out;
  }

  async judge(candidates: JudgeCandidate[], locale: string) {
    if (candidates.length === 0) return [];
    const listing = candidates
      .map((c) => `id: ${c.id}\nA: ${c.incoming}\nB: ${c.existing}`)
      .join("\n---\n");

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 8000,
      system:
        "You review UI string pairs for a translation management system. For each pair, " +
        "decide whether A and B mean the same thing in context and could safely share one " +
        "translation (sameMeaning), with confidence 0-100. Differences in placeholders, " +
        "negation, or referenced entities mean NOT the same.",
      output_config: { format: { type: "json_schema", schema: JUDGE_SCHEMA } },
      messages: [
        {
          role: "user",
          content: `Language: ${locale}. Judge these pairs:\n\n${listing}`
        }
      ]
    });

    const parsed = JSON.parse(textOf(response)) as {
      results: { id: string; sameMeaning: boolean; confidence: number }[];
    };
    return parsed.results;
  }
}
