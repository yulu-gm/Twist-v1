/**
 * 人物详情 mock 数据（与模拟层 `PawnState.id` 对齐：pawn-0 …）。
 * 未来替换为真实档案时，只需换掉此文件的实现，接口保持不变。
 */

export type PawnProfile = Readonly<{
  epithet: string;
  bio: string;
  notes: string;
  /** 与玩法无关的虚构标签，仅作展示。 */
  mockTags: readonly string[];
}>;

export const MOCK_PAWN_PROFILES: Readonly<Record<string, PawnProfile>> = {
  "pawn-0": {
    epithet: "冲动的美食家",
    bio: "闻到灶台味就走不动路，但总忘记带碗。",
    notes: "mock：今日心愿是吃到不糊的炖菜。",
    mockTags: ["社交型", "夜猫子"]
  },
  "pawn-1": {
    epithet: "守序补眠委员",
    bio: "认为午睡是生产力，谁吵和谁急。",
    notes: "mock：枕头编号已贴便签。",
    mockTags: ["规划型", "早起困难"]
  },
  "pawn-2": {
    epithet: "田野散心达人",
    bio: "心情不好就去圈外溜达，回来时裤脚永远有泥。",
    notes: "mock：正在收集「奇怪的石头」。",
    mockTags: ["外向", "收集癖"]
  },
  "pawn-3": {
    epithet: "沉默账本 keeper",
    bio: "话少，但记得每户借了几根火柴。",
    notes: "mock：秘密写日记，用的密码是村长生日。",
    mockTags: ["谨慎", "记性好"]
  },
  "pawn-4": {
    epithet: "即兴演奏志愿者",
    bio: "会用锅盖敲节奏，自称「打击乐自由魂」。",
    notes: "mock：下一首歌献给未完成的篱笆。",
    mockTags: ["创意", "音量大"]
  }
} as const;

export function pawnProfileForId(pawnId: string): PawnProfile | undefined {
  return MOCK_PAWN_PROFILES[pawnId];
}
