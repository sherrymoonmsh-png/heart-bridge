import { toChineseErrorMessage } from "@/lib/error-message";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { DiaryEntry } from "@/types/domain";

/** 当前登录用户 id，与 `auth.uid()` 一致（仅使用 Supabase Auth，无 fetch / /api/） */
async function getCurrentUserId(): Promise<string | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.id) return null;
  return user.id;
}

function mapDiaryRows(data: unknown[] | null | undefined): DiaryEntry[] {
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      userPhone: String(r.user_phone ?? ""),
      userId: r.user_id ? String(r.user_id) : undefined,
      mood: String(r.mood),
      content: String(r.content),
      createdAt: String(r.created_at),
    };
  });
}

function mapSingleRow(row: Record<string, unknown>): DiaryEntry {
  return mapDiaryRows([row])[0]!;
}

/**
 * 加载当前用户日记：仅 `diaries` + `user_id = auth.getUser().id`（无其它 HTTP 客户端）。
 */
export async function listDiaryEntries(): Promise<DiaryEntry[]> {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error("Supabase 未配置，无法加载日记。");
  }
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("diaries")
    .select("id,user_id,mood,content,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(toChineseErrorMessage(error, "日记加载失败。"));
  }
  return mapDiaryRows(data);
}

/**
 * 保存日记：仅 `insert({ content, mood, user_id })`；可选 `select` 取回一行供界面更新（仍为 Supabase 客户端）。
 */
export async function createDiaryEntry(input: { mood: string; content: string }): Promise<DiaryEntry | null> {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error("Supabase 未配置，无法保存日记。");
  }
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("请先登录后再保存日记。");
  }

  const row = {
    content: input.content.trim(),
    mood: input.mood,
    user_id: userId,
  };

  const { data, error } = await supabase.from("diaries").insert(row).select("id,user_id,mood,content,created_at").maybeSingle();

  if (error) {
    throw new Error(toChineseErrorMessage(error, "日记保存失败。"));
  }
  if (!data) {
    return null;
  }
  return mapSingleRow(data as Record<string, unknown>);
}

export async function updateDiaryEntry(input: {
  id: string;
  mood: string;
  content: string;
}) {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error("Supabase 未配置，无法编辑日记。");
  }
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("请先登录后再编辑日记。");
  }
  const { error } = await supabase
    .from("diaries")
    .update({
      mood: input.mood,
      content: input.content.trim(),
    })
    .eq("id", input.id)
    .eq("user_id", userId);
  if (error) {
    throw new Error(toChineseErrorMessage(error, "日记编辑失败。"));
  }
}

export async function deleteDiaryEntry(input: { id: string }) {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error("Supabase 未配置，无法删除日记。");
  }
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("请先登录后再删除日记。");
  }
  const { error } = await supabase.from("diaries").delete().eq("id", input.id).eq("user_id", userId);
  if (error) {
    throw new Error(toChineseErrorMessage(error, "日记删除失败。"));
  }
}
