import { NextResponse } from "next/server";
import { toChineseErrorMessage } from "@/lib/error-message";

type WechatExchangeResponse = {
  phone?: string;
  openId?: string;
  unionId?: string;
  nickname?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const exchangeEndpoint = process.env.WECHAT_AUTH_EXCHANGE_URL;

  if (!code) {
    return NextResponse.json({ message: "缺少微信授权 code。" }, { status: 400 });
  }
  if (!exchangeEndpoint) {
    return NextResponse.json({ message: "服务端未配置 WECHAT_AUTH_EXCHANGE_URL。" }, { status: 500 });
  }

  try {
    const upstream = await fetch(exchangeEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
      cache: "no-store",
    });

    if (!upstream.ok) {
      const reason = await upstream.text();
      return NextResponse.json(
        { message: toChineseErrorMessage(reason, "微信授权码交换失败。") },
        { status: upstream.status },
      );
    }

    const data = (await upstream.json()) as WechatExchangeResponse;
    const openIdLike = data.openId || data.unionId || "";
    const normalizedPhone = data.phone?.trim();
    const phone = normalizedPhone || (openIdLike ? `wx_${openIdLike.slice(-12)}` : "");
    if (!phone) {
      return NextResponse.json({ message: "交换成功但未返回可用身份标识。" }, { status: 422 });
    }

    return NextResponse.json({
      phone,
      nickname: data.nickname || "微信用户",
      openId: data.openId || null,
      unionId: data.unionId || null,
    });
  } catch {
    return NextResponse.json({ message: "微信登录服务暂不可用，请稍后重试。" }, { status: 502 });
  }
}
