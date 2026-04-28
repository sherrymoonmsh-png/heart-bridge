"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { getAuthedPhone, hydrateSessionFromSupabase, isAuthed } from "@/lib/auth-store";
import { ENABLE_MENTAL_SUPPORT_SURFACES } from "@/lib/feature-flags";
import { getUserProfile } from "@/lib/user-service";
import { toChineseErrorMessage } from "@/lib/error-message";
import {
  createComment,
  createGroup,
  createPost,
  listComments,
  listPosts,
  listGroups,
  toggleLike,
  togglePostFavorite,
} from "@/lib/community-service";
import { CommentItem, GroupItem, PostFeedItem } from "@/types/domain";

export default function CommunityPage() {
  const [posts, setPosts] = useState<PostFeedItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [commentsMap, setCommentsMap] = useState<Record<string, CommentItem[]>>({});
  const [commentInputMap, setCommentInputMap] = useState<Record<string, string>>({});
  const [expandedPostId, setExpandedPostId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [error, setError] = useState("");
  const [canUseCoreActions, setCanUseCoreActions] = useState(false);
  const [displayName, setDisplayName] = useState("匿名用户");

  const phone = getAuthedPhone();
  const guestMode = !canUseCoreActions;

  const loadPosts = async () => {
    try {
      const data = await listPosts(phone);
      setPosts(data);
    } catch (err) {
      setError(toChineseErrorMessage(err, "动态加载失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const data = await listGroups();
      setGroups(data);
    } catch (err) {
      setError(toChineseErrorMessage(err, "小组加载失败，请稍后重试。"));
    }
  };

  useEffect(() => {
    const restore = async () => {
      await hydrateSessionFromSupabase();
      const authed = isAuthed();
      setCanUseCoreActions(authed);
      if (!authed || !phone) {
        setDisplayName("匿名用户");
        return;
      }
      const profile = await getUserProfile(phone);
      setDisplayName(profile?.name || `用户${phone.slice(-4)}`);
    };
    restore();
  }, [phone]);

  useEffect(() => {
    loadPosts();
    loadGroups();
  }, [phone]);

  const handleCreatePost = async () => {
    if (guestMode) {
      setError("登录后可操作");
      return;
    }
    if (!title.trim() || !content.trim()) {
      setError("请填写标题和内容。");
      return;
    }
    setPosting(true);
    setError("");
    let ok = true;
    try {
      await createPost({
        title: title.trim(),
        content: content.trim(),
        authorName: displayName,
        authorPhone: phone,
      });
    } catch (err) {
      ok = false;
      setError(toChineseErrorMessage(err, "发布失败，请稍后重试。"));
    }
    setPosting(false);
    if (!ok) {
      return;
    }
    setTitle("");
    setContent("");
    await loadPosts();
  };

  const handleToggleLike = async (postId: string) => {
    if (guestMode) {
      setError("登录后可操作");
      return;
    }
    try {
      await toggleLike(postId, phone);
    } catch (err) {
      setError(toChineseErrorMessage(err, "点赞失败，请稍后重试。"));
      return;
    }
    await loadPosts();
  };

  const handleTogglePostFavorite = async (postId: string) => {
    if (guestMode) {
      setError("登录后可操作");
      return;
    }
    try {
      await togglePostFavorite(postId, phone);
      await loadPosts();
    } catch (err) {
      setError(toChineseErrorMessage(err, "收藏失败，请稍后重试。"));
    }
  };

  const handleExpandComments = async (postId: string) => {
    const next = expandedPostId === postId ? "" : postId;
    setExpandedPostId(next);
    if (!next) return;
    try {
      const comments = await listComments(postId);
      setCommentsMap((prev) => ({ ...prev, [postId]: comments }));
    } catch (err) {
      setError(toChineseErrorMessage(err, "评论加载失败，请稍后重试。"));
    }
  };

  const handleCommentInput = (postId: string, value: string) => {
    setCommentInputMap((prev) => ({ ...prev, [postId]: value }));
  };

  const handleCreateComment = async (postId: string) => {
    if (guestMode) {
      setError("登录后可操作");
      return;
    }
    const value = (commentInputMap[postId] ?? "").trim();
    if (!value) return;
    let ok = true;
    try {
      await createComment({
        postId,
        content: value,
        authorName: displayName,
        authorPhone: phone,
      });
    } catch (err) {
      ok = false;
      setError(toChineseErrorMessage(err, "评论发布失败，请稍后重试。"));
    }
    if (!ok) return;
    setCommentInputMap((prev) => ({ ...prev, [postId]: "" }));
    try {
      const comments = await listComments(postId);
      setCommentsMap((prev) => ({ ...prev, [postId]: comments }));
      await loadPosts();
    } catch (err) {
      setError(toChineseErrorMessage(err, "评论刷新失败，请稍后重试。"));
    }
  };

  const handleCreateGroup = async () => {
    if (guestMode) {
      setError("登录后可操作");
      return;
    }
    if (!groupTitle.trim() || !groupDesc.trim()) {
      setError("请填写小组标题和介绍。");
      return;
    }
    setCreatingGroup(true);
    setError("");
    try {
      await createGroup({
        title: groupTitle.trim(),
        desc: groupDesc.trim(),
        creatorPhone: phone,
        creatorName: displayName,
      });
      setGroupTitle("");
      setGroupDesc("");
      setError("小组已提交管理端审核，通过后会展示在公开小组");
      await loadGroups();
    } catch (err) {
      setError(toChineseErrorMessage(err, "小组创建失败，请稍后重试。"));
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <main className="phone-shell px-4 pb-24 pt-5">
      <header className="mb-4">
        <h1 className="text-3xl font-bold text-neutral-900">相互扶持，静候花开</h1>
        <p className="mt-1 text-sm text-neutral-500">
          在这里，每一个声音都能被倾听，每一份情绪都有人接住。
        </p>
        {guestMode ? (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
            游客您好，您可以浏览内容，登录后可参与互动~
          </p>
        ) : null}
      </header>

      {!guestMode ? (
        <>
          <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-neutral-400">发布帖子</p>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="写一个标题..."
              className="mt-2 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-primary"
            />
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="记录你此刻的情绪、想法或故事..."
              className="mt-2 h-24 w-full resize-none rounded-xl border border-neutral-200 p-3 text-sm outline-none focus:border-primary"
            />
            <button
              disabled={posting}
              onClick={handleCreatePost}
              className="mt-3 h-10 w-full rounded-full bg-primary text-sm font-semibold text-white disabled:opacity-60"
            >
              {posting ? "发布中..." : "发布帖子"}
            </button>
          </section>

          <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-neutral-400">创建小组</p>
            <input
              value={groupTitle}
              onChange={(event) => setGroupTitle(event.target.value)}
              placeholder="小组标题"
              className="mt-2 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-primary"
            />
            <textarea
              value={groupDesc}
              onChange={(event) => setGroupDesc(event.target.value)}
              placeholder="小组介绍"
              className="mt-2 h-20 w-full resize-none rounded-xl border border-neutral-200 p-3 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={handleCreateGroup}
              disabled={creatingGroup}
              className="mt-3 h-10 w-full rounded-full bg-primary text-sm font-semibold text-white disabled:opacity-60"
            >
              {creatingGroup ? "提交中..." : "提交小组"}
            </button>
          </section>
        </>
      ) : null}

      <section className="mt-6 space-y-3">
        <p className="text-xs text-neutral-400">帖子动态</p>
        {loading ? (
          <article className="rounded-2xl bg-white p-4 text-sm text-neutral-500 shadow-sm">加载中...</article>
        ) : null}
        {!loading && posts.length === 0 ? (
          <article className="rounded-2xl bg-white p-4 text-sm text-neutral-500 shadow-sm">
            暂无帖子，来发布第一条吧。
          </article>
        ) : null}
        {!loading &&
          posts.map((post) => (
            <article key={post.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{post.authorName}</p>
                <p className="text-xs text-neutral-400">
                  {new Date(post.createdAt).toLocaleDateString("zh-CN")}
                </p>
              </div>
              <h3 className="mt-2 font-semibold text-neutral-900">{post.title}</h3>
              <p className="mt-1 text-sm text-neutral-600">{post.content}</p>
              {!guestMode ? (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleToggleLike(post.id)}
                    className={`rounded-full px-3 py-1 text-xs ${
                      post.likedByMe ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {post.likedByMe ? "已点赞" : "点赞"} {post.likeCount}
                  </button>
                  <button
                    onClick={() => handleTogglePostFavorite(post.id)}
                    className={`rounded-full px-3 py-1 text-xs ${
                      post.favoritedByMe ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {post.favoritedByMe ? "已收藏" : "收藏"}
                  </button>
                  <button
                    onClick={() => handleExpandComments(post.id)}
                    className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600"
                  >
                    评论 {post.commentCount}
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-neutral-400">点赞 {post.likeCount} · 评论 {post.commentCount}</p>
              )}

              {expandedPostId === post.id ? (
                <div className="mt-3 rounded-xl bg-neutral-50 p-3">
                  {!guestMode ? (
                    <div className="mb-2 flex gap-2">
                      <input
                        value={commentInputMap[post.id] ?? ""}
                        onChange={(event) => handleCommentInput(post.id, event.target.value)}
                        placeholder="写下你的回应..."
                        className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:border-primary"
                      />
                      <button
                        onClick={() => handleCreateComment(post.id)}
                        className="rounded-lg bg-primary px-3 text-xs font-semibold text-white"
                      >
                        发送
                      </button>
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    {(commentsMap[post.id] ?? []).map((comment) => (
                      <div key={comment.id} className="rounded-lg bg-white p-2">
                        <p className="text-xs font-medium text-neutral-700">{comment.authorName}</p>
                        <p className="mt-1 text-xs text-neutral-600">{comment.content}</p>
                      </div>
                    ))}
                    {(commentsMap[post.id] ?? []).length === 0 ? (
                      <p className="text-xs text-neutral-400">暂无评论，来做第一个回应吧。</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
      </section>
      <section className="mt-6 space-y-3">
        <p className="text-xs text-neutral-400">公开小组</p>
        {groups.length === 0 ? (
          <article className="rounded-2xl bg-white p-4 text-sm text-neutral-500 shadow-sm">暂无小组。</article>
        ) : null}
        {groups.map((item) => (
          <article key={item.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-neutral-900">{item.title}</h3>
            <p className="mt-1 text-sm text-neutral-600">{item.desc}</p>
          </article>
        ))}
      </section>

      {ENABLE_MENTAL_SUPPORT_SURFACES ? (
        <section className="mt-6 rounded-2xl bg-white p-4 text-sm text-neutral-500 shadow-sm">
          心理求助入口（暂时隐藏，可通过开关恢复）
        </section>
      ) : null}

      <BottomNav active="home" />
    </main>
  );
}
