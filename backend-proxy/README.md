# AI Backend Proxy (OpenAI SDK compatible)

## 说明

- 使用官方 `openai` SDK。
- 默认兼容火山引擎 Ark（OpenAI-compatible）与 OpenAI。
- 前端通过任务接口访问，支持进度、流式内容与手动中断。

## 火山引擎参考

- 官方文档（你提供）：https://www.volcengine.com/docs/82379/1541595?lang=zh
- 该代理采用 OpenAI-compatible 方式接入（`baseURL + apiKey + model`）。

## 接口

- `POST /api/ai/tasks`
- `GET /api/ai/tasks/:taskId/stream` (SSE)
- `POST /api/ai/tasks/:taskId/cancel`

事件：
- `progress`
- `partial`
- `heartbeat`
- `done`
- `error`

## 安全加固（已实现）

- 日志脱敏：
  - `apiKey` 仅打印掩码（前后少量字符）
  - `baseURL` 仅打印协议/域名/路径，不打印查询参数
  - 不打印 `messages` 原文，仅记录数量
- 透传白名单：
  - 仅接受 `provider/baseURL/apiKey/model/messages`
  - 非白名单字段会被丢弃
  - `type` 必须是受支持任务类型，否则 400
- 密钥策略：
  - 仅使用客户端请求中的 `payload.apiKey`
  - 服务端不从环境变量读取模型 key
  - 服务端不持久化 key（任务结束后仅保留脱敏日志）

## 启动

```bash
cd backend-proxy
npm install
npm start
```

或在仓库根目录：

```bash
yarn start
```

仅启动代理：

```bash
yarn start:ai-proxy
```

## 生产部署（方式1：Nginx 单端口统一入口）

目标：对外仅暴露一个端口（通常 `443`），前端静态资源与 `/api/ai/tasks` 统一走同域。

示例 Nginx 配置：

```nginx
server {
  listen 80;
  server_name your-domain.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name your-domain.com;

  ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

  root /var/www/excalidraw-app;
  index index.html;

  location / {
    try_files $uri /index.html;
  }

  location /api/ai/tasks {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
  }
}
```

## systemd 开机自启示例（Linux）

创建服务文件 `/etc/systemd/system/excalidraw-ai-proxy.service`：

```ini
[Unit]
Description=Excalidraw AI Backend Proxy
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/excalidraw/backend-proxy
Environment=NODE_ENV=production
Environment=AI_PROXY_PORT=8787
Environment=VOLCENGINE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
Environment=VOLCENGINE_MODEL=your_model
ExecStart=/usr/bin/node /opt/excalidraw/backend-proxy/server.js
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

启用并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable excalidraw-ai-proxy
sudo systemctl start excalidraw-ai-proxy
```

查看状态与日志：

```bash
sudo systemctl status excalidraw-ai-proxy
sudo journalctl -u excalidraw-ai-proxy -f
```

## 环境变量

- `AI_PROXY_PORT` 默认 `8787`
- `AI_TASK_TTL_MS` 默认 `600000`

火山引擎：
- `VOLCENGINE_BASE_URL` 默认 `https://ark.cn-beijing.volces.com/api/v3`
- `VOLCENGINE_MODEL`

OpenAI：
- `OPENAI_BASE_URL` 默认 `https://api.openai.com/v1`
- `OPENAI_MODEL` 默认 `gpt-4o-mini`

## 请求体示例

```json
{
  "type": "service_name_fill",
  "payload": {
    "provider": "volcengine",
    "baseURL": "https://ark.cn-beijing.volces.com/api/v3",
    "apiKey": "***",
    "model": "***",
    "messages": [
      { "role": "system", "content": "..." },
      { "role": "user", "content": "..." }
    ]
  }
}
```
