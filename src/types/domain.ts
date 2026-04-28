export type GroupItem = {
  id: string;
  title: string;
  desc: string;
  status?: ReviewStatus;
  rejectionReason?: string;
  creatorName?: string;
  creatorPhone?: string;
  createdAt?: string;
};

export type PostFeedItem = {
  id: string;
  title: string;
  content: string;
  authorName: string;
  authorPhone: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  likedByMe?: boolean;
  favoritedByMe?: boolean;
};

export type CommentItem = {
  id: string;
  postId: string;
  content: string;
  authorName: string;
  authorPhone: string;
  createdAt: string;
};

export type ReviewStatus = "pending" | "approved" | "rejected";

export type SubmissionItem = {
  id: string;
  type: "post" | "group" | "comment";
  title: string;
  status: ReviewStatus;
  rejectionReason: string;
  createdAt: string;
};

export type UserProfile = {
  name: string;
  streakDays: number;
  logsCount: number;
  groupsCount: number;
  harvestCount: number;
  role?: "admin" | "user";
  avatarUrl?: string;
  bio?: string;
};

export type ActivityItem = {
  id: string;
  title: string;
  content: string;
  location: string;
  startAt: string;
  likeCount: number;
  favoriteCount: number;
  likedByMe?: boolean;
  favoritedByMe?: boolean;
};

export type ExploreItem = {
  id: string;
  title: string;
  summary: string;
  content?: string;
  category: string;
  createdAt: string;
  likeCount?: number;
  favoriteCount?: number;
  likedByMe?: boolean;
  favoritedByMe?: boolean;
};

export type DiaryEntry = {
  id: string;
  userPhone: string;
  userId?: string;
  mood: string;
  content: string;
  createdAt: string;
};

export type ReviewQueueItem = {
  id: string;
  type: "post" | "group" | "comment";
  sourceId?: string;
  title: string;
  content: string;
  authorName: string;
  authorPhone: string;
  createdAt: string;
};

export type ArticleCommentItem = {
  id: string;
  activityId: string;
  content: string;
  authorName: string;
  authorPhone: string;
  createdAt: string;
};

export type ActivitySignupItem = {
  id: string;
  activityId: string;
  nickname: string;
  contact: string;
  createdAt: string;
};
