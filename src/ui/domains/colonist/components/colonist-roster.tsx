/**
 * @file colonist-roster.tsx
 * @description 殖民者列表组件 — 左侧面板中的殖民者名单，支持选中高亮
 * @dependencies ui/components — Panel, Badge；colonist.types — ColonistRosterRow；
 *               colonist.schemas — getJobBadgeTone
 * @part-of ui/domains/colonist — 殖民者 UI 领域
 */

import type { ColonistRosterRow } from '../colonist.types';
import { getJobBadgeTone } from '../colonist.schemas';
import { Badge } from '../../../components/badge';

/** ColonistRoster 组件属性 */
interface ColonistRosterProps {
  /** 殖民者行数据列表（已排序过滤） */
  rows: ColonistRosterRow[];
  /** 当前激活（选中）的殖民者 ID */
  activeId: string | null;
  /** 点击行时的选中回调 */
  onSelect: (id: string) => void;
}

/**
 * 殖民者列表面板 — 显示所有殖民者的名称和任务状态
 *
 * 每行包含殖民者名称和任务徽章，点击行触发选中，
 * 被选中的行会添加 is-active 样式
 */
export function ColonistRoster({ rows, activeId, onSelect }: ColonistRosterProps) {
  if (rows.length === 0) return null;

  return (
    <div class="colonist-roster ui-panel">
      <div class="ui-panel__title">殖民者</div>
      <div class="ui-panel__body">
        <ul class="colonist-roster__list">
          {rows.map(row => (
            <li key={row.id}>
              <button
                class={`colonist-roster__row ${row.id === activeId ? 'is-active' : ''}`}
                onClick={() => onSelect(row.id)}
              >
                <span class="colonist-roster__name">{row.name}</span>
                <Badge label={row.currentJobLabel} tone={getJobBadgeTone(row.currentJob)} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
