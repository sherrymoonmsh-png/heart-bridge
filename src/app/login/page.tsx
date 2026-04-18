"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { hydrateSessionFromSupabase, setAuthedPhone } from "@/lib/auth-store";
import { toChineseErrorMessage } from "@/lib/error-message";
import { ensureUser, syncAuthUserRecords } from "@/lib/user-service";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isRegister = mode === "register";
  const canSubmit = /\S+@\S+\.\S+/.test(email) && password.length >= 6 && agree;

  useEffect(() => {
    let cancelled = false;
    const restoreSession = async () => {
      const restored = await hydrateSessionFromSupabase();
      if (restored && !cancelled) router.replace("/community");
    };
    restoreSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSubmit = async () => {
    if (!agree) {
      setError("请先阅读并同意用户协议与隐私政策。");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("请输入正确的邮箱地址。");
      return;
    }
    if (password.length < 6) {
      setError("密码至少 6 位。");
      return;
    }
    if (isRegister && password !== confirmPassword) {
      setError("两次输入的密码不一致。");
      return;
    }
    if (!hasSupabaseConfig || !supabase) {
      setError("当前未配置 Supabase，无法进行邮箱注册/登录。");
      return;
    }

    setError("");
    setLoading(true);

    if (isRegister) {
      const { error: registerError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (registerError) {
        setLoading(false);
        setError(toChineseErrorMessage(registerError, "注册失败，请稍后重试。"));
        return;
      }
      const fallbackName = email.split("@")[0] || "新用户";
      await ensureUser(email, fallbackName);
      const { data: regSession } = await supabase.auth.getSession();
      setAuthedPhone(email, regSession.session?.user?.id ?? "");
      await syncAuthUserRecords(email);
      setLoading(false);
      router.push("/community");
      return;
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (loginError) {
      setLoading(false);
      setError(toChineseErrorMessage(loginError, "登录失败，请检查邮箱或密码。"));
      return;
    }
    const { data: loginSession } = await supabase.auth.getSession();
    setAuthedPhone(email, loginSession.session?.user?.id ?? "");
    await syncAuthUserRecords(email);
    setLoading(false);
    router.push("/community");
  };

  return (
    <main className="phone-shell px-6 pt-16">
      <div className="mx-auto mb-10 flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-sm">
        <span className="text-3xl text-primary">❋</span>
      </div>

      <h1 className="text-center text-5xl font-bold tracking-tight text-neutral-900">
        欢迎回到心灵桥
      </h1>
      <p className="mt-3 text-center text-xl text-neutral-500">
        在这里，找到属于你的片刻宁静
      </p>

      <div className="mt-10 flex rounded-2xl bg-white p-1 shadow-sm">
        <button
          onClick={() => {
            setMode("login");
            setError("");
          }}
          className={`h-10 flex-1 rounded-xl text-sm font-semibold transition ${
            !isRegister ? "bg-primary text-white" : "text-neutral-600"
          }`}
        >
          邮箱登录
        </button>
        <button
          onClick={() => {
            setMode("register");
            setError("");
          }}
          className={`h-10 flex-1 rounded-xl text-sm font-semibold transition ${
            isRegister ? "bg-primary text-white" : "text-neutral-600"
          }`}
        >
          邮箱注册
        </button>
      </div>

      <section className="mt-6 space-y-4">
        <div className="flex h-14 items-center gap-3 rounded-2xl bg-white px-4">
          <span>✉️</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value.trim())}
            placeholder="请输入邮箱"
            className="w-full border-none bg-transparent text-base outline-none placeholder:text-neutral-400"
          />
        </div>
        <div className="flex h-14 items-center gap-3 rounded-2xl bg-white px-4">
          <span className="text-neutral-400">🔒</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="请输入密码（至少 6 位）"
            className="w-full border-none bg-transparent text-base outline-none placeholder:text-neutral-400"
          />
        </div>
        {isRegister ? (
          <div className="flex h-14 items-center gap-3 rounded-2xl bg-white px-4">
            <span className="text-neutral-400">🔐</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="请确认密码"
              className="w-full border-none bg-transparent text-base outline-none placeholder:text-neutral-400"
            />
          </div>
        ) : null}
      </section>

      <button
        onClick={handleSubmit}
        disabled={loading || !canSubmit}
        className="mt-8 flex h-14 w-full items-center justify-center rounded-full bg-primary text-xl font-bold text-white shadow-md disabled:opacity-70"
      >
        {loading ? "处理中..." : isRegister ? "注册并开始" : "登录并开始"}
      </button>

      <div className="mt-auto pb-8 text-sm text-neutral-500">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={agree}
            onChange={(event) => setAgree(event.target.checked)}
            className="h-5 w-5 rounded border-neutral-300"
          />
          <span>
            我已阅读并同意
            <Link href="/user-agreement" className="mx-1 text-primary underline">
              《用户协议》
            </Link>
            与
            <Link href="/privacy-policy" className="mx-1 text-primary underline">
              《隐私政策》
            </Link>
          </span>
        </label>
        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
        <p className="mt-6 text-center uppercase tracking-wide text-neutral-400">
          Version 2.4.0 · 遇见更好的自己
        </p>
      </div>
    </main>
  );
}
