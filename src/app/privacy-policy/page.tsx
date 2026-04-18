import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <main className="phone-shell px-6 pb-10 pt-6">
      <h1 className="text-2xl font-bold text-neutral-900">隐私政策</h1>
      <p className="mt-2 text-sm text-neutral-500">我们重视你的隐私，并将按以下规则处理你的个人信息。</p>

      <section className="mt-6 space-y-4 text-sm text-neutral-700">
        <article className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="font-semibold text-neutral-900">1. 信息收集</p>
          <p className="mt-1">我们仅收集实现基础服务所必要的信息，如邮箱、账号标识及使用记录。</p>
        </article>
        <article className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="font-semibold text-neutral-900">2. 信息使用</p>
          <p className="mt-1">收集的信息仅用于身份验证、功能实现与服务优化，不会用于非法用途。</p>
        </article>
        <article className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="font-semibold text-neutral-900">3. 信息保护</p>
          <p className="mt-1">我们将采取合理的安全措施，防止信息丢失、泄露或被未经授权访问。</p>
        </article>
      </section>

      <Link href="/login" className="mt-8 inline-flex h-11 items-center rounded-full border border-primary px-5 text-sm font-semibold text-primary">
        返回登录
      </Link>
    </main>
  );
}
