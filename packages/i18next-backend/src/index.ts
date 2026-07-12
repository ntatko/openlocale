import type { BackendModule, ReadCallback, Services, InitOptions } from "i18next";
import { createClient, type ClientOptions, type OpenLocaleClient, type UpdateEvent } from "@openlocale/sdk";

export type OpenLocaleBackendOptions = Omit<ClientOptions, "namespace"> & {
  /** called whenever a live update lands (after resources are reloaded) */
  onUpdate?: (event: UpdateEvent) => void;
};

/**
 * i18next backend for openlocale.
 *
 *   i18next.use(OpenLocaleBackend).init({
 *     backend: { endpoint: "https://locale.example.com", project: "demo" }
 *   });
 *
 * Live updates: when the server pushes translations.updated, the backend
 * reloads the affected language so react-i18next/vue-i18next re-render.
 */
export class OpenLocaleBackend implements BackendModule<OpenLocaleBackendOptions> {
  static type = "backend" as const;
  type = "backend" as const;

  private services!: Services;
  private options!: OpenLocaleBackendOptions;
  private clients = new Map<string, OpenLocaleClient>();

  init(
    services: Services,
    backendOptions: OpenLocaleBackendOptions,
    _i18nextOptions: InitOptions
  ): void {
    this.services = services;
    this.options = backendOptions;
  }

  private clientFor(namespace: string): OpenLocaleClient {
    let client = this.clients.get(namespace);
    if (!client) {
      const { onUpdate, ...clientOptions } = this.options;
      client = createClient({ ...clientOptions, namespace });
      client.on("update", (payload) => {
        const event = payload as UpdateEvent;
        this.reload(event.locale, namespace);
        onUpdate?.(event);
      });
      this.clients.set(namespace, client);
    }
    return client;
  }

  read(language: string, namespace: string, callback: ReadCallback): void {
    this.clientFor(namespace)
      .load(language)
      .then((bundle) => callback(null, bundle))
      .catch((err: Error) => callback(err, false));
  }

  /** Reload a language/namespace through the backendConnector so bound UIs re-render. */
  private reload(language: string, namespace: string): void {
    const connector = (
      this.services as unknown as {
        backendConnector?: {
          load: (langs: string[], ns: string[], cb: () => void) => void;
          backend?: unknown;
        };
      }
    ).backendConnector;
    connector?.load([language], [namespace], () => {
      // i18next emits "loaded" after connector.load resolves; framework
      // bindings (react-i18next etc.) listen for it by default.
    });
  }

  close(): void {
    for (const client of this.clients.values()) client.close();
    this.clients.clear();
  }
}

export default OpenLocaleBackend;
