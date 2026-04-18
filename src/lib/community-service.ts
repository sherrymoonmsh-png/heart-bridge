"use client";

import { toChineseErrorMessage } from "@/lib/error-message";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { ActivityItem, CommentItem, GroupItem, PostFeedItem, ReviewQueueItem, SubmissionItem } from "@/types/domain";

function ensureSupabaseReady() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error("当前服务未就绪，请稍后重试。");
  }
  return supabase;
}

export async function listPosts(userPhone: string): Promise<PostFeedItem[]> {
  const client = ensureSupabaseReady();

  const { data, error } = await client
    .from("posts")
    .select("id,title,content,author_name,author_phone,like_count,comment_count,favorite_count,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(toChineseErrorMessage(error, "动态加载失败，请稍后重试。"));
  }

  let likedIds = new Set<string>();
  let favoritedIds = new Set<string>();
  if (userPhone) {
    const [{ data: likes, error: likeError }, { data: favorites, error: favoriteError }] = await Promise.all([
      client.from("post_likes").select("post_id").eq("user_phone", userPhone),
      client.from("post_favorites").select("post_id").eq("user_phone", userPhone),
    ]);
    if (likeError || favoriteError) throw new Error("动态加载失败，请稍后重试。");
    likedIds = new Set((likes ?? []).map((item) => String(item.post_id)));
    favoritedIds = new Set((favorites ?? []).map((item) => String(item.post_id)));
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    authorName: String(row.author_name),
    authorPhone: String(row.author_phone),
    likeCount: Number(row.like_count),
    commentCount: Number(row.comment_count),
    createdAt: String(row.created_at),
    likedByMe: likedIds.has(String(row.id)),
    favoritedByMe: favoritedIds.has(String(row.id)),
  }));
}

export async function createPost(input: {
  title: string;
  content: string;
  authorName: string;
  authorPhone: string;
  isAdmin?: boolean;
}) {
  if (!input.isAdmin) {
    throw new Error("功能开发中");
  }
  const client = ensureSupabaseReady();
  const { error } = await client.from("posts").insert({
    title: input.title,
    content: input.content,
    author_name: input.authorName,
    author_phone: input.authorPhone,
    like_count: 0,
    comment_count: 0,
    favorite_count: 0,
  });
  if (error) {
    throw new Error(toChineseErrorMessage(error, "发布失败，请稍后重试。"));
  }
  return true;
}

export async function toggleLike(postId: string, userPhone: string) {
  const client = ensureSupabaseReady();
  if (!userPhone) {
    throw new Error("请先登录后再操作。");
  }

  const { data: exists, error: existsError } = await client
    .from("post_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_phone", userPhone)
    .maybeSingle();
  if (existsError) {
    throw new Error(toChineseErrorMessage(existsError, "点赞失败，请稍后重试。"));
  }

  if (exists?.id) {
    const { error: deleteError } = await client.from("post_likes").delete().eq("id", exists.id);
    if (deleteError) {
      throw new Error(toChineseErrorMessage(deleteError, "取消点赞失败，请稍后重试。"));
    }
    const { data: post, error: postError } = await client.from("posts").select("like_count").eq("id", postId).single();
    if (postError) {
      throw new Error(toChineseErrorMessage(postError, "点赞状态更新失败，请稍后重试。"));
    }
    const currentLike = Number(post?.like_count ?? 0);
    const { error: updateError } = await client
      .from("posts")
      .update({ like_count: Math.max(0, currentLike - 1) })
      .eq("id", postId);
    if (updateError) {
      throw new Error(toChineseErrorMessage(updateError, "点赞状态更新失败，请稍后重试。"));
    }
    return false;
  }

  const { error: insertError } = await client.from("post_likes").insert({ post_id: postId, user_phone: userPhone });
  if (insertError) {
    throw new Error(toChineseErrorMessage(insertError, "点赞失败，请稍后重试。"));
  }
  const { data: post, error: postError } = await client.from("posts").select("like_count").eq("id", postId).single();
  if (postError) {
    throw new Error(toChineseErrorMessage(postError, "点赞状态更新失败，请稍后重试。"));
  }
  const currentLike = Number(post?.like_count ?? 0);
  const { error: updateError } = await client.from("posts").update({ like_count: currentLike + 1 }).eq("id", postId);
  if (updateError) {
    throw new Error(toChineseErrorMessage(updateError, "点赞状态更新失败，请稍后重试。"));
  }
  return true;
}

