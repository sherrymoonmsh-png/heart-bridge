import { toChineseErrorMessage } from "@/lib/error-message";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { UserProfile } from "@/types/domain";

/** 与数据库 `auth.uid()` 一致：使用官方推荐的 `getUser()`（基于 JWT，可验证当前登录用户） */
async function requireAuthUserId(): Promise<string> {
  if (!supabase) throw new Error("当前服务未就绪，请稍后重试。");
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.id) {
    throw new Error("请先登录后再操作。");
  }
  return user.id;
}

function logSupabaseIssue(scope: string, err: { message: string; code?: string; details?: string; hint?: string }) {
  console.warn(`[${scope}]`, {
    message: err.message,
    code: err.code,
    details: err.details,
    hint: err.hint,
  });
}

function parseIsAdminColumn(raw: unknown): boolean {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;
  if (typeof raw === "string") {
    const s = raw.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no" || s === "") return false;
  }
  return false;
}

export type ProfilesAdminForExplore = {
  isAdmin: boolean;
  publisherName: string;
  hint: string | null;
};

/**
 * Official zone: `is_admin` comes only from `public.profiles` (row id = auth session user id).
 */
export async function getProfilesAdminForExplore(): Promise<ProfilesAdminForExplore> {
  const fallbackPublisher = "官方管理员";
  if (!hasSupabaseConfig || !supabase) {
    return { isAdmin: false, publisherName: fallbackPublisher, hint: null };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user) {
    return { isAdmin: false, publisherName: fallbackPublisher, hint: null };
  }

  const user = sessionData.session.user;
  const fromEmail = user.email?.split("@")[0]?.trim() || fallbackPublisher;

  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin, display_name, username")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return { isAdmin: false, publisherName: fromEmail, hint: null };
  }

  const row = data as { is_admin?: unknown; display_name?: string | null; username?: string | null };
  const isAdmin = parseIsAdminColumn(row.is_admin);
  const username =
    typeof row.username === "string" && row.username.trim() ? row.username.trim() : "";
  const displayName =
    typeof row.display_name === "string" && row.display_name.trim() ? row.display_name.trim() : "";

  return {
    isAdmin,
    publisherName: username || displayName || fromEmail,
    hint: null,
  };
}

export async function ensureUser(phone: string, displayName?: string) {
  if (!hasSupabaseConfig || !supabase) return true;
  const fallbackName = phone.startsWith("wx_") ? "微信用户" : `用户${phone.slice(-4)}`;
  const name = displayName?.trim() || fallbackName;
  const { error } = await supabase.from("users").upsert(
    {
      phone,
      name,
      streak_days: 1,
      logs_count: 0,
      groups_count: 0,
      harvest_count: 0,
      role: "user",
      avatar_url: "",
      bio: "",
    },
    { onConflict: "phone" },
  );
  return !error;
}

/** After Supabase session is established: ensure `users` + `profiles` rows (never overwrites `is_admin`). */
export async function syncAuthUserRecords(identityKey: string) {
  if (!hasSupabaseConfig || !supabase || !identityKey.trim()) return;
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUser = sessionData.session?.user;
  if (!sessionUser) return;

  const uid = sessionUser.id;
  const emailPrefix = identityKey.includes("@")
    ? identityKey.split("@")[0]!.trim()
    : `用户${identityKey.slice(-4)}`;

  await ensureUser(identityKey, emailPrefix);
  const { data: userRow } = await supabase.from("users").select("name").eq("phone", identityKey).maybeSingle();
  const display =
    (typeof userRow?.name === "string" && userRow.name.trim() ? userRow.name.trim() : "") || emailPrefix || "新用户";

  const { data: existingProfile } = await supabase.from("profiles").select("id").eq("id", uid).maybeSingle();
  if (!existingProfile) {
    await supabase.from("profiles").insert({
      id: uid,
      username: display,
      display_name: display,
      is_admin: false,
      avatar_url: "",
      bio: "",
    });
  } else {
    await supabase.from("profiles").update({ username: display, display_name: display }).eq("id", uid);
  }
}

