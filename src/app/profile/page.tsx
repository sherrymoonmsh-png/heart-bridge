"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import {
  getAuthedPhone,
  hydrateSessionFromSupabase,
  isAuthed,
  signOutAndClearSession,
} from "@/lib/auth-store";
import { toChineseErrorMessage } from "@/lib/error-message";
import { ENABLE_MENTAL_SUPPORT_SURFACES } from "@/lib/feature-flags";
import { ActivityItem, DiaryEntry, PostFeedItem, UserProfile } from "@/types/domain";
import { ensureUser, getUserProfile, syncAuthUserRecords, updateUserBasicProfile, uploadAvatarFile } from "@/lib/user-service";
import { listDiaryEntries } from "@/lib/diary-service";
import { listMyActivityFavorites, listMyPostFavorites } from "@/lib/community-service";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

/**
 * 官方推荐：当前用户 `profiles` 一行用 `select('*').eq('id', uid).single()`；
 * 无行时先由调用方 `syncAuthUserRecords` 建表后再查；仍无则 `maybeSingle` 软降级，避免 406/PGRST 噪声。
 */
async function fetchCurrentProfileSingleRow(identityKeyForSync: string): Promise<Record<string, unknown> | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) return null;
  const uid = user.id;

  const { data: exists } = await supabase.from("profiles").select("id").eq("id", uid).maybeSingle();
  if (!exists && identityKeyForSync.trim()) {
    await ensureUser(identityKeyForSync);
    await syncAuthUserRecords(identityKeyForSync);
  }

  const single = await supabase.from("profiles").select("*").eq("id", uid).single();
  if (!single.error && single.data) {
    return single.data as Record<string, unknown>;
  }

  const fallback = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  return (fallback.data as Record<string, unknown> | null) ?? null;
}

function pickDisplayNameFromProfileRow(row: Record<string, unknown> | null): string {
  if (!row) return "";
  const raw = row.username;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  const dn = row.display_name;
  if (typeof dn === "string" && dn.trim()) return dn.trim();
  return "";
}

function pickAvatarFromProfileRow(row: Record<string, unknown> | null): string {
  if (!row) return "";
  const u = row.avatar_url;
  return typeof u === "string" ? u.trim() : "";
}

