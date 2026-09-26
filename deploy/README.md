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
