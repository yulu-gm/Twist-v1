import type { DomainCommand } from "./domain-command-types";
import type { SelectionModifier } from "./floor-selection";
import { getMode, type ModeRegistry } from "./mode-registry";
import type { GridCoord } from "../map/world-grid";

export type InteractionSession = {
  sessionId: string;
  modeId: string;
  startTimeMs: number;
  state: "collecting" | "previewing" | "committed";
  /** 由 {@link cancelSession} 置位；提交时应拒绝已取消的会话。 */
  cancelled: boolean;
};

let sessionSeq = 0;

function nextSessionId(): string {
  sessionSeq += 1;
  return `session-${sessionSeq}`;
}

function makeCommandId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `cmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function finalizeCommand(raw: DomainCommand | Omit<DomainCommand, "commandId" | "issuedAtMs">, commandId: string): DomainCommand {
  const issuedAtMs =
    "issuedAtMs" in raw && raw.issuedAtMs !== undefined ? raw.issuedAtMs : undefined;
  return {
    verb: raw.verb,
    targetCellKeys: raw.targetCellKeys,
    targetEntityIds: raw.targetEntityIds,
    sourceMode: raw.sourceMode,
    commandId,
    ...(issuedAtMs !== undefined ? { issuedAtMs } : {})
  };
}

/**
 * 开启交互会话；若 registry 中不存在该 modeId 则抛出。
 */
export function beginSession(registry: ModeRegistry, modeId: string, nowMs: number): InteractionSession {
  if (!getMode(registry, modeId)) {
    throw new Error(`unknown interaction mode: ${modeId}`);
  }
  return {
    sessionId: nextSessionId(),
    modeId,
    startTimeMs: nowMs,
    state: "collecting",
    cancelled: false
  };
}

/**
 * 使用当前模式的解释规则生成 {@link DomainCommand}，并将会话标为已提交。
 */
export function commitSession(
  registry: ModeRegistry,
  session: InteractionSession,
  cells: readonly GridCoord[],
  modifier: SelectionModifier,
  commandId?: string
): DomainCommand {
  if (session.cancelled) {
    throw new Error("cannot commit a cancelled interaction session");
  }
  const mode = getMode(registry, session.modeId);
  if (!mode) {
    throw new Error(`unknown interaction mode: ${session.modeId}`);
  }

  const explained = mode.explainRule({ cells, modifier });
  const id =
    commandId ??
    ("commandId" in explained && typeof explained.commandId === "string" ? explained.commandId : makeCommandId());

  const cmd = finalizeCommand(explained, id);
  session.state = "committed";
  return cmd;
}

/** 标记会话已取消（可变）；不影响 `state` 枚举，便于与「未提交」区分。 */
export function cancelSession(session: InteractionSession): void {
  session.cancelled = true;
}

/** 测试用：重置会话序号，避免用例互相泄漏。 */
export function resetInteractionSessionIdSequence(): void {
  sessionSeq = 0;
}
