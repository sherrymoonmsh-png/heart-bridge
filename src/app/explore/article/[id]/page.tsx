"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { getAuthedPhone } from "@/lib/auth-store";
import { toChineseErrorMessage } from "@/lib/error-message";
import {
  createArticleComment,
  listArticleComments,
  toggleActivityFavorite,
  toggleActivityLike,
} from "@/lib/community-service";
import { getExploreItemById } from "@/lib/explore-service";
import { ArticleCommentItem, ExploreItem } from "@/types/domain";

export default function ExploreArticleDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const articleId = params?.id ?? "";
  const phone = getAuthedPhone();

  const [article, setArticle] = useState<ExploreItem | null>(null);
  const [comments, setComments] = useState<ArticleCommentItem[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const articleRow = await getExploreItemById(articleId, phone);
      setArticle(articleRow);
      try {
        const commentRows = await listArticleComments(articleId);
        setComments(commentRows);
      } catch {
        setComments([]);
      }
    } catch (err) {
      setError(toChineseErrorMessage(err, "文章加载失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!articleId) return;
    void load();
  }, [articleId, phone]);

  const handleToggleLike = async () => {
    if (!articleId || !phone) {
      setError("请先登录后再操作");
      return;
    }
    try {
      await toggleActivityLike(articleId, phone);
      await load();
    } catch (err) {
      setError(toChineseErrorMessage(err, "点赞失败，请稍后重试。"));
    }
  };

  const handleToggleFavorite = async () => {
    if (!articleId || !phone) {
      setError("请先登录后再操作");
      return;
    }
    try {
      await toggleActivityFavorite(articleId, phone);
      await load();
    } catch (err) {
      setError(toChineseErrorMessage(err, "收藏失败，请稍后重试。"));
    }
  };

  const handleComment = async () => {
    if (!phone) {
      setError("请先登录后再评论");
      return;
    }
    if (!commentInput.trim() || !article) return;
    try {
      await createArticleComment({
        activityId: article.id,
        content: commentInput.trim(),
        authorName: "用户",
        authorPhone: phone,
      });
      setCommentInput("");
      await load();
    } catch (err) {
      setError(toChineseErrorMessage(err, "评论失败，请稍后重试。"));
    }
  };

  return (
    <main className="phone-shell px-4 pb-24 pt-5">
      <button onClick={() => router.back()} className="text-sm text-primary">
        返回
      </button>
      {loading ? <p className="mt-3 text-sm text-neutral-500">加载中...</p> : null}
      {!loading && !article ? <p className="mt-3 text-sm text-neutral-500">文章不存在或已下线。</p> : null}
      {article ? (
        <article className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-primary">{article.category}</p>
          <h1 className="mt-1 text-xl font-bold text-neutral-900">{article.title}</h1>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-neutral-700">{article.content || article.summary}</p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleToggleLike}
              className={`rounded-full px-3 py-1 text-xs ${article.likedByMe ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"}`}
            >
              {article.likedByMe ? "已点赞" : "点赞"} {article.likeCount ?? 0}
            </button>
            <button
              onClick={handleToggleFavorite}
              className={`rounded-full px-3 py-1 text-xs ${article.favoritedByMe ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-600"}`}
            >
              {article.favoritedByMe ? "已收藏" : "收藏"} {article.favoriteCount ?? 0}
            </button>
          </div>
          <div className="mt-4 rounded-xl bg-neutral-50 p-3">
            <p className="text-sm font-semibold text-neutral-800">评论</p>
            <div className="mt-2 flex gap-2">
              <input
                value={commentInput}
                onChange={(event) => setCommentInput(event.target.value)}
                placeholder="写下你的想法"
                className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:border-primary"
              />
              <button onClick={handleComment} className="rounded-lg bg-primary px-3 text-xs font-semibold text-white">
                发送
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {comments.map((item) => (
                <div key={item.id} className="rounded-lg bg-white p-2">
                  <p className="text-xs text-neutral-700">{item.authorName}</p>
                  <p className="mt-1 text-xs text-neutral-600">{item.content}</p>
                </div>
              ))}
              {comments.length === 0 ? <p className="text-xs text-neutral-400">暂无评论</p> : null}
            </div>
          </div>
        </article>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
      <BottomNav active="explore" />
    </main>
  );
}