function pickBioFromProfileRow(row: Record<string, unknown> | null): string {
  if (!row) return "";
  const b = row.bio;
  return typeof b === "string" ? b : "";
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>({
    name: "",
    streakDays: 0,
    logsCount: 0,
    groupsCount: 0,
    harvestCount: 0,
  });
  const [profilesUsername, setProfilesUsername] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [editingAvatar, setEditingAvatar] = useState("");
  const [editingBio, setEditingBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [tip, setTip] = useState("");
  const [myDiaries, setMyDiaries] = useState<DiaryEntry[]>([]);
  const [myPostFavorites, setMyPostFavorites] = useState<PostFeedItem[]>([]);
  const [myActivityFavorites, setMyActivityFavorites] = useState<ActivityItem[]>([]);

  const loadProfile = useCallback(async () => {
    await hydrateSessionFromSupabase();

    if (!hasSupabaseConfig || !supabase) {
      setAuthenticated(isAuthed());
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const sessionUserId = authData.user?.id;
    const authedLocal = isAuthed();
    const loggedIn = Boolean(sessionUserId) || authedLocal;
    setAuthenticated(loggedIn);
    if (!loggedIn) {
      return;
    }

    const phone = getAuthedPhone();
    const identity = phone || authData.user?.email || authData.user?.phone || "";

    const profilesRow = await fetchCurrentProfileSingleRow(identity);
    const fromProfiles = pickDisplayNameFromProfileRow(profilesRow);
    setProfilesUsername(fromProfiles);

    const avatarFromProfile = pickAvatarFromProfileRow(profilesRow);
    const bioFromProfile = pickBioFromProfileRow(profilesRow);

    let user = identity ? await getUserProfile(identity) : null;
    if (!user && identity) {
      await ensureUser(identity, fromProfiles || "新用户");
      await syncAuthUserRecords(identity);
      user = await getUserProfile(identity);
    }

    const displayName = fromProfiles || user?.name?.trim() || "";
    setEditingName(displayName || user?.name || "");
    setEditingAvatar(avatarFromProfile || user?.avatarUrl || "");
    setEditingBio(bioFromProfile || user?.bio || "");

    setProfile({
      name: displayName || user?.name || "",
      streakDays: user?.streakDays ?? 0,
      logsCount: user?.logsCount ?? 0,
      groupsCount: user?.groupsCount ?? 0,
      harvestCount: user?.harvestCount ?? 0,
      role: user?.role,
      avatarUrl: avatarFromProfile || user?.avatarUrl || "",
      bio: bioFromProfile || user?.bio || "",
    });

    const [diariesRes, postFavsRes, activityFavsRes] = await Promise.allSettled([
      listDiaryEntries(),
      identity ? listMyPostFavorites(identity) : Promise.resolve([]),
      identity ? listMyActivityFavorites(identity) : Promise.resolve([]),
    ]);
    setMyDiaries(diariesRes.status === "fulfilled" ? diariesRes.value : []);
    setMyPostFavorites(postFavsRes.status === "fulfilled" ? postFavsRes.value : []);
    setMyActivityFavorites(activityFavsRes.status === "fulfilled" ? activityFavsRes.value : []);
    const listErrors = [diariesRes, postFavsRes, activityFavsRes].some((item) => item.status === "rejected");
    if (listErrors && !profilesRow) {
      setTip("部分数据加载失败，已为你展示基础资料。");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoadingProfile(true);
      setTip("");
      try {
        await loadProfile();
      } catch (err) {
        if (!cancelled) {
          setTip(toChineseErrorMessage(err, "服务暂不可用，请稍后下拉刷新再试。"));
        }
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  const handleLogout = async () => {
    await signOutAndClearSession();
    router.replace("/login");
  };

  const handleSaveProfile = async () => {
    if (!hasSupabaseConfig || !supabase) {
      setTip("未配置 Supabase。");
      return;
    }
    const phone = getAuthedPhone();
    const { data: gu } = await supabase.auth.getUser();
    const identity = phone || gu.user?.email || gu.user?.phone || "";
    if (!identity) {
      setTip("请先登录后再保存资料。");
      return;
    }
    if (!editingName.trim()) {
      setTip("昵称不能为空。");
      return;
    }
    setSavingProfile(true);
    setTip("");
    try {
      await ensureUser(identity, editingName.trim() || profile.name || "新用户");
      await updateUserBasicProfile({
        phone: identity,
        username: editingName.trim(),
        avatarUrl: editingAvatar.trim(),
        bio: editingBio.trim(),
      });
      await loadProfile();
      setTip("保存成功");
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[个人中心] 资料更新失败:", err);
      }
      setTip(toChineseErrorMessage(err, "资料更新失败，请稍后重试。"));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !authenticated) return;
    if (!hasSupabaseConfig || !supabase) {
      setTip("未配置 Supabase。");
      return;
    }
    const phone = getAuthedPhone();
    const { data: gu } = await supabase.auth.getUser();
    const identity = phone || gu.user?.email || gu.user?.phone || "";
    setSavingProfile(true);
    setTip("");
    try {
      if (identity) {
        await ensureUser(identity, editingName.trim() || profile.name || "新用户");
      }
      const url = await uploadAvatarFile(file);
      setEditingAvatar(url);
      await loadProfile();
      setTip("保存成功");
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[个人中心] 头像上传失败:", err);
      }
      setTip(toChineseErrorMessage(err, "头像上传失败，请稍后重试。"));
    } finally {
      setSavingProfile(false);
    }
  };

  if (!loadingProfile && !authenticated) {
    return (
      <main className="phone-shell px-4 pb-24 pt-5">
        <header className="flex items-center justify-between">
          <p className="text-lg font-bold">心灵桥</p>
          <div className="h-9 w-9 rounded-full bg-[#ffd8c7]" />
        </header>
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <h1 className="text-xl font-bold text-neutral-900">请先登录查看个人中心</h1>
          <p className="mt-2 text-sm text-neutral-500">登录后可查看你的成长数据、历史记录和个人设置。</p>
          <Link
            href="/login"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-white"
          >
            去登录
          </Link>
        </section>
        <BottomNav active="mine" />
      </main>
    );
  }

  const displayName =
    profilesUsername.trim() || profile.name?.trim() || (loadingProfile ? "" : "新用户") || "新用户";

  return (
    <main className="phone-shell px-4 pb-24 pt-5">
      <header className="flex items-center justify-between">
        <p className="text-lg font-bold">心灵桥</p>
        <div className="h-9 w-9 rounded-full bg-[#ffd8c7]" />
      </header>

      <section className="mt-6 text-center">
        <div
          className="mx-auto h-24 w-24 rounded-full bg-cover bg-center bg-[#5a6d78]"
          style={profile.avatarUrl || editingAvatar ? { backgroundImage: `url(${editingAvatar || profile.avatarUrl})` } : undefined}
        />
        <h1 className="mt-3 text-4xl font-bold">{loadingProfile ? "加载中..." : displayName}</h1>
        <p className="mt-1 text-neutral-500">
          {loadingProfile ? "正在同步你的个人数据..." : `已持续静心 ${profile.streakDays} 天`}
        </p>
      </section>

      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs text-neutral-400">编辑个人资料（自动通过）</p>
        <input type="file" accept="image/*" onChange={handleAvatarUpload} className="mt-2 block w-full text-xs text-neutral-500" />
        <input
          value={editingName}
          onChange={(event) => setEditingName(event.target.value)}
          placeholder="昵称"
          className="mt-2 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-primary"
        />
        <input
          value={editingAvatar}
          onChange={(event) => setEditingAvatar(event.target.value)}
          placeholder="头像链接（可选）"
          className="mt-2 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-primary"
        />
        <textarea
          value={editingBio}
          onChange={(event) => setEditingBio(event.target.value)}
          placeholder="个人简介（可选）"
          className="mt-2 h-20 w-full resize-none rounded-xl border border-neutral-200 p-3 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={handleSaveProfile}
          disabled={savingProfile}
          className="mt-3 h-10 w-full rounded-full bg-primary text-sm font-semibold text-white disabled:opacity-60"
        >
          {savingProfile ? "保存中..." : "保存资料"}
        </button>
        {tip ? <p className="mt-2 text-xs text-neutral-500">{tip}</p> : null}
      </section>

      <section className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white py-4 text-center">
          <p className="text-3xl font-bold text-primary">{profile.logsCount}</p>
          <p className="text-xs text-neutral-500">心悟日志</p>
        </div>
        <div className="rounded-2xl bg-white py-4 text-center">
          <p className="text-3xl font-bold text-primary">{profile.groupsCount}</p>
          <p className="text-xs text-neutral-500">{ENABLE_MENTAL_SUPPORT_SURFACES ? "参与互助" : "社区参与"}</p>
        </div>
        <div className="rounded-2xl bg-white py-4 text-center">
          <p className="text-3xl font-bold text-primary">{profile.harvestCount}</p>
          <p className="text-xs text-neutral-500">我的收获</p>
        </div>
      </section>

      <section className="mt-5 space-y-3">
        <article className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-neutral-900">我的日记</p>
          {myDiaries.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">暂无日记记录。</p>
          ) : (
            <div className="mt-2 space-y-2">
              {myDiaries.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-xl bg-neutral-50 p-3">
                  <p className="text-xs text-primary">{item.mood}</p>
                  <p className="mt-1 text-sm text-neutral-700">{item.content}</p>
                </div>
              ))}
            </div>
          )}
        </article>
        <article className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-neutral-900">我的收藏（帖子）</p>
          {myPostFavorites.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">暂无帖子收藏。</p>
          ) : (
            <div className="mt-2 space-y-2">
              {myPostFavorites.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-xl bg-neutral-50 p-3">
                  <p className="text-sm font-medium text-neutral-800">{item.title}</p>
                  <p className="mt-1 text-xs text-neutral-500">{item.content}</p>
                </div>
              ))}
            </div>
          )}
        </article>
        <article className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-neutral-900">我的活动收藏</p>
          {myActivityFavorites.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">暂无活动收藏。</p>
          ) : (
            <div className="mt-2 space-y-2">
              {myActivityFavorites.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-xl bg-neutral-50 p-3">
                  <p className="text-sm font-medium text-neutral-800">{item.title}</p>
                  <p className="mt-1 text-xs text-neutral-500">{item.location}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <button
        onClick={handleLogout}
        className="mt-4 h-11 w-full rounded-full border border-primary bg-white text-sm font-semibold text-primary"
      >
        退出登录
      </button>

      <p className="mt-8 text-center text-sm italic text-neutral-400">
        “在每一个释道的时刻，遇见更好的自己。”
      </p>

      <BottomNav active="mine" />
    </main>
  );
}
