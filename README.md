# React + TypeScript + Vite

## デバッグページ（/debug）

- 開発サーバーでは常に利用できます。
- 本番ビルドでは `VITE_ENABLE_DEBUG=true` を指定した場合のみ表示します。
- 未設定または `false` の本番環境では `/debug` もホームを表示します。
- `vercel.json` は `/debug` と `/debug/` を `/index.html` にrewriteし、直接アクセス・再読み込みに対応します。

スマートフォンで確認する場合は、Vercelのプロジェクト設定の Environment Variables に
`VITE_ENABLE_DEBUG` = `true` を追加し、対象環境（Production、必要ならPreview）を選んで再デプロイしてください。
その後 `https://<デプロイ先>/debug` を開き、センサーを有効にします。
確認を終えたら値を `false` に変更して再デプロイします。

この環境変数はビルド時に反映されるため、変更後の再デプロイが必要です。
表示の切り替え用であり、認証ではありません。有効化した環境ではURLを知っている人が利用できます。

公式資料: [VercelのVite SPA設定](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas)、
[Viteの環境変数](https://vite.dev/guide/env-and-mode)。

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
