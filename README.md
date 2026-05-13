# Excalidraw (AI Enhanced Fork) / AI 增强版

<p align="center">
  <img src="https://excalidraw.nyc3.cdn.digitaloceanspaces.com/github/excalidraw_github_cover_2.png" alt="Excalidraw" width="100%" />
</p>

Forked from [Excalidraw](https://excalidraw.com) and extended with local-first AI workflows.  
基于 [Excalidraw](https://excalidraw.com) 的分支，并加入本地优先的 AI 工作流能力。

## What This Repo Includes / 本仓库包含内容

- Excalidraw core editor + app shell (monorepo).  
  Excalidraw 核心编辑器与应用壳（monorepo）。
- AI Architecture Assistant for architecture analysis and optimization suggestions.  
  用于架构分析与优化建议的 AI 架构助手。
- Text-to-Diagram flow (Mermaid-oriented) with shared AI settings.  
  统一 AI 配置的文字生成图表（以 Mermaid 为主）。

Design notes for architecture assistant: `AI_ARCHITECTURE_ASSISTANT.md`

## Verified Runtime Requirements / 运行环境要求（与代码一致）

- Node.js: `>=20.19.0`
- Yarn: `1.22.x` (workspace uses `yarn@1.22.22`)

## Quick Start / 快速开始

1. Clone and enter repo / 克隆并进入目录

```bash
git clone https://github.com/lhyliu/excalidraw.git
cd excalidraw
```

2. Install dependencies / 安装依赖

```bash
yarn install
```

3. Start dev server / 启动开发环境

```bash
npm start
```
This starts frontend and AI proxy together.

4. Open app / 打开应用

- Default URL: `http://localhost:3001` (from `.env.development` -> `VITE_APP_PORT=3001`)
- Change port by updating `VITE_APP_PORT`.

## AI Setup (Actual UI Behavior) / AI 配置（基于当前实现）

Open: **Main Menu** -> **AI Settings**

Fields:

- `API URL`
- `API Key`
- `Model` (optional, defaults to `gpt-4o-mini` if empty)

Buttons:

- `测试连接` (test connection)
- `保存`

Notes:

- API settings are stored in browser `localStorage` under `excalidraw_ai_settings`.
- `API URL` supports:
  - base URL (auto-completed to `/v1/chat/completions`)
  - versioned base URL (auto-appended with `/chat/completions`)
  - full endpoint URL (used as-is)
- Compatible with OpenAI-style streaming chat endpoints; `/responses` style is also supported by current service logic.

Example:

- API URL: `https://api.openai.com/v1`
- API Key: `sk-...`
- Model: `gpt-4o-mini`

## Common Scripts / 常用脚本

- `npm start` / `yarn start`  
  Run frontend + AI proxy together.
- `yarn start:frontend`  
  Run frontend only (`excalidraw-app` via Vite).
- `yarn build`  
  Build production app.
- `yarn start:production`  
  Build then serve production output.
- `yarn test`  
  Run Vitest test suite.
- `yarn test:all`  
  Run typecheck + guard + lint + prettier check + tests.
- `yarn test:architecture`  
  Run architecture-related guard/regression scripts.
- `yarn fix`  
  Run formatting and ESLint autofix.

## Repository Layout / 目录结构

- `excalidraw-app/`: app shell, Vite config, integration layer
- `packages/excalidraw/`: main editor package (UI/components/services)
- `packages/common/`, `packages/element/`, `packages/math/`, `packages/utils/`: shared workspace packages
- `examples/`: integration examples
- `dev-docs/`: documentation site
- `scripts/`: build/release/test utility scripts

## Developer Contribution Workflow / 开发者贡献流程

1. Create a branch / 创建分支

```bash
git checkout -b feat/<short-topic>
```

Recommended prefixes: `feat/`, `fix/`, `refactor/`, `docs/`, `test/`.

2. Develop and verify locally / 本地开发与验证

Minimal checks before commit:

```bash
yarn test
```

Recommended full checks before PR:

```bash
yarn test:all
```

If your change touches architecture-assistant logic, also run:

```bash
yarn test:architecture
```

3. Format/lint fixes if needed / 如有需要执行格式化与修复

```bash
yarn fix
```

4. Commit / 提交代码

Suggested commit style:

- `feat(ai): add xxx`
- `fix(app): resolve xxx`
- `docs(readme): update xxx`

5. Open PR / 发起 PR

PR checklist:

- Describe what changed and why.
- List affected modules/packages.
- Include screenshots/GIFs for UI changes.
- Include test commands and results.
- Mention breaking changes or migration notes if any.

## Privacy / 隐私说明

- API keys are saved only in browser local storage.
- No API key is stored in repository files by default.

## Upstream Excalidraw / 原版项目

- Website: https://excalidraw.com
- Docs: https://docs.excalidraw.com
- Upstream repo: https://github.com/excalidraw/excalidraw

License: MIT

## AI Architecture Generation (Current)

The CSV-to-architecture flow now uses a page-oriented path:

- `/ai/csv-fix`: import CSV, confirm mapping, fix issues in table
- `/ai/draft-confirm`: scope/layer editing, diagram preview, insert to canvas

AI execution is task-based (SSE):

- `POST /api/ai/tasks`
- `GET /api/ai/tasks/:taskId/stream`
- `POST /api/ai/tasks/:taskId/cancel`

Frontend client:

- `packages/excalidraw/services/aiTaskService.ts`

### Optional backend proxy (OpenAI SDK compatible)

A reference proxy is included in `backend-proxy/`.
It uses official `openai` SDK and supports OpenAI-compatible providers such as Volcengine Ark by passing `baseURL + apiKey + model`.
In current secure-forwarding mode, model key comes from client request and is not stored server-side.

Run:

```bash
yarn start:ai-proxy
```

See: `backend-proxy/README.md`

### Production Deployment (Single Port via Nginx)

Use one public port (typically `443`) and reverse proxy both static frontend and AI task APIs.

Example:

```nginx
server {
  listen 80;
  server_name your-domain.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name your-domain.com;

  # Configure your cert paths
  ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

  # Frontend static files (build output)
  root /var/www/excalidraw-app;
  index index.html;

  location / {
    try_files $uri /index.html;
  }

  # AI task API -> backend-proxy
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

Recommended process:

1. Build frontend and deploy static files to `root`.
2. Run `backend-proxy` as a system service on `127.0.0.1:8787`.
3. Expose only Nginx (`443`) to public network.
