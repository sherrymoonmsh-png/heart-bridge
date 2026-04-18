const RULES: Array<{ match: RegExp; text: string }> = [
  { match: /email rate limit exceeded/i, text: "操作过于频繁，请稍后再试。" },
  { match: /rate limit/i, text: "请求过于频繁，请稍后再试。" },
  { match: /invalid login credentials/i, text: "邮箱或密码错误，请重新输入。" },
  { match: /invalid credentials/i, text: "账号信息不正确，请检查后重试。" },
  { match: /email not confirmed/i, text: "邮箱尚未验证，请先完成邮箱验证。" },
  { match: /user already registered/i, text: "该邮箱已注册，请直接登录。" },
  { match: /password should be at least/i, text: "密码长度不足，请至少输入 6 位。" },
  { match: /duplicate key value/i, text: "数据已存在，请勿重复提交。" },
  { match: /jwt/i, text: "登录状态已失效，请重新登录。" },
  { match: /token/i, text: "登录凭证无效，请重新登录。" },
  { match: /network/i, text: "网络异常，请检查网络后重试。" },
  { match: /failed to fetch/i, text: "网络请求失败，请稍后重试。" },
  { match: /permission denied/i, text: "权限不足，当前操作不可用。" },
  { match: /not found/i, text: "未找到对应数据。" },
  { match: /already exists/i, text: "数据已存在，请勿重复操作。" },
];

export function toChineseErrorMessage(input: unknown, fallback = "操作失败，请稍后重试。") {
  const raw = typeof input === "string" ? input : input instanceof Error ? input.message : "";
  if (!raw) return fallback;
  const normalized = raw.trim();
  const hit = RULES.find((rule) => rule.match.test(normalized));
  return hit ? hit.text : fallback;
}
