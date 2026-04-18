import Link from "next/link";

export default function UserAgreementPage() {
  return (
    <main className="phone-shell px-6 pb-10 pt-6">
      <h1 className="text-2xl font-bold text-neutral-900">用户协议</h1>
      <p className="mt-2 text-sm text-neutral-500">欢迎使用心灵桥。在使用前，请阅读并同意以下条款。</p>

      <section className="mt-6 space-y-4 text-sm text-neutral-700">
        <article className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="font-semibold text-neutral-900">1. 服务说明</p>
          <p className="mt-1">心灵桥为用户提供心理支持相关的信息展示、记录与互动功能。</p>
        </article>
        <article className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="font-semibold text-neutral-900">2. 账号规范</p>
          <p className="mt-1">用户需妥善保管账号信息，不得将账号用于违法违规用途。</p>
        </article>
        <article className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="font-semibold text-neutral-900">3. 内容规范</p>
          <p className="mt-1">请发布真实、友善、合法的内容，不得发布侵犯他人权益的信息。</p>
        </article>
      </section>

      <Link href="/login" className="mt-8 inline-flex h-11 items-center rounded-full border border-primary px-5 text-sm font-semibold text-primary">
        返回登录
      </Link>
    </main>
  );
}
