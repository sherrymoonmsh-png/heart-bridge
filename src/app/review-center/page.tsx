"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { getAuthedPhone, hydrateSessionFromSupabase, isAuthed } from "@/lib/auth-store";
import { listActivities, listActivitySignups, listReviewQueue, reviewContent } from "@/lib/community-service";
import { toChineseErrorMessage } from "@/lib/error-message";
import { getUserProfile } from "@/lib/user-service";
import { ActivityItem, ActivitySignupItem, ReviewQueueItem } from "@/types/domain";

export default function ReviewCenterPage() {
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [actingId, setActingId] = useState("");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activitySignupsMap, setActivitySignupsMap] = useState<Record<string, ActivitySignupItem[]>>({});
  const [expandedActivityId, setExpandedActivityId] = useState("");

  const loadQueue = useCallback(async () => {
    try {
      const data = await listReviewQueue();
      setQueue(data);
    } catch (err) {
      setError(toChineseErrorMessage(err, "审核列表加载失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActivities = useCallback(async () => {
    try {
      const rows = await listActivities("");
      setActivities(rows);
    } catch (err) {
      setError(toChineseErrorMessage(err, "活动数据加载失败，请稍后重试。"));
    }
  }, []);

  useEffect(() => {
    const restore = async () => {
      await hydrateSessionFromSupabase();
      if (!isAuthed()) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const profile = await getUserProfile(getAuthedPhone());
      const admin = profile?.role === "admin";
      setIsAdmin(admin);
      if (admin) {
        await Promise.all([loadQueue(), loadActivities()]);
      }
      else setLoading(false);
    };
    restore();
  }, [loadActivities, loadQueue]);

  const handleAction = async (queueId: string, action: "approve" | "reject") => {
    setActingId(queueId);
    setError("");
    try {
      await reviewContent({ queueId, action });
      await loadQueue();
    } catch (err) {
      setError(toChineseErrorMessage(err, "审核操作失败，请稍后重试。"));
    } finally {
      setActingId("");
    }
  };

  const handleExpandActivitySignups = async (activityId: string) => {
    const next = expandedActivityId === activityId ? "" : activityId;
    setExpandedActivityId(next);
    if (!next) return;
    if (activitySignupsMap[activityId]) return;
    try {
      const rows = await listActivitySignups(activityId);
      setActivitySignupsMap((prev) => ({ ...prev, [activityId]: rows }));
    } catch (err) {
      setError(toChineseErrorMessage(err, "报名数据加载失败，请稍后重试。"));
    }
  };

  if (!isAdmin && !loading) {
    return (
      <main className="phone-shell px-4 pb-24 pt-5">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h1 className="text-xl font-bold text-neutral-900">无审核权限</h1>
          <p className="mt-2 text-sm text-neutral-500">仅管理员可访问审核中心。</p>
          <Link href="/community" className="mt-3 inline-flex text-sm font-semibold text-primary underline">
            返回社区
          </Link>
        </section>
        <BottomNav active="mine" />
      </main>
    );
  }

  return (
    <main className="phone-shell px-4 pb-24 pt-5">
      <header className="mb-4">
        <h1 className="text-3xl font-bold text-neutral-900">审核中心</h1>
        <p className="mt-1 text-sm text-neutral-500">待审核内容支持一键通过或拒绝。</p>
      </header>

      {error ? <article className="rounded-2xl bg-white p-4 text-sm text-red-500 shadow-sm">{error}</article> : null}

      <section className="mt-3 space-y-3">
        {loading ? <article className="rounded-2xl bg-white p-4 text-sm text-neutral-500 shadow-sm">加载中...</article> : null}
        {!loading && queue.length === 0 ? (
          <article className="rounded-2xl bg-white p-4 text-sm text-neutral-500 shadow-sm">当前没有待审核内容。</article>
        ) : null}
        {!loading &&
          queue.map((item) => (
            <article key={item.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs text-neutral-400">{item.type.toUpperCase()} · {item.authorName}</p>
              <h3 className="mt-1 text-sm font-semibold text-neutral-900">{item.title}</h3>
              <p className="mt-1 text-sm text-neutral-600">{item.content}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleAction(item.id, "approve")}
                  disabled={actingId === item.id}
                  className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                >
                  一键通过
                </button>
                <button
                  onClick={() => handleAction(item.id, "reject")}
                  disabled={actingId === item.id}
                  className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-500 disabled:opacity-60"
                >
                  一键拒绝
                </button>
              </div>
            </article>
          ))}
      </section>

      <section className="mt-6 space-y-3">
        <header>
          <h2 className="text-xl font-bold text-neutral-900">活动报名管理</h2>
          <p className="mt-1 text-sm text-neutral-500">查看各活动报名人数与报名信息。</p>
        </header>
        {activities.length === 0 ? (
          <article className="rounded-2xl bg-white p-4 text-sm text-neutral-500 shadow-sm">暂无活动。</article>
        ) : null}
        {activities.map((item) => {
          const loadedSignups = activitySignupsMap[item.id] ?? [];
          const expanded = expandedActivityId === item.id;
          return (
            <article key={item.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-neutral-900">{item.title}</h3>
              <p className="mt-1 text-xs text-neutral-500">
                {item.location} · {new Date(item.startAt).toLocaleString("zh-CN")}
              </p>
              <button
                onClick={() => handleExpandActivitySignups(item.id)}
                className="mt-3 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white"
              >
                {expanded ? "收起报名信息" : "查看报名信息"}
              </button>
              {expanded ? (
                <div className="mt-3 rounded-xl bg-neutral-50 p-3">
                  <p className="text-xs text-neutral-500">报名人数：{loadedSignups.length}</p>
                  <div className="mt-2 space-y-2">
                    {loadedSignups.map((signup) => (
                      <div key={signup.id} className="rounded-lg bg-white p-2">
                        <p className="text-sm text-neutral-700">{signup.nickname}</p>
                        <p className="text-xs text-neutral-500">{signup.contact}</p>
                      </div>
                    ))}
                    {loadedSignups.length === 0 ? (
                      <p className="text-xs text-neutral-400">暂无报名记录。</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <BottomNav active="mine" />
    </main>
  );
}
