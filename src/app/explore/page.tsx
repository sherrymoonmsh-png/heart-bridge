"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { getAuthedPhone, hydrateSessionFromSupabase, isAuthed } from "@/lib/auth-store";
import { toChineseErrorMessage } from "@/lib/error-message";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  createActivitySignup,
  createActivity,
  deleteActivity,
  listActivitySignups,
  listActivities,
  toggleActivityFavorite,
  toggleActivityLike,
  updateActivity,
} from "@/lib/community-service";
import { deleteExploreItem, listExploreItems, updateExploreItem } from "@/lib/explore-service";
import { ActivityItem, ActivitySignupItem, ExploreItem } from "@/types/domain";

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
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [articleExpanded, setArticleExpanded] = useState(false);
  const [activeActivity, setActiveActivity] = useState<ActivityItem | null>(null);
  const [signupNickname, setSignupNickname] = useState("");
  const [signupContact, setSignupContact] = useState("");
  const [submittingSignup, setSubmittingSignup] = useState(false);
  const [activitySignups, setActivitySignups] = useState<Record<string, ActivitySignupItem[]>>({});
  const [editingActivityId, setEditingActivityId] = useState("");
  const [editingArticleId, setEditingArticleId] = useState("");
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
      listExploreItems(currentPhone),
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

  const handleOpenActivity = async (item: ActivityItem) => {
    setActiveActivity(item);
    if (!profile?.is_admin) return;
    try {
      const rows = await listActivitySignups(item.id);
      setActivitySignups((prev) => ({ ...prev, [item.id]: rows }));
    } catch {
      setActivitySignups((prev) => ({ ...prev, [item.id]: [] }));
    }
  };

  const handleSubmitSignup = async () => {
    if (!activeActivity) return;
    if (!signupNickname.trim() || !signupContact.trim()) {
      setError("请填写昵称和联系方式。");
      return;
    }
    setSubmittingSignup(true);
    setError("");
    try {
      await createActivitySignup({
        activityId: activeActivity.id,
        nickname: signupNickname.trim(),
        contact: signupContact.trim(),
      });
      setSignupNickname("");
      setSignupContact("");
      if (profile?.is_admin) {
        const rows = await listActivitySignups(activeActivity.id);
        setActivitySignups((prev) => ({ ...prev, [activeActivity.id]: rows }));
      }
    } catch (err) {
      setError(toChineseErrorMessage(err, "报名失败，请稍后重试。"));
    } finally {
      setSubmittingSignup(false);
    }
  };

  const handleExportSignupsCsv = (activityId: string) => {
    const rows = activitySignups[activityId] ?? [];
    const header = "昵称,联系方式,报名时间";
    const body = rows
      .map((item) => [item.nickname, item.contact, new Date(item.createdAt).toLocaleString("zh-CN")].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-signups-${activityId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEditActivity = async (item: ActivityItem) => {
    if (!profile?.is_admin) return;
    setEditingActivityId(item.id);
    const nextTitle = window.prompt("编辑活动标题", item.title) ?? "";
    if (!nextTitle.trim()) {
      setEditingActivityId("");
      return;
    }
    const nextContent = window.prompt("编辑活动简介", item.content) ?? "";
    if (!nextContent.trim()) {
      setEditingActivityId("");
      return;
    }
    const nextLocation = window.prompt("编辑活动地点", item.location) ?? "";
    if (!nextLocation.trim()) {
      setEditingActivityId("");
      return;
    }
    const nextStartAt = window.prompt("编辑活动时间（YYYY-MM-DDTHH:mm）", item.startAt.slice(0, 16)) ?? "";
    if (!nextStartAt.trim()) {
      setEditingActivityId("");
      return;
    }
    try {
      await updateActivity({
        id: item.id,
        title: nextTitle,
        content: nextContent,
        location: nextLocation,
        startAt: nextStartAt,
      });
      await loadData();
    } catch (err) {
      setError(toChineseErrorMessage(err, "活动编辑失败，请稍后重试。"));
    } finally {
      setEditingActivityId("");
    }
  };

  const handleDeleteActivity = async (item: ActivityItem) => {
    if (!profile?.is_admin) return;
    if (!window.confirm(`确认删除活动「${item.title}」吗？`)) return;
    try {
      await deleteActivity(item.id);
      await loadData();
    } catch (err) {
      setError(toChineseErrorMessage(err, "活动删除失败，请稍后重试。"));
    }
  };

  const handleEditArticle = async (item: ExploreItem) => {
    if (!profile?.is_admin) return;
    setEditingArticleId(item.id);
    const nextTitle = window.prompt("编辑文章标题", item.title) ?? "";
    if (!nextTitle.trim()) {
      setEditingArticleId("");
      return;
    }
    const nextSummary = window.prompt("编辑文章正文", item.content || item.summary) ?? "";
    if (!nextSummary.trim()) {
      setEditingArticleId("");
      return;
    }
    try {
      await updateExploreItem({ id: item.id, title: nextTitle, summary: nextSummary });
      await loadData();
    } catch (err) {
      setError(toChineseErrorMessage(err, "文章编辑失败，请稍后重试。"));
    } finally {
      setEditingArticleId("");
    }
  };

  const handleDeleteArticle = async (item: ExploreItem) => {
    if (!profile?.is_admin) return;
    if (!window.confirm(`确认删除文章「${item.title}」吗？`)) return;
    try {
      await deleteExploreItem(item.id);
      await loadData();
    } catch (err) {
      setError(toChineseErrorMessage(err, "文章删除失败，请稍后重试。"));
    }
  };

  const latestActivity = [...activities].sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt))[0];
  const latestArticle = articles[0];

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

      <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
        <button onClick={() => setActivityExpanded((prev) => !prev)} className="flex w-full items-center justify-between">
          <p className="text-sm font-semibold text-neutral-900">线下活动招募</p>
          <span className="text-xs text-neutral-500">{activityExpanded ? "收起" : "展开"}</span>
        </button>
        {!activityExpanded && latestActivity ? (
          <article className="mt-3 rounded-xl bg-neutral-50 p-3">
            <h3 className="font-semibold text-neutral-900">{latestActivity.title}</h3>
            <p className="mt-1 text-sm text-neutral-600">{latestActivity.content}</p>
            <p className="mt-1 text-xs text-neutral-400">
              {latestActivity.location} · {new Date(latestActivity.startAt).toLocaleString("zh-CN")}
            </p>
          </article>
        ) : null}
        {!activityExpanded && !loading && !latestActivity ? <p className="mt-3 text-sm text-neutral-500">暂无活动。</p> : null}
        {activityExpanded ? (
          <div className="mt-3 space-y-3">
            {activities.map((item) => (
              <article key={item.id} className="rounded-xl border border-neutral-100 p-3">
                <h3 className="font-semibold text-neutral-900">{item.title}</h3>
                <p className="mt-1 text-sm text-neutral-600">{item.content}</p>
                <p className="mt-1 text-xs text-neutral-400">
                  {item.location} · {new Date(item.startAt).toLocaleString("zh-CN")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
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
                  <button
                    onClick={() => handleOpenActivity(item)}
                    className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white"
                  >
                    查看详情
                  </button>
                  {profile?.is_admin ? (
                    <>
                      <button
                        onClick={() => handleEditActivity(item)}
                        disabled={editingActivityId === item.id}
                        className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700"
                      >
                        {editingActivityId === item.id ? "编辑中..." : "编辑"}
                      </button>
                      <button
                        onClick={() => handleDeleteActivity(item)}
                        className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-600"
                      >
                        删除
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
        <button onClick={() => setArticleExpanded((prev) => !prev)} className="flex w-full items-center justify-between">
          <p className="text-sm font-semibold text-neutral-900">心理科普文章</p>
          <span className="text-xs text-neutral-500">{articleExpanded ? "收起" : "展开"}</span>
        </button>
        {!articleExpanded && latestArticle ? (
          <article className="mt-3 rounded-xl bg-neutral-50 p-3">
            <h3 className="font-semibold text-neutral-900">{latestArticle.title}</h3>
            <p
              className="mt-1 text-sm text-neutral-600"
              style={{
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 3,
                overflow: "hidden",
              }}
            >
              {latestArticle.summary}
            </p>
          </article>
        ) : null}
        {!articleExpanded && !loading && !latestArticle ? <p className="mt-3 text-sm text-neutral-500">暂无科普文章。</p> : null}
        {articleExpanded ? (
          <div className="mt-3 space-y-3">
            {articles.map((item) => (
              <div key={item.id} className="rounded-xl border border-neutral-100 p-3">
                <Link href={`/explore/article/${item.id}`} className="block">
                  <p className="text-xs text-primary">{item.category}</p>
                  <h3 className="mt-1 font-semibold text-neutral-900">{item.title}</h3>
                  <p
                    className="mt-1 text-sm text-neutral-600"
                    style={{
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 3,
                      overflow: "hidden",
                    }}
                  >
                    {item.summary}
                  </p>
                </Link>
                {profile?.is_admin ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleEditArticle(item)}
                      disabled={editingArticleId === item.id}
                      className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700"
                    >
                      {editingArticleId === item.id ? "编辑中..." : "编辑"}
                    </button>
                    <button
                      onClick={() => handleDeleteArticle(item)}
                      className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-600"
                    >
                      删除
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {activeActivity ? (
        <section className="fixed inset-0 z-20 bg-black/50 p-4">
          <article className="mx-auto mt-10 max-w-[460px] rounded-2xl bg-white p-4 shadow-lg">
            <h3 className="font-semibold text-neutral-900">{activeActivity.title}</h3>
            <p className="mt-1 text-xs text-neutral-500">{activeActivity.location}</p>
            <p className="mt-1 text-xs text-neutral-500">{new Date(activeActivity.startAt).toLocaleString("zh-CN")}</p>
            <p className="mt-3 text-sm text-neutral-700">{activeActivity.content}</p>

            {profile?.is_admin ? (
              <div className="mt-4 rounded-xl bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">
                  报名人数：{(activitySignups[activeActivity.id] ?? []).length}
                </p>
                <button
                  onClick={() => handleExportSignupsCsv(activeActivity.id)}
                  className="mt-2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white"
                >
                  导出报名人信息（CSV）
                </button>
                <div className="mt-2 space-y-2">
                  {(activitySignups[activeActivity.id] ?? []).map((signup) => (
                    <div key={signup.id} className="rounded-lg bg-white p-2">
                      <p className="text-sm text-neutral-700">{signup.nickname}</p>
                      <p className="text-xs text-neutral-500">{signup.contact}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">报名参加</p>
                <input
                  value={signupNickname}
                  onChange={(event) => setSignupNickname(event.target.value)}
                  placeholder="昵称"
                  className="mt-2 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-primary"
                />
                <input
                  value={signupContact}
                  onChange={(event) => setSignupContact(event.target.value)}
                  placeholder="联系方式"
                  className="mt-2 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={handleSubmitSignup}
                  disabled={submittingSignup}
                  className="mt-3 h-10 w-full rounded-full bg-primary text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submittingSignup ? "提交中..." : "报名参加"}
                </button>
              </div>
            )}

            <button
              onClick={() => setActiveActivity(null)}
              className="mt-4 h-10 w-full rounded-full border border-neutral-200 text-sm text-neutral-700"
            >
              关闭
            </button>
          </article>
        </section>
      ) : null}

      <BottomNav active="explore" />
    </main>
  );
}