export async function togglePostFavorite(postId: string, userPhone: string) {
  const client = ensureSupabaseReady();
  if (!userPhone) throw new Error("请先登录后再操作。");
  const { data: exists } = await client
    .from("post_favorites")
    .select("id")
    .eq("post_id", postId)
    .eq("user_phone", userPhone)
    .maybeSingle();
  if (exists?.id) {
    await client.from("post_favorites").delete().eq("id", exists.id);
    const { data: post } = await client.from("posts").select("favorite_count").eq("id", postId).single();
    const current = Number(post?.favorite_count ?? 0);
    await client.from("posts").update({ favorite_count: Math.max(0, current - 1) }).eq("id", postId);
    return false;
  }
  await client.from("post_favorites").insert({ post_id: postId, user_phone: userPhone });
  const { data: post } = await client.from("posts").select("favorite_count").eq("id", postId).single();
  const current = Number(post?.favorite_count ?? 0);
  await client.from("posts").update({ favorite_count: current + 1 }).eq("id", postId);
  return true;
}

export async function listComments(postId: string): Promise<CommentItem[]> {
  const client = ensureSupabaseReady();
  const { data, error } = await client
    .from("post_comments")
    .select("id,post_id,content,author_name,author_phone,created_at,status")
    .eq("post_id", postId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(toChineseErrorMessage(error, "评论加载失败，请稍后重试。"));
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    postId: String(row.post_id),
    content: String(row.content),
    authorName: String(row.author_name),
    authorPhone: String(row.author_phone),
    createdAt: String(row.created_at),
  }));
}

export async function createComment(input: {
  postId: string;
  content: string;
  authorName: string;
  authorPhone: string;
}) {
  const client = ensureSupabaseReady();
  const { error } = await client.from("post_comments").insert({
    post_id: input.postId,
    content: input.content,
    author_name: input.authorName,
    author_phone: input.authorPhone,
  });
  if (error) {
    throw new Error(toChineseErrorMessage(error, "评论发布失败，请稍后重试。"));
  }
  const { data: post, error: postError } = await client.from("posts").select("comment_count").eq("id", input.postId).single();
  if (postError) {
    throw new Error(toChineseErrorMessage(postError, "评论发布失败，请稍后重试。"));
  }
  const current = Number(post?.comment_count ?? 0);
  const { error: updateError } = await client.from("posts").update({ comment_count: current + 1 }).eq("id", input.postId);
  if (updateError) {
    throw new Error(toChineseErrorMessage(updateError, "评论发布失败，请稍后重试。"));
  }

  return true;
}

export async function listGroups(): Promise<GroupItem[]> {
  return [];
}

export async function createGroup(input: {
  title: string;
  desc: string;
  creatorPhone: string;
  creatorName: string;
}) {
  throw new Error("功能开发中");
}

export async function listMySubmissions(userPhone: string): Promise<SubmissionItem[]> {
  return [];
}

export async function listReviewQueue(): Promise<ReviewQueueItem[]> {
  return [];
}

export async function reviewContent(input: {
  queueId: string;
  action: "approve" | "reject";
  reason?: string;
}) {
  throw new Error("功能开发中");
}

export async function listActivities(userPhone: string): Promise<ActivityItem[]> {
  const client = ensureSupabaseReady();
  const { data, error } = await client
    .from("activities")
    .select("id,title,content,location,start_at,like_count,favorite_count,created_at")
    .not("kind", "eq", "article")
    .order("start_at", { ascending: true });
  if (error) throw new Error(toChineseErrorMessage(error, "活动加载失败，请稍后重试。"));

  let likedIds = new Set<string>();
  let favoritedIds = new Set<string>();
  if (userPhone) {
    const [{ data: likes }, { data: favorites }] = await Promise.all([
      client.from("activity_likes").select("activity_id").eq("user_phone", userPhone),
      client.from("activity_favorites").select("activity_id").eq("user_phone", userPhone),
    ]);
    likedIds = new Set((likes ?? []).map((item) => String(item.activity_id)));
    favoritedIds = new Set((favorites ?? []).map((item) => String(item.activity_id)));
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    location: String(row.location),
    startAt: String(row.start_at),
    likeCount: Number(row.like_count),
    favoriteCount: Number(row.favorite_count),
    likedByMe: likedIds.has(String(row.id)),
    favoritedByMe: favoritedIds.has(String(row.id)),
  }));
}

