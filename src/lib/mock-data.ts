import { GroupItem, PostFeedItem, UserProfile } from "@/types/domain";

export const mockGroups: GroupItem[] = [
  { id: "g1", title: "职场压力减压站", desc: "分享职场情绪与压力，互助成长。" },
  { id: "g2", title: "失恋互助夜谈会", desc: "表达情绪与困扰，重建内心安全感。" },
  { id: "g3", title: "自我关怀养成营", desc: "每日一个练习，慢慢修复自己。" },
];

export const mockPosts: PostFeedItem[] = [
  {
    id: "p1",
    title: "当你感到“被困住”时，你最初想逃去哪一步？",
    content: "这不是标准答案征集，而是你此刻最真实的方向。欢迎用一句话写下。",
    authorName: "心桥运营",
    authorPhone: "10000000000",
    likeCount: 12,
    commentCount: 3,
    createdAt: new Date().toISOString(),
    likedByMe: false,
  },
];

export const mockProfile: UserProfile = {
  name: "晓云",
  streakDays: 128,
  logsCount: 42,
  groupsCount: 12,
  harvestCount: 85,
};
