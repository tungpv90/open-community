# Cộng Đồng Việt

Diễn đàn kiểu Flarum, chạy trên OpenAI Sites và tích hợp Supabase Auth/PostgREST.

## Kết nối Supabase

1. Chạy `supabase-schema.sql` trong Supabase SQL Editor.
2. Cấu hình hai biến môi trường Site: `SUPABASE_URL` và `SUPABASE_ANON_KEY`.
3. Triển khai lại phiên bản đã lưu để áp dụng environment revision.

Khi chưa có hai biến này, website chạy ở chế độ demo bằng localStorage.

Use this starter for a static microsite, click counter, or simple internal UI whose state is browser-scoped. It has no dependencies and needs no install.

Edit `worker/index.js`, then publish through the Sites hosting workflow with this starter's build and validation in `commands`.

The build copies only `worker/index.js` and `.openai/hosting.json`. Do not add standalone asset files. Embed any essential raster bytes in `worker/index.js` and serve or reference them as a data URL.

Pass these argument arrays as `commands`:

```json
[
  ["bash", "scripts/build.sh"],
  ["node", "scripts/validate-artifact.mjs"]
]
```

The deterministic build produces:

```text
dist/
├── .openai/
│   └── hosting.json
└── server/
    └── index.js
```

`dist/server/index.js` is an ES module with a default export containing `fetch(request, env, ctx)`. Edit `worker/index.js`, not the generated file under `dist/`.
