# ADAO Jiuheng Portfolio

基于 Next.js App Router 的个人作品集与技术博客，包含公开作品页、文章详情、PostgreSQL 内容存储和单管理员写作台。

## 本地开发

要求 Node.js 22.13+、pnpm 和本机 Chrome。项目统一使用 pnpm，仓库只保留 `pnpm-lock.yaml`。

首次启动时，在两个终端分别运行：

```bash
pnpm install --frozen-lockfile
pnpm db:local
```

```bash
pnpm dev
```

网站默认运行在 <http://localhost:3000>。管理员首次设置使用：

```bash
pnpm admin:setup
```

本地数据库和上传内容保存在 `data/`，环境配置保存在 `.env.local`；两者都不会提交到 Git。

## 目录结构

```text
app/                  Next.js 路由、页面、布局和 API Route Handlers
components/           跨页面组件与 UI 基础组件
lib/                  领域逻辑、服务端能力和共享工具
db/                   Drizzle schema 与数据库迁移
public/               可公开访问的静态资源
scripts/
  admin/               管理员账号运维脚本
  assets/              设计素材生成与后处理脚本
  db/                  本地数据库辅助脚本
tests/
  unit/                无外部服务依赖的快速测试
  e2e/                 浏览器、API 和完整用户流程验收
  run-local.mjs        隔离数据库与测试服务编排器
docs/                  开发、设计和验收文档
deploy/                systemd、Nginx/Caddy 等部署模板
```

`app/` 只承担路由边界；可复用业务逻辑放在 `lib/`，跨路由组件放在 `components/`。测试不再混放在 `scripts/` 中，避免把测试误认为数据库或运维工具。

## 常用命令

```bash
pnpm typecheck                 # TypeScript 静态检查
pnpm lint                      # Oxlint
pnpm format                    # Oxfmt
pnpm format:check              # 只检查格式，不写入文件
pnpm test                      # 快速单元测试
pnpm build                     # Next.js 生产构建
pnpm test:e2e:local            # 账号与博客完整端到端测试
pnpm test:e2e:auth             # 仅账号安全流程
pnpm test:e2e:blog             # 仅博客流程
```

端到端测试要求先完成生产构建，并保持 `pnpm db:local` 运行。测试编排器会创建 `jiuheng_test_*` 临时数据库和临时上传目录，结束后自动清理，不修改本地正式管理员、文章或图片。

ABOUT 动画验收需要另行启动生产服务，具体命令和验收资料见 [docs/about-growth/README.md](docs/about-growth/README.md)。博客写作台配置见 [docs/local-blog-setup.md](docs/local-blog-setup.md)，首页设计决策见 [docs/home-redesign.md](docs/home-redesign.md)。

## 数据与生成目录

以下内容不是源码，已由 Git 忽略：

- `.next/`、`dist/`、`.vinext/`、`.wrangler/`：构建或部署缓存。
- `outputs/`：测试截图和临时报告。
- `data/`：本地 PostgreSQL 数据和用户上传内容，清理仓库时不要随意删除。
- `.env.local`：本地敏感配置，不要提交或分享。
