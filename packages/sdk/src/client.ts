export type Bundle = Record<string, string>;

export type ClientOptions = {
  /** Base URL of your openlocale server, e.g. https://locale.example.com */
  endpoint: string;
  /** Project slug */
  project: string;
  /** Read token — required for private projects */
  apiKey?: string;
  /** Namespace (default "default") */
  namespace?: string;
  /** Subscribe to live updates over SSE (default true in browsers) */
  live?: boolean;
  /** Poll interval in ms used when SSE is unavailable/broken (default 60s) */
  pollInterval?: number;
  /** Persist bundles+etags to localStorage for instant startup (browser only) */
  persist?: boolean;
  /** fetch implementation override (tests, older runtimes) */
  fetch?: typeof fetch;
};

export type UpdateEvent = { locale: string; version: number };
export type ClientEvent = "update" | "error";

type Listener = (payload: UpdateEvent | Error) => void;

const STORAGE_PREFIX = "openlocale:";

export type OpenLocaleClient = {
  /** Fetch (or revalidate) a locale bundle and make it the current locale. */
  load(locale: string): Promise<Bundle>;
  /** Translate a key from the current locale (or an explicit one). */
  t(key: string, locale?: string): string;
  /** The raw bundle for a loaded locale. */
  getBundle(locale: string): Bundle | undefined;
  /** Currently active locale (last successful load()). */
  locale(): string | null;
  on(event: ClientEvent, cb: Listener): () => void;
  /** Stop SSE/polling and release resources. */
  close(): void;
};

export function createClient(options: ClientOptions): OpenLocaleClient {
  const ns = options.namespace ?? "default";
  const doFetch = options.fetch ?? fetch;
  const base = options.endpoint.replace(/\/$/, "");
  const live = options.live ?? true;
  const pollInterval = options.pollInterval ?? 60_000;
  const persist =
    (options.persist ?? true) && typeof localStorage !== "undefined";

  const bundles = new Map<string, Bundle>();
  const etags = new Map<string, string>();
  const versions = new Map<string, number>();
  const listeners = new Map<ClientEvent, Set<Listener>>();
  let currentLocale: string | null = null;
  let es: EventSource | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const storageKey = (locale: string) =>
    `${STORAGE_PREFIX}${options.project}:${ns}:${locale}`;

  function emit(event: ClientEvent, payload: UpdateEvent | Error) {
    for (const cb of listeners.get(event) ?? []) cb(payload);
  }

  function bundleUrl(locale: string) {
    const url = new URL(`${base}/api/v1/cdn/${options.project}/${locale}.json`);
    url.searchParams.set("ns", ns);
    if (options.apiKey) url.searchParams.set("token", options.apiKey);
    return url.toString();
  }

  function restore(locale: string): void {
    if (!persist || bundles.has(locale)) return;
    try {
      const raw = localStorage.getItem(storageKey(locale));
      if (!raw) return;
      const { bundle, etag } = JSON.parse(raw) as { bundle: Bundle; etag: string };
      bundles.set(locale, bundle);
      etags.set(locale, etag);
    } catch {
      /* corrupted cache is not fatal */
    }
  }

  async function load(locale: string): Promise<Bundle> {
    restore(locale);
    const headers: Record<string, string> = {};
    const etag = etags.get(locale);
    if (etag && bundles.has(locale)) headers["if-none-match"] = etag;

    const res = await doFetch(bundleUrl(locale), { headers });
    if (res.status === 304) {
      currentLocale = locale;
      return bundles.get(locale)!;
    }
    if (!res.ok) {
      throw new Error(`openlocale: failed to load ${locale}: HTTP ${res.status}`);
    }
    const bundle = (await res.json()) as Bundle;
    bundles.set(locale, bundle);
    const newEtag = res.headers.get("etag");
    if (newEtag) {
      etags.set(locale, newEtag);
      if (persist) {
        try {
          localStorage.setItem(storageKey(locale), JSON.stringify({ bundle, etag: newEtag }));
        } catch {
          /* quota exceeded etc. */
        }
      }
    }
    currentLocale = locale;
    if (live && !es && !pollTimer) startLive();
    return bundle;
  }

  async function onRemoteUpdate(locale: string, version: number) {
    const known = versions.get(locale) ?? -1;
    if (version <= known) return;
    versions.set(locale, version);
    if (bundles.has(locale)) {
      try {
        etags.delete(locale); // force refetch, the etag is stale by definition
        const before = currentLocale;
        await load(locale);
        currentLocale = before ?? locale;
      } catch (err) {
        emit("error", err as Error);
        return;
      }
    }
    emit("update", { locale, version });
  }

  function startLive() {
    if (typeof EventSource !== "undefined") {
      const url = new URL(`${base}/api/v1/cdn/${options.project}/events`);
      if (options.apiKey) url.searchParams.set("token", options.apiKey);
      es = new EventSource(url.toString());
      es.addEventListener("translations.updated", (e) => {
        try {
          const { locale, version } = JSON.parse((e as MessageEvent).data as string) as UpdateEvent;
          void onRemoteUpdate(locale, version);
        } catch {
          /* ignore malformed frames */
        }
      });
      es.onerror = () => {
        // EventSource retries automatically; if it hard-fails (proxy strips
        // SSE) fall back to manifest polling.
        if (es && es.readyState === EventSource.CLOSED) {
          es = null;
          startPolling();
        }
      };
      return;
    }
    startPolling();
  }

  function startPolling() {
    if (pollTimer || closed) return;
    pollTimer = setInterval(async () => {
      try {
        const url = new URL(`${base}/api/v1/cdn/${options.project}/manifest`);
        if (options.apiKey) url.searchParams.set("token", options.apiKey);
        const res = await doFetch(url.toString());
        if (!res.ok) return;
        const manifest = (await res.json()) as { locales: UpdateEvent[] };
        for (const { locale, version } of manifest.locales) {
          if (bundles.has(locale)) void onRemoteUpdate(locale, version);
        }
      } catch (err) {
        emit("error", err as Error);
      }
    }, pollInterval);
  }

  return {
    load,
    t(key, locale) {
      const l = locale ?? currentLocale;
      if (!l) return key;
      return bundles.get(l)?.[key] ?? key;
    },
    getBundle: (locale) => bundles.get(locale),
    locale: () => currentLocale,
    on(event, cb) {
      const set = listeners.get(event) ?? new Set();
      set.add(cb);
      listeners.set(event, set);
      return () => set.delete(cb);
    },
    close() {
      closed = true;
      es?.close();
      es = null;
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}
