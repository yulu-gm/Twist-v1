/**
 * Serialization utilities — handle Set/Map conversion for JSON.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serialize(world: any): string {
  return JSON.stringify(world, replacer, 2);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function replacer(_key: string, value: any): any {
  if (value instanceof Set) {
    return { __type: 'Set', values: Array.from(value) };
  }
  if (value instanceof Map) {
    return { __type: 'Map', entries: Array.from(value.entries()) };
  }
  return value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deserializeValue(value: any): any {
  if (value && typeof value === 'object') {
    if (value.__type === 'Set') {
      return new Set(value.values);
    }
    if (value.__type === 'Map') {
      return new Map(value.entries.map(([k, v]: [any, any]) => [k, deserializeValue(v)]));
    }
    if (Array.isArray(value)) {
      return value.map(deserializeValue);
    }
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = deserializeValue(v);
    }
    return result;
  }
  return value;
}

export function deserialize(json: string): any {
  const raw = JSON.parse(json);
  return deserializeValue(raw);
}

export const CURRENT_SAVE_VERSION = 1;

export interface SaveMigration {
  fromVersion: number;
  toVersion: number;
  migrate(data: any): any;
}

const migrations: SaveMigration[] = [];

export function registerMigration(migration: SaveMigration): void {
  migrations.push(migration);
  migrations.sort((a, b) => a.fromVersion - b.fromVersion);
}

export function applyMigrations(data: any): any {
  while (data.version < CURRENT_SAVE_VERSION) {
    const migration = migrations.find(m => m.fromVersion === data.version);
    if (!migration) {
      throw new Error(`No migration found for save version ${data.version}`);
    }
    data = migration.migrate(data);
    data.version = migration.toVersion;
  }
  return data;
}
