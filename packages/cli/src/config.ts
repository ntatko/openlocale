import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type CliConfig = {
  endpoint: string;
  project: string;
  token?: string;
};

export const CONFIG_FILE = "openlocale.config.json";

export async function loadConfig(overrides: Partial<CliConfig> = {}): Promise<CliConfig> {
  let fromFile: Partial<CliConfig> = {};
  try {
    fromFile = JSON.parse(await readFile(resolve(CONFIG_FILE), "utf8")) as Partial<CliConfig>;
  } catch {
    /* no config file is fine if flags/env cover it */
  }
  const merged: Partial<CliConfig> = {
    ...fromFile,
    ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined))
  };
  merged.token ??= process.env.OPENLOCALE_TOKEN;
  merged.endpoint ??= process.env.OPENLOCALE_ENDPOINT;

  if (!merged.endpoint) throw new Error("missing endpoint (flag --endpoint, config, or OPENLOCALE_ENDPOINT)");
  if (!merged.project) throw new Error("missing project (flag --project or config)");
  return merged as CliConfig;
}

export function authHeaders(config: CliConfig): Record<string, string> {
  return config.token ? { authorization: `Bearer ${config.token}` } : {};
}