export async function getUserProfile(phone: string): Promise<UserProfile | null> {
  if (!hasSupabaseConfig || !supabase || !phone) return null;
  let data: Record<string, unknown> | null = null;

  // Backward compatibility: some deployments use is_admin instead of role.
  const withAdminField = await supabase
    .from("users")
    .select("name,streak_days,logs_count,groups_count,harvest_count,role,is_admin,avatar_url,bio")
    .eq("phone", phone)
    .maybeSingle();

  if (withAdminField.error) {
    const fallback = await supabase
      .from("users")
      .select("name,streak_days,logs_count,groups_count,harvest_count,role,avatar_url,bio")
      .eq("phone", phone)
      .maybeSingle();
    if (fallback.error || !fallback.data) return null;
    data = fallback.data as Record<string, unknown>;
  } else {
    data = (withAdminField.data as Record<string, unknown> | null) ?? null;
  }
  if (!data) return null;

  const roleRaw = data.role;
  const roleStr = typeof roleRaw === "string" ? roleRaw.trim().toLowerCase() : "";
  const isAdminFromUsers = parseIsAdminColumn(data.is_admin) || roleStr === "admin";
  let displayName = String(data.name);
  let isAdminFromProfiles = false;

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  let avatarUrl = String(data.avatar_url || "");
  let bio = String(data.bio || "");
  if (uid) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("username, display_name, is_admin, avatar_url, bio")
      .eq("id", uid)
      .maybeSingle();
    if (prof) {
      const p = prof as {
        username?: string | null;
        display_name?: string | null;
        is_admin?: unknown;
        avatar_url?: string | null;
        bio?: string | null;
      };
      const fromUsername =
        typeof p.username === "string" && p.username.trim() ? p.username.trim() : "";
      const fromDisplay =
        typeof p.display_name === "string" && p.display_name.trim() ? p.display_name.trim() : "";
      if (fromUsername || fromDisplay) {
        displayName = fromUsername || fromDisplay;
      }
      isAdminFromProfiles = parseIsAdminColumn(p.is_admin);
      const fromProfAvatar = typeof p.avatar_url === "string" ? p.avatar_url.trim() : "";
      if (fromProfAvatar) {
        avatarUrl = fromProfAvatar;
      }
      if (typeof p.bio === "string") {
        bio = p.bio;
      }
    }
  }

  const isAdmin = isAdminFromUsers || isAdminFromProfiles;
  return {
    name: displayName,
    streakDays: Number(data.streak_days),
    logsCount: Number(data.logs_count),
    groupsCount: Number(data.groups_count),
    harvestCount: Number(data.harvest_count),
    role: isAdmin ? "admin" : "user",
    avatarUrl,
    bio,
  };
}

/**
 * 个人资料：`profiles` 行 `id` 恒为 `auth.uid()`，仅 upsert `username` / `bio` / `avatar_url`（不写自定义 API）。
 */
export async function updateUserBasicProfile(input: {
  phone: string;
  username: string;
  avatarUrl: string;
  bio: string;
}) {
  if (!hasSupabaseConfig || !supabase) throw new Error("当前服务未就绪，请稍后重试。");
  const uid = await requireAuthUserId();

  const profilePayload = {
    id: uid,
    username: input.username.trim(),
    bio: input.bio.trim(),
    avatar_url: input.avatarUrl.trim(),
  };

  const { error: profileError } = await supabase.from("profiles").upsert(profilePayload, { onConflict: "id" });
  if (profileError) {
    logSupabaseIssue("个人资料更新 profiles.upsert", profileError);
    throw new Error(toChineseErrorMessage(profileError, "资料更新失败，请稍后重试。"));
  }

  const phone = input.phone.trim();
  if (phone) {
    const { error: userError } = await supabase.from("users").upsert(
      {
        phone,
        name: profilePayload.username,
        avatar_url: profilePayload.avatar_url,
        bio: profilePayload.bio,
      },
      { onConflict: "phone" },
    );
    if (userError) {
      console.warn("[个人资料] users 表同步失败（profiles 已保存）:", userError.message);
    }
  }
}

/**
 * 头像：`storage.from('avatars').upload` → `getPublicUrl` → `profiles.upsert` 写入 `avatar_url`（`id = auth.uid()`）。
 */
export async function uploadAvatarFile(file: File) {
  if (!hasSupabaseConfig || !supabase) throw new Error("当前服务未就绪，请稍后重试。");
  const {
    data: { user: authUser },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !authUser?.id) {
    throw new Error("请先登录后再上传头像。");
  }
  const uid = authUser.id;
  const emailPrefix = authUser.email?.split("@")[0]?.trim() ?? "";

  const ext = file.name.split(".").pop() || "png";
  const path = `${uid}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (uploadError) {
    logSupabaseIssue("头像上传 storage.upload", uploadError);
    throw new Error(toChineseErrorMessage(uploadError, "头像上传失败，请稍后重试。"));
  }

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const { data: existing } = await supabase
    .from("profiles")
    .select("username,display_name,bio")
    .eq("id", uid)
    .maybeSingle();

  const ex = existing as {
    username?: string | null;
    display_name?: string | null;
    bio?: string | null;
  } | null;
  const username =
    (typeof ex?.username === "string" && ex.username.trim() ? ex.username.trim() : "") ||
    (typeof ex?.display_name === "string" && ex.display_name.trim() ? ex.display_name.trim() : "") ||
    emailPrefix ||
    "用户";
  const bio = typeof ex?.bio === "string" ? ex.bio : "";

  const profilePayload = {
    id: uid,
    username,
    bio,
    avatar_url: publicUrl,
  };

  const { error: profileError } = await supabase.from("profiles").upsert(profilePayload, { onConflict: "id" });
  if (profileError) {
    logSupabaseIssue("头像保存 profiles.upsert", profileError);
    throw new Error(toChineseErrorMessage(profileError, "头像地址保存失败，请稍后重试。"));
  }

  return publicUrl;
}
