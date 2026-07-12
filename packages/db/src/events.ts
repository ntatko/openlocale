import { EventEmitter } from "node:events";

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

/**
 * In-process bus — sufficient for the single-process sqlite deployment.
 * P5 layers pg LISTEN/NOTIFY on top for multi-instance Postgres, behind the
 * same interface.
 */
export function createEventBus(): EventBus {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);
  return {
    publish(event) {
      emitter.emit(event.projectId, event);
    },
    subscribe(projectId, cb) {
      emitter.on(projectId, cb);
      return () => emitter.off(projectId, cb);
    }
  };
}
