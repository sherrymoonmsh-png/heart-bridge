# 心灵桥（MVP）

基于 Next.js + TailwindCSS 的移动端风格心理疗愈社区原型。

## 已完成

- `/login` 登录页
- `/community` 社区页
- `/profile` 我的页
- 登录交互（手机号校验、验证码倒计时、协议勾选）
- 登录态守卫（未登录自动回到登录页）
- Supabase 数据读取（未配置时自动使用本地 mock 数据）
- 社区闭环（发帖、点赞、评论）
- 退出登录流程

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`，首页会自动跳转到登录页。

## Supabase 接入

1. 复制环境变量文件：

```bash
copy .env.example .env.local
```

2. 在 `.env.local` 中填写：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. 建议准备这些表（字段名需与代码一致）：

- `groups`: `id`, `title`, `desc`
- `posts`: `id`, `title`, `content`, `author_name`, `author_phone`, `like_count`, `comment_count`, `created_at`
- `post_comments`: `id`, `post_id`, `content`, `author_name`, `author_phone`, `created_at`
- `post_likes`: `id`, `post_id`, `user_phone`, `created_at`
- `users`: `phone`, `name`, `streak_days`, `logs_count`, `groups_count`, `harvest_count`

4. 直接在 Supabase SQL Editor 执行：

- `supabase/schema.sql`

> 注意：当前 `schema.sql` 为了快速落地，使用了开放策略（便于开发联调）。上线前请按真实登录用户体系收紧 RLS 策略。
