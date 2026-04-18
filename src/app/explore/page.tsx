"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { getAuthedPhone, hydrateSessionFromSupabase, isAuthed } from "@/lib/auth-store";
import { toChineseErrorMessage } from "@/lib/error-message";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  createActivity,
  listActivities,
  toggleActivityFavorite,
  toggleActivityLike,
} from "@/lib/community-service";
import { listExploreItems } from "@/lib/explore-service";
import { ActivityItem, ExploreItem } from "@/types/domain";

async function fetchProfilesRowBySession(): Promise<Record<string, unknown> | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user?.id) return null;
  const uid = sessionData.session.user.id;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) {
    console.warn("profiles 查询未成功:", error);
    return null;
  }
  if (data) {
    console.log("✅ 成功读到profile:", data);
  }
  return data as Record<string, unknown> | null;
}

function pickUsernameFromProfilesRow(row: Record<string, unknown> | null): string {
  if (!row) return "";
  const raw = row.username;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  const dn = row.display_name;
  if (typeof dn === "string" && dn.trim()) return dn.trim();
  return "";
}

export default function ExplorePage() {
  const phone = getAuthedPhone();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [guestMode, setGuestMode] = useState(true);
  const [adminName, setAdminName] = useState("官方管理员");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [articles, setArticles] = useState<ExploreItem[]>([]);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityContent, setActivityContent] = useState("");
  const [activityLocation, setActivityLocation] = useState("");
  const [activityStartAt, setActivityStartAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [profileHint, setProfileHint] = useState("");
  const [contentHint, setContentHint] = useState("");

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        await hydrateSessionFromSupabase();
        if (cancelled) return;
        const authed = isAuthed();
        setGuestMode(!authed);
        if (!authed) {
          setProfile(null);
          setAdminName("官方管理员");
          setProfileHint("");
          return;
        }
        const identity = getAuthedPhone();
        if (!identity) {
          setGuestMode(true);
          setProfile(null);
          setAdminName("官方管理员");
          setProfileHint("");
          return;
        }

        let exploreProfileRow: Record<string, unknown> | null = null;
        if (hasSupabaseConfig && supabase) {
          const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
          if (sessionErr) {
            console.warn("explore getSession:", sessionErr);
          }
          const uid = sessionData.session?.user?.id;
          if (uid) {
            const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
            if (error) {
              console.warn("explore 强制 profiles 查询:", error);
            } else if (data) {
              exploreProfileRow = data as Record<string, unknown>;
              console.log("✅ 成功读到profile:", data);
            }
          }
        }

        if (!exploreProfileRow) {
          exploreProfileRow = await fetchProfilesRowBySession();
        }
        console.log("✅ explore页面成功读到profile:", exploreProfileRow);
        if (cancelled) return;
        setProfile(exploreProfileRow);
        setAdminName(pickUsernameFromProfilesRow(exploreProfileRow) || "官方管理员");
        setProfileHint("");
      } catch {
        if (!cancelled) {
          setProfile(null);
          setAdminName("官方管理员");
          setProfileHint("");
        }
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [phone]);

  const loadData = async () => {
    let currentPhone = "";
    try {
      currentPhone = getAuthedPhone();
    } catch {
      currentPhone = "";
    }
    const [activitiesResult, articlesResult] = await Promise.allSettled([
      listActivities(currentPhone),
      listExploreItems(),
    ]);
    if (activitiesResult.status === "fulfilled") {
      setActivities(activitiesResult.value);
    } else {
      setActivities([]);
    }
    if (articlesResult.status === "fulfilled") {
      setArticles(articlesResult.value);
    } else {
      setArticles([]);
    }
    if (activitiesResult.status === "rejected" || articlesResult.status === "rejected") {
      setContentHint("部分内容暂未能加载，已为你展示可用信息，请稍后刷新页面或检查网络。");
    } else {
      setContentHint("");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [phone]);

  const handleCreateActivity = async () => {
    if (!profile?.is_admin) {
      setError("管理员账号可发布");
      return;
    }
    if (!activityTitle.trim() || !activityContent.trim() || !activityLocation.trim() || !activityStartAt.trim()) {
      setError("请完整填写活动信息。");
      return;
    }
    setPublishing(true);
    setError("");
    try {
      await createActivity({
        title: activityTitle.trim(),
        content: activityContent.trim(),
        location: activityLocation.trim(),
        startAt: activityStartAt,
        isAdmin: true,
      });
      setActivityTitle("");
      setActivityContent("");
      setActivityLocation("");
      setActivityStartAt("");
      await loadData();
    } catch (err) {
      setError(toChineseErrorMessage(err, "活动发布失败，请稍后重试。"));
    } finally {
      setPublishing(false);
    }
  };

  const handleToggleActivityLike = async (activityId: string) => {
    if (guestMode) {
      setError("登录后可操作");
      return;
    }
    try {
      await toggleActivityLike(activityId, getAuthedPhone());
      await loadData();
    } catch (err) {
      setError(toChineseErrorMessage(err, "活动点赞失败，请稍后重试。"));
    }
  };

  const handleToggleActivityFavorite = async (activityId: string) => {
    if (guestMode) {
      setError("登录后可操作");
      return;
    }
    try {
      await toggleActivityFavorite(activityId, getAuthedPhone());
      await loadData();
    } catch (err) {
      setError(toChineseErrorMessage(err, "活动收藏失败，请稍后重试。"));
    }
  };

  return (
    <main className="phone-shell px-4 pb-24 pt-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold text-neutral-900">官方专区</h1>
          <p className="mt-1 text-sm text-neutral-500">线下活动招募与心理科普文章。</p>
        </div>
        {profile?.is_admin ? (
          <Link
            href="/explore/article/publish"
            className="shrink-0 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm"
          >
            发布科普文章
          </Link>
        ) : null}
      </header>

      {profileHint || contentHint ? (
        <article className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
          {profileHint ? <p>{profileHint}</p> : null}
          {contentHint ? <p className={profileHint ? "mt-2" : ""}>{contentHint}</p> : null}
        </article>
      ) : null}
      {error ? <article className="rounded-2xl bg-white p-4 text-sm text-red-500 shadow-sm">{error}</article> : null}

      <section className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs text-neutral-400">发布线下活动（仅管理员）</p>
        {!profile?.is_admin ? (
          <button
            disabled
            className="mt-2 h-10 w-full cursor-not-allowed rounded-full bg-neutral-200 text-sm font-semibold text-neutral-600"
          >
            管理员账号可发布
          </button>
        ) : (
          <>
            <input
              value={activityTitle}
              onChange={(event) => setActivityTitle(event.target.value)}
              placeholder="活动标题"
              className="mt-2 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-primary"
            />
            <input
              value={activityLocation}
              onChange={(event) => setActivityLocation(event.target.value)}
              placeholder="活动地点"
              className="mt-2 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-primary"
            />
            <input
              type="datetime-local"
              value={activityStartAt}
              onChange={(event) => setActivityStartAt(event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-primary"
            />
            <textarea
              value={activityContent}
              onChange={(event) => setActivityContent(event.target.value)}
              placeholder="活动介绍"
              className="mt-2 h-24 w-full resize-none rounded-xl border border-neutral-200 p-3 text-sm outline-none focus:border-primary"
            />
          </>
        )}
        <button
          onClick={handleCreateActivity}
          disabled={!profile?.is_admin}
          className="mt-3 h-10 w-full rounded-full bg-primary text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-600"
        >
          {!profile?.is_admin ? "管理员账号可发布" : publishing ? "发布中..." : "发布线下活动"}
        </button>
        {!profile?.is_admin ? <p className="mt-2 text-xs text-neutral-500">管理员账号可发布</p> : null}
      </section>

      <section className="mt-6 space-y-3">
        <p className="text-xs text-neutral-400">线下活动招募</p>
        {loading ? (
          <article className="rounded-2xl bg-white p-4 text-sm text-neutral-500 shadow-sm">加载中...</article>
        ) : null}
        {!loading && activities.length === 0 ? (
          <article className="rounded-2xl bg-white p-4 text-sm text-neutral-500 shadow-sm">暂无活动。</article>
        ) : null}
        {activities.map((item) => (
          <article key={item.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-neutral-900">{item.title}</h3>
            <p className="mt-1 text-sm text-neutral-600">{item.content}</p>
            <p className="mt-1 text-xs text-neutral-400">
              {item.location} · {new Date(item.startAt).toLocaleString("zh-CN")}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => handleToggleActivityLike(item.id)}
                className={`rounded-full px-3 py-1 text-xs ${
                  item.likedByMe ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {item.likedByMe ? "已点赞" : "点赞"} {item.likeCount}
              </button>
              <button
                onClick={() => handleToggleActivityFavorite(item.id)}
                className={`rounded-full px-3 py-1 text-xs ${
                  item.favoritedByMe ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {item.favoritedByMe ? "已收藏" : "收藏"} {item.favoriteCount}
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-6 space-y-3">
        <p className="text-xs text-neutral-400">心理科普文章</p>
        {!loading && articles.length === 0 ? (
          <article className="rounded-2xl bg-white p-4 text-sm text-neutral-500 shadow-sm">暂无科普文章。</article>
        ) : null}
        {articles.map((item) => (
          <article key={item.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-primary">{item.category}</p>
            <h3 className="mt-1 font-semibold text-neutral-900">{item.title}</h3>
            <p className="mt-1 text-sm text-neutral-600">{item.summary}</p>
          </article>
        ))}
      </section>

      <BottomNav active="explore" />
    </main>
  );
}
