/**
 * @file notification-center.test.tsx
 * @description 通知中心组件测试 — 验证关闭隐藏、事件渲染和空状态展示
 * @part-of ui/domains/feedback — 反馈 UI 领域
 */

import { render, screen, cleanup } from '@testing-library/preact';
import { describe, expect, it, afterEach } from 'vitest';
import { NotificationCenter } from './notification-center';

afterEach(cleanup);

describe('NotificationCenter', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <NotificationCenter open={false} notifications={[]} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders grouped events when open', () => {
    render(
      <NotificationCenter
        open
        notifications={[
          { id: 'evt_1', title: 'Command Rejected', summary: 'Invalid speed', tick: 10 },
        ]}
      />,
    );

    expect(screen.getByText('Command Rejected')).toBeInTheDocument();
    expect(screen.getByText('Invalid speed')).toBeInTheDocument();
  });

  it('shows empty state when no notifications', () => {
    render(<NotificationCenter open notifications={[]} />);
    expect(screen.getByText('No events')).toBeInTheDocument();
  });
});
