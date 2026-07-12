import { EventEmitter } from "node:events";
import type { DbHandle } from "./client.js";

export type TranslationsUpdatedEvent = {
  type: "translations.updated";
  projectId: string;
  projectSlug: string;
  locale: string;
  version: number;
};

export type BusEvent = TranslationsUpdatedEvent;

export type EventBus = {
  publish(event: BusEvent): void;
  subscribe(projectId: string, cb: (event: BusEvent) => void): () => void;
};

const PG_CHANNEL = "openlocale_events";

/**
 * Event bus behind one interface:
 * - sqlite (single process): in-process EventEmitter.
 * - postgres: NOTIFY on publish; LISTEN feeds the local emitter, so events
 *   fan out to every app instance sharing the database (including this one —
 *   pg delivers NOTIFY to the publishing connection's listeners too, which is
 *   why the pg path does NOT also emit locally).
 */
export function createEventBus(handle?: DbHandle): EventBus {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);

  const pg = handle?.dialect === "pg" ? handle.rawPg : undefined;
  if (pg) {
    void pg
      .listen(PG_CHANNEL, (payload) => {
        try {
          const event = JSON.parse(payload) as BusEvent;
          emitter.emit(event.projectId, event);
        } catch {
          // malformed payload from another writer; ignore
        }
      })
      .catch((err: unknown) => {
        console.error("openlocale: pg LISTEN failed, live events are process-local", err);
      });
  }

  return {
    publish(event) {
      if (pg) {
        void pg.notify(PG_CHANNEL, JSON.stringify(event)).catch((err: unknown) => {
          console.error("openlocale: pg NOTIFY failed", err);
          emitter.emit(event.projectId, event); // degrade to process-local
        });
      } else {
        emitter.emit(event.projectId, event);
      }
    },
    subscribe(projectId, cb) {
      emitter.on(projectId, cb);
      return () => emitter.off(projectId, cb);
    }
  };
}
