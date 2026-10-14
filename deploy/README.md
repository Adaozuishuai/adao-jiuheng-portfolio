# Ubuntu 24.04 部署骨架

安装 Node.js 22、pnpm、PostgreSQL 16 和 Caddy 后，创建非 root 用户 `jiuheng`。应用目录建议为 `/srv/jiuheng/app`，上传目录为 `/srv/jiuheng/uploads`，环境文件为 `/etc/jiuheng/jiuheng.env`。

数据库角色只需允许从本机连接。建议让 PostgreSQL 的 `listen_addresses` 保持为 `localhost`，并在 `pg_hba.conf` 中只允许本站角色访问本站数据库。

首次部署顺序：

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate
sudo install -m 0644 deploy/jiuheng.service.example /etc/systemd/system/jiuheng.service
sudo systemctl daemon-reload
sudo systemctl enable --now jiuheng
```

将 Caddy 示例中的域名换成真实域名，再安装到 `/etc/caddy/Caddyfile`。Node.js 只监听 `127.0.0.1:3000`，HTTPS 流量由 Caddy 转发。环境文件权限建议设为 `0640`，所有者为 `root:jiuheng`；上传目录所有者设为 `jiuheng:jiuheng`，权限 `0750`。

更新时先备份 PostgreSQL 和上传目录，再安装依赖、构建、运行迁移并重启服务。不要把 `.env.local` 或 `/etc/jiuheng/jiuheng.env` 放进 Git。

## 公共 AI 聊天

本地先运行 `pnpm db:local`、`pnpm db:migrate`、`pnpm dev`，再打开 `http://localhost:3000`。测试使用独立临时数据库和模拟 GLM：`pnpm build && pnpm test:e2e:chat`，不会消耗真实模型额度。

生产环境的 `/etc/jiuheng/jiuheng.env` 需要单独设置 `ZHIPU_API_KEY`、`ZHIPU_MODEL`、`CHAT_HOURLY_LIMIT`（默认 20）、`CHAT_DAILY_LIMIT`（默认 200）和 `CHAT_TRUST_PROXY=true`。只有当 Node 服务仅监听回环地址且前置代理覆盖 `X-Real-IP` 时才开启代理信任；随附的 Nginx 和 Caddy 示例已设置该请求头；不要直接暴露 Node 端口。可另设 `CHAT_HASH_SECRET` 作为匿名标识的哈希密钥。环境变量改动后重启应用。运行数据库迁移后再切换新版本。

Nginx 的 `/api/chat` 位置需要 `proxy_buffering off` 和至少 90 秒的读取超时，以便逐步显示回答。额度计数和短期会话锁存在 PostgreSQL；消息内容只在浏览器当前标签页的 `sessionStorage`。公开检索只查询已发布且未删除的文章，作品上下文限于代码中公开的名称、分类、年份及概念图说明。生成式回答的质量需人工抽查；来源链接代表检索到的页面，不证明模型每句都得到该页支持。
