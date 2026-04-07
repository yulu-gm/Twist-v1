// ── Game Event ──
export interface GameEvent {
  type: string;
  tick: number;
  data: Record<string, unknown>;
}

export type EventHandler = (event: GameEvent) => void;

export class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private globalListeners: Set<EventHandler> = new Set();

  on(type: string, handler: EventHandler): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(handler);
  }

  off(type: string, handler: EventHandler): void {
    this.listeners.get(type)?.delete(handler);
  }

  /** Listen to all events */
  onAny(handler: EventHandler): void {
    this.globalListeners.add(handler);
  }

  offAny(handler: EventHandler): void {
    this.globalListeners.delete(handler);
  }

  dispatch(events: GameEvent[]): void {
    for (const event of events) {
      // Type-specific listeners
      const set = this.listeners.get(event.type);
      if (set) {
        for (const handler of set) {
          handler(event);
        }
      }
      // Global listeners
      for (const handler of this.globalListeners) {
        handler(event);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
    this.globalListeners.clear();
  }
}
