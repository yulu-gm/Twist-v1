/**
 * @file build-panel.tsx
 * @description 建造面板组件 — 建筑选择面板的占位实现
 * @dependencies ui/components — Panel
 * @part-of ui/domains/build — 建造 UI 领域
 */

import { Panel } from '../../../components/panel';

/**
 * 建造面板 — 未来将展示建筑类目/搜索/建筑卡片
 *
 * 当前为占位实现，后续迭代将接入建筑定义数据库
 */
export function BuildPanel() {
  return (
    <Panel title="Build">
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
        Build palette coming soon
      </p>
    </Panel>
  );
}
