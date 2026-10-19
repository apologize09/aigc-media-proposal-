# AIGC 传媒提案系统

内部 Web 系统。产品规则见 [docs/planning/README.md](docs/planning/README.md)。模块拆分见 [docs/planning/12-modules.md](docs/planning/12-modules.md)。

当前已实现基础框架、**A 账号与权限**、**B 客户与项目**。提案编辑、豆包调用、报价和任务尚未实现。

## 环境

已确认的规划使用 Node.js 24 LTS。本仓库在 Node.js 22 上安装、构建并通过测试，`package.json` 要求 Node.js 22 或更高。数据库为 PostgreSQL 16。

复制环境变量示例后再填写本地值：

```bash
cp .env.example .env
```

至少填写：

- `DATABASE_URL`：PostgreSQL 连接串
- `AUTH_SECRET`：至少 16 个字符，用于启用认证

首个管理员（仅库为空时）：

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`（至少 10 个字符）
- 可选 `SEED_ADMIN_NAME`

`.env` 已从 Git 忽略。不要把真实密钥写进仓库。`.env.example` 里的密钥和上传上限保持为空。

## 安装

```bash
npm install
npx prisma migrate deploy
npm run db:seed
```

## 启动

```bash
npm run dev
```

开发服务器默认在 http://localhost:3000 。

- 健康检查：http://localhost:3000/api/health
- 登录：http://localhost:3000/login
- 客户：http://localhost:3000/clients
- 项目：http://localhost:3000/projects
- 账号管理（需管理员）：http://localhost:3000/users

队列进程目前只检查配置，不连接外部服务：

```bash
npm run worker
```

依赖服务也可用 Compose：

```bash
docker compose up
```

Nginx 示例监听 8080。仓库里没有 TLS 证书。`UPLOAD_MAX_BYTES` 未配置时，Nginx 把请求体上限设为 1 字节。

## 检查与测试

```bash
npm run lint
npm run typecheck
npm run test
npm run format:check
```

认证流程测试需要可用的 `DATABASE_URL`。未配置时该组用例会跳过。

`format:check` 不改写 `docs/planning/`。

## 构建

```bash
npm run build
npm run start
```

## 账号与权限说明

- 无公开注册。管理员开通本地口令账号。
- 职责：`admin` / `editor` / `reviewer`，可多选。财务可见是独立开关。
- 会话存在数据库。`AUTH_SESSION_TTL_HOURS` 为空时不按时间失效；退出或停用后失效。
- `AUTH_LOCKOUT_THRESHOLD` 为空时不锁定；配置后失败次数达到阈值即拒绝登录，管理员将账号设为启用可清零计数。
- 客户路径 `/p/*` 不使用内部会话。

## 客户与项目说明

- 管理员与方案编辑可建客户、建项目、改需求正文。
- 非管理员只能看见自己参与的项目；管理员可见全部。
- 创建项目时会把创建人和负责人自动加入成员。负责人不可移除。
- 归档只写入 `archived_at`，不删除数据，也不自动撤销客户链接。
- 客户内部备注仅管理员与方案编辑可见。
