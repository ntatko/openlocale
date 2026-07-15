import { ClaudeProvider } from "./claude.js";
import type { MTProvider, SemanticJudge } from "./types.js";

const custom = new Map<string, MTProvider>();

export function registerProvider(provider: MTProvider): void {
  custom.set(provider.id, provider);
}

/**
 * Returns the configured server-side MT provider, or null when none is
 * available (no ANTHROPIC_API_KEY and no custom registration). Selection via
 * OPENLOCALE_MT_PROVIDER (default "claude").
 */
export function getProvider(): MTProvider | null {
  const id = process.env.OPENLOCALE_MT_PROVIDER ?? "claude";
  const registered = custom.get(id);
  if (registered) return registered;
  if (id === "claude" && ClaudeProvider.available()) return new ClaudeProvider();
  return null;
}

export function getSemanticJudge(): SemanticJudge | null {
  const provider = getProvider();
  if (provider && "judge" in provider) return provider as unknown as SemanticJudge;
  return null;
}
