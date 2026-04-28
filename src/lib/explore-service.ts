import { toChineseErrorMessage } from "@/lib/error-message";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { ExploreItem } from "@/types/domain";

const ARTICLE_KIND = "article" as const;
const ARTICLE_CATEGORY = "心理科普";

export async function listExploreItems(userPhone = ""): Promise<ExploreItem[]> {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error("Supabase 未配置，无法加载探索内容。");
  }

  const { data, error } = await supabase
    .from("activities")
    .select("id,title,summary,content,category,like_count,favorite_count,created_at")
    .eq("kind", ARTICLE_KIND)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(toChineseErrorMessage(error, "探索内容加载失败。"));
  }

  let likedIds = new Set<string>();
  let favoritedIds = new Set<string>();
  if (userPhone) {
    const [{ data: likes }, { data: favorites }] = await Promise.all([
      supabase.from("activity_likes").select("activity_id").eq("user_phone", userPhone),
      supabase.from("activity_favorites").select("activity_id").eq("user_phone", userPhone),
    ]);
    likedIds = new Set((likes ?? []).map((item) => String(item.activity_id)));
    favoritedIds = new Set((favorites ?? []).map((item) => String(item.activity_id)));
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    summary: String((row as { summary?: string | null }).summary ?? row.content ?? ""),
    content: String(row.content ?? ""),
    category: String(row.category ?? ARTICLE_CATEGORY),
    createdAt: String(row.created_at),
    likeCount: Number(row.like_count ?? 0),
    favoriteCount: Number(row.favorite_count ?? 0),
    likedByMe: likedIds.has(String(row.id)),
    favoritedByMe: favoritedIds.has(String(row.id)),
  }));
}

export async function createExploreItem(input: { title: string; summary: string; authorId: string }) {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error("Supabase 未配置，无法发布科普文章。");
  }

  const title = input.title.trim();
  const summary = input.summary.trim();
  const authorId = input.authorId;

  /** 与 activities 表字段一致，仅包含：title, summary, author_id, kind, category, content, location, start_at, like_count, favorite_count */
  const insertPayload = {
    title,
    summary,
    author_id: authorId,
    kind: ARTICLE_KIND,
    category: ARTICLE_CATEGORY,
    content: summary,
    location: "线上",
    start_at: new Date().toISOString(),
    like_count: 0,
    favorite_count: 0,
  };

  console.log("[发布科普文章] 完整请求体(写入 activities):", JSON.stringify(insertPayload, null, 2));

  const { data, error } = await supabase.from("activities").insert(insertPayload).select("id").maybeSingle();

  if (error) {
    console.error("[发布科普文章] Supabase 错误对象:", error);
    console.error(
      "[发布科普文章] 错误信息(可序列化):",
      JSON.stringify(
        {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        },
        null,
        2,
      ),
    );
    throw new Error(toChineseErrorMessage(error, "科普文章发布失败。"));
  }

  console.log("[发布科普文章] 插入成功, 返回:", data);
}
