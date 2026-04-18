"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { hydrateSessionFromSupabase, isAuthed } from "@/lib/auth-store";
import { createDiaryEntry, deleteDiaryEntry, listDiaryEntries, updateDiaryEntry } from "@/lib/diary-service";
import { toChineseErrorMessage } from "@/lib/error-message";
import { DiaryEntry } from "@/types/domain";

export default function DiaryPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [mood, setMood] = useState("平静");
  const [content, setContent] = useState("");
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadHint, setLoadHint] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editMood, setEditMood] = useState("平静");
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        await hydrateSessionFromSupabase();
        if (cancelled) return;
        const authed = isAuthed();
        setAuthenticated(authed);
      } catch {
        if (!cancelled) {
          setAuthenticated(false);
        }
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const guestMode = !authenticated;

  useEffect(() => {
    let cancelled = false;
    const loadEntries = async () => {
      if (guestMode) {
        setEntries([]);
        setLoadHint("");
        setError("");
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadHint("");
      setError("");
      try {
        const data = await listDiaryEntries();
        if (!cancelled) setEntries(data);
      } catch (err) {
        if (!cancelled) {
          setEntries([]);
          setLoadHint(toChineseErrorMessage(err, "日记列表暂未能加载，请稍后下拉刷新重试。"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadEntries();
    return () => {
      cancelled = true;
    };
  }, [guestMode]);

  const handleCreateDiary = async () => {
    if (!authenticated) {
      setError("请先登录后再记录日记。");
      return;
    }
    if (!content.trim()) {
      setError("请先输入日记内容。");
      return;
    }
    setSaving(true);
    setError("");
    setLoadHint("");
    try {
      const newEntry = await createDiaryEntry({
        mood,
        content: content.trim(),
      });
      setContent("");
      setError("");
      setLoadHint("保存成功");
      if (newEntry) {
        setEntries((prev) => [newEntry, ...prev]);
      } else {
        const data = await listDiaryEntries();
        setEntries(data);
      }
    } catch (err) {
      setError(toChineseErrorMessage(err, "日记保存失败。"));
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (entry: DiaryEntry) => {
    setEditingId(entry.id);
    setEditMood(entry.mood);
    setEditContent(entry.content);
    setError("");
  };

  const handleCancelEdit = () => {
    setEditingId("");
    setEditMood("平静");
    setEditContent("");
  };

  const handleUpdateDiary = async () => {
    if (!authenticated) {
      setError("请先登录后再编辑日记。");
      return;
    }
    if (!editingId) return;
    if (!editContent.trim()) {
      setError("编辑内容不能为空。");
      return;
    }
    setSaving(true);
    setError("");
    setLoadHint("");
    try {
      await updateDiaryEntry({
        id: editingId,
        mood: editMood,
        content: editContent.trim(),
      });
      const data = await listDiaryEntries();
      setEntries(data);
      handleCancelEdit();
      setLoadHint("保存成功");
      setError("");
    } catch (err) {
      setError(toChineseErrorMessage(err, "日记编辑失败。"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDiary = async (entryId: string) => {
    if (!authenticated) {
      setError("请先登录后再删除日记。");
      return;
    }
    setSaving(true);
    setError("");
    setLoadHint("");
    try {
      await deleteDiaryEntry({ id: entryId });
      const data = await listDiaryEntries();
      setEntries(data);
      if (editingId === entryId) handleCancelEdit();
    } catch (err) {
      setError(toChineseErrorMessage(err, "日记删除失败。"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="phone-shell px-4 pb-24 pt-5">
      <header className="mb-4">
        <h1 className="text-3xl font-bold text-neutral-900">日记</h1>
        <p className="mt-1 text-sm text-neutral-500">记录你的心情变化，照见更真实的自己。</p>
        {guestMode ? (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
            请先登录查看日记。
            <Link href="/login" className="ml-1 underline">
              去登录
            </Link>
          </p>
        ) : null}
      </header>

      <section className="space-y-3">
        <article className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-neutral-400">记录今日心情</p>
          <div className="mt-2 flex gap-2">
            {["开心", "平静", "焦虑", "难过"].map((item) => (
              <button
                key={item}
                onClick={() => setMood(item)}
                disabled={guestMode || saving}
                className={`rounded-full px-3 py-1 text-xs ${
                  mood === item ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"
                } disabled:opacity-60`}
              >
                {item}
              </button>
            ))}
          </div>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            disabled={guestMode || saving}
            placeholder="写下今天的心情和想法..."
            className="mt-3 h-24 w-full resize-none rounded-xl border border-neutral-200 p-3 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={handleCreateDiary}
            disabled={guestMode || saving}
            className="mt-3 h-10 w-full rounded-full bg-primary text-sm font-semibold text-white disabled:opacity-60"
          >
            {guestMode ? "登录后可记录" : saving ? "保存中..." : "保存日记"}
          </button>
          {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
          {loadHint ? <p className="mt-2 text-xs text-amber-800">{loadHint}</p> : null}
        </article>

        {loading ? (
          <article className="rounded-2xl bg-white p-4 text-sm text-neutral-500 shadow-sm">加载中...</article>
        ) : null}
        {!loading && !guestMode && entries.length === 0 && !loadHint ? (
          <article className="rounded-2xl bg-white p-4 text-sm text-neutral-500 shadow-sm">
            还没有日记，记录第一条吧。
          </article>
        ) : null}
        {!loading && guestMode ? (
          <article className="rounded-2xl bg-white p-4 text-sm text-neutral-500 shadow-sm">
            请先登录查看日记；登录后可创建、编辑你的个人日记。
          </article>
        ) : null}
        {!loading &&
          entries.map((entry) => (
            <article key={entry.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs text-primary">{editingId === entry.id ? editMood : entry.mood}</p>
                <p className="text-xs text-neutral-400">
                  {new Date(entry.createdAt).toLocaleString("zh-CN")}
                </p>
              </div>
              {editingId === entry.id ? (
                <>
                  <div className="mt-2 flex gap-2">
                    {["开心", "平静", "焦虑", "难过"].map((item) => (
                      <button
                        key={`edit-${item}`}
                        onClick={() => setEditMood(item)}
                        disabled={saving}
                        className={`rounded-full px-3 py-1 text-xs ${
                          editMood === item ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"
                        } disabled:opacity-60`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={editContent}
                    onChange={(event) => setEditContent(event.target.value)}
                    disabled={saving}
                    className="mt-2 h-24 w-full resize-none rounded-xl border border-neutral-200 p-3 text-sm outline-none focus:border-primary"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={handleUpdateDiary}
                      disabled={saving}
                      className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      保存修改
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600 disabled:opacity-60"
                    >
                      取消
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-neutral-700">{entry.content}</p>
                  {!guestMode ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleStartEdit(entry)}
                        disabled={saving}
                        className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600 disabled:opacity-60"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteDiary(entry.id)}
                        disabled={saving}
                        className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-500 disabled:opacity-60"
                      >
                        删除
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </article>
          ))}
      </section>

      <BottomNav active="journal" />
    </main>
  );
}
