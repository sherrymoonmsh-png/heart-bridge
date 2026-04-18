"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setAuthedPhone } from "@/lib/auth-store";
import { toChineseErrorMessage } from "@/lib/error-message";
import { ensureUser, syncAuthUserRecords } from "@/lib/user-service";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

type WechatExchangePayload = {
  phone: string;
  nickname?: string;
};

export default function WechatCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const completeWechatLogin = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const deniedReason = params.get("error");
      if (deniedReason) {
        setError("你已取消微信授权，请重新尝试。");
        return;
      }
      if (!code) {
        setError("微信授权失败：缺少 code 参数。");
        return;
      }

      try {
        const response = await fetch(
          `/api/auth/wechat/exchange?code=${encodeURIComponent(code)}${
            state ? `&state=${encodeURIComponent(state)}` : ""
          }`,
        );
        const payload = (await response.json()) as WechatExchangePayload & { message?: string };
        if (!response.ok) {
          if (!cancelled) setError(toChineseErrorMessage(payload.message, "微信登录失败，请稍后重试。"));
          return;
        }

        await ensureUser(payload.phone, payload.nickname);
        if (cancelled) return;
        let uid = "";
        if (hasSupabaseConfig && supabase) {
          const { data: s } = await supabase.auth.getSession();
          uid = s.session?.user?.id ?? "";
        }
        setAuthedPhone(payload.phone, uid || undefined);
        if (uid) await syncAuthUserRecords(payload.phone);
        router.replace("/community");
      } catch {
        if (!cancelled) setError("微信登录服务异常，请稍后重试。");
      }
    };

    completeWechatLogin();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="phone-shell px-6 pt-16">
      <h1 className="text-center text-3xl font-bold text-neutral-900">正在完成微信登录</h1>
      <p className="mt-3 text-center text-sm text-neutral-500">
        请稍候，我们正在验证你的授权并创建账号信息。
      </p>
      {error ? (
        <div className="mt-8 rounded-2xl bg-white p-4 text-sm text-red-500 shadow-sm">
          <p>{error}</p>
          <Link
            href="/login"
            className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-neutral-300 px-4 text-neutral-700"
          >
            返回登录页
          </Link>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl bg-white p-4 text-sm text-neutral-500 shadow-sm">正在处理授权...</div>
      )}
    </main>
  );
}
