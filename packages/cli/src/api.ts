import { authHeaders, type CliConfig } from "./config.js";

async function fail(res: Response, what: string): Promise<never> {
  let detail = "";
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    detail = body.error?.message ?? "";
  } catch {
    /* non-json error body */
  }
  throw new Error(`${what} failed: HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
}

export async function listLocales(config: CliConfig): Promise<string[]> {
  const res = await fetch(`${config.endpoint}/api/v1/projects/${config.project}/locales`, {
    headers: authHeaders(config)
  });
  if (!res.ok) await fail(res, "list locales");
  const locales = (await res.json()) as { locale: string; enabled: boolean }[];
  return locales.filter((l) => l.enabled).map((l) => l.locale);
}

export async function exportLocale(
  config: CliConfig,
  locale: string,
  format: string,
  namespace: string
): Promise<string> {
  const url = new URL(`${config.endpoint}/api/v1/projects/${config.project}/export`);
  url.searchParams.set("format", format);
  url.searchParams.set("locale", locale);
  url.searchParams.set("namespace", namespace);
  const res = await fetch(url, { headers: authHeaders(config) });
  if (!res.ok) await fail(res, `export ${locale}`);
  return res.text();
}

export type ImportJobResult = {
  id: string;
  stats: { total: number; create: number; update: number; unchanged: number };
  warnings?: string[];
  suggestions?: unknown[];
};

export async function importFile(
  config: CliConfig,
  input: { content: string; filename: string; format: string; locale: string; namespace: string }
): Promise<ImportJobResult> {
  const form = new FormData();
  form.set("file", new File([input.content], input.filename));
  form.set("format", input.format);
  form.set("locale", input.locale);
  form.set("namespace", input.namespace);
  const res = await fetch(`${config.endpoint}/api/v1/projects/${config.project}/import`, {
    method: "POST",
    headers: authHeaders(config),
    body: form
  });
  if (!res.ok) await fail(res, "import");
  return (await res.json()) as ImportJobResult;
}

export async function getJob(
  config: CliConfig,
  jobId: string
): Promise<{ suggestions?: unknown[] } & Record<string, unknown>> {
  const res = await fetch(`${config.endpoint}/api/v1/imports/${jobId}`, {
    headers: authHeaders(config)
  });
  if (!res.ok) await fail(res, "get import job");
  return (await res.json()) as { suggestions?: unknown[] };
}

export async function getSuggestions(config: CliConfig, jobId: string): Promise<unknown[]> {
  const res = await fetch(`${config.endpoint}/api/v1/imports/${jobId}/suggestions`, {
    headers: authHeaders(config)
  });
  if (!res.ok) return [];
  return (await res.json()) as unknown[];
}

export async function commitJob(
  config: CliConfig,
  jobId: string
): Promise<{ stats: Record<string, number> }> {
  const res = await fetch(`${config.endpoint}/api/v1/imports/${jobId}/commit`, {
    method: "POST",
    headers: authHeaders(config)
  });
  if (!res.ok) await fail(res, "commit import");
  return (await res.json()) as { ok: true; stats: Record<string, number> };
}