export async function createActivity(input: {
  title: string;
  content: string;
  location: string;
  startAt: string;
  isAdmin?: boolean;
}) {
  if (!input.isAdmin) throw new Error("功能开发中");
  const client = ensureSupabaseReady();
  const { error } = await client.from("activities").insert({
    title: input.title,
    content: input.content,
    summary: input.content,
    location: input.location,
    start_at: input.startAt,
    like_count: 0,
    favorite_count: 0,
    kind: "event",
  });
  if (error) throw new Error(toChineseErrorMessage(error, "活动发布失败，请稍后重试。"));
}

export async function toggleActivityLike(activityId: string, userPhone: string) {
  const client = ensureSupabaseReady();
  if (!userPhone) throw new Error("请先登录后再操作。");
  const { data: exists } = await client
    .from("activity_likes")
    .select("id")
    .eq("activity_id", activityId)
    .eq("user_phone", userPhone)
    .maybeSingle();
  if (exists?.id) {
    await client.from("activity_likes").delete().eq("id", exists.id);
    const { data: item } = await client.from("activities").select("like_count").eq("id", activityId).single();
    const current = Number(item?.like_count ?? 0);
    await client.from("activities").update({ like_count: Math.max(0, current - 1) }).eq("id", activityId);
    return false;
  }
  await client.from("activity_likes").insert({ activity_id: activityId, user_phone: userPhone });
  const { data: item } = await client.from("activities").select("like_count").eq("id", activityId).single();
  const current = Number(item?.like_count ?? 0);
  await client.from("activities").update({ like_count: current + 1 }).eq("id", activityId);
  return true;
}

export async function toggleActivityFavorite(activityId: string, userPhone: string) {
  const client = ensureSupabaseReady();
  if (!userPhone) throw new Error("请先登录后再操作。");
  const { data: exists } = await client
    .from("activity_favorites")
    .select("id")
    .eq("activity_id", activityId)
    .eq("user_phone", userPhone)
    .maybeSingle();
  if (exists?.id) {
    await client.from("activity_favorites").delete().eq("id", exists.id);
    const { data: item } = await client.from("activities").select("favorite_count").eq("id", activityId).single();
    const current = Number(item?.favorite_count ?? 0);
    await client.from("activities").update({ favorite_count: Math.max(0, current - 1) }).eq("id", activityId);
    return false;
  }
  await client.from("activity_favorites").insert({ activity_id: activityId, user_phone: userPhone });
  const { data: item } = await client.from("activities").select("favorite_count").eq("id", activityId).single();
  const current = Number(item?.favorite_count ?? 0);
  await client.from("activities").update({ favorite_count: current + 1 }).eq("id", activityId);
  return true;
}

export async function listMyPostFavorites(userPhone: string): Promise<PostFeedItem[]> {
  const client = ensureSupabaseReady();
  if (!userPhone) return [];
  const { data, error } = await client
    .from("post_favorites")
    .select("posts(id,title,content,author_name,author_phone,like_count,comment_count,favorite_count,created_at)")
    .eq("user_phone", userPhone);
  if (error) throw new Error("收藏加载失败，请稍后重试。");
  return (data ?? [])
    .map((row) => row.posts)
    .filter(Boolean)
    .map((row: any) => ({
      id: String(row.id),
      title: String(row.title),
      content: String(row.content),
      authorName: String(row.author_name),
      authorPhone: String(row.author_phone),
      likeCount: Number(row.like_count),
      commentCount: Number(row.comment_count),
      createdAt: String(row.created_at),
      favoritedByMe: true,
    }));
}

export async function listMyActivityFavorites(userPhone: string): Promise<ActivityItem[]> {
  const client = ensureSupabaseReady();
  if (!userPhone) return [];
  const { data, error } = await client
    .from("activity_favorites")
    .select("activities(id,title,content,location,start_at,like_count,favorite_count,created_at)")
    .eq("user_phone", userPhone);
  if (error) throw new Error("活动收藏加载失败，请稍后重试。");
  return (data ?? [])
    .map((row) => row.activities)
    .filter(Boolean)
    .map((row: any) => ({
      id: String(row.id),
      title: String(row.title),
      content: String(row.content),
      location: String(row.location),
      startAt: String(row.start_at),
      likeCount: Number(row.like_count),
      favoriteCount: Number(row.favorite_count),
      favoritedByMe: true,
    }));
}
