"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hydrateSessionFromSupabase, isAuthed } from "@/lib/auth-store";
import { createExploreItem } from "@/lib/explore-service";
import { toChineseErrorMessage } from "@/lib/error-message";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export default function PublishExploreArticlePage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("心理科普");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setChecking(true);
      setError("");
      try {
        await hydrateSessionFromSupabase();
        if (!isAuthed()) {
          if (!cancelled) setIsAdmin(false);
          return;
        }
        if (!hasSupabaseConfig || !supabase) {
          if (!cancelled) setError("未配置 Supabase。");
          return;
        }
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData.session?.user?.id;
        if (!uid) {
          if (!cancelled) setError("未登录或会话无效。");
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", uid)
          .maybeSingle();
        if (!cancelled) setIsAdmin(profile?.is_admin === true);
      } catch (err) {
        if (!cancelled) setError(toChineseErrorMessage(err, "加载失败。"));
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async () => {
    if (!isAdmin) return;
    if (!title.trim() || !summary.trim()) {
      setError("请填写标题与摘要。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (!hasSupabaseConfig || !supabase) {
        setError("未配置 Supabase。");
        return;
      }
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData.session?.user?.id) {
        setError("未登录或会话无效。");
        return;
      }
      const authorId = sessionData.session.user.id;
      await createExploreItem({
        title: title.trim(),
        summary: summary.trim(),
        authorId,
      });
      router.replace("/explore");
    } catch (err) {
      setError(toChineseErrorMessage(err, "发布失败，请稍后重试。"));
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <main className="phone-shell px-4 pb-24 pt-5">
        <p className="text-sm text-neutral-500">加载中...</p>
      </main>
    );
  }

  if (!isAuthed()) {
    return (
      <main className="phone-shell px-4 pb-24 pt-5">
        <p className="text-sm text-neutral-600">请先登录后再发布。</p>
        <Link href="/login" className="mt-3 inline-block text-primary underline">
          去登录
        </Link>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="phone-shell px-4 pb-24 pt-5">
        <p className="text-sm text-red-600">仅管理员可发布科普文章。</p>
        <Link href="/explore" className="mt-3 inline-block text-primary underline">
          返回官方专区
        </Link>
      </main>
    );
  }

  return (
    <main className="phone-shell px-4 pb-24 pt-5">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">发布科普文章</h1>
        <Link href="/explore" className="text-sm text-primary underline">
          返回
        </Link>
      </header>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs text-neutral-400">标题</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-primary"
            placeholder="文章标题"
          />
        </div>
        <div>
          <p className="text-xs text-neutral-400">分类</p>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-primary"
            placeholder="例如：心理科普"
          />
        </div>
        <div>
          <p className="text-xs text-neutral-400">摘要 / 正文简介</p>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={8}
            className="mt-1 w-full resize-none rounded-xl border border-neutral-200 p-3 text-sm outline-none focus:border-primary"
            placeholder="简要介绍文章内容..."
          />
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSubmit()}
          className="h-11 w-full rounded-full bg-primary text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "发布中..." : "发布"}
        </button>
      </section>
    </main>
  );
}
