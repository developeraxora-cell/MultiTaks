# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Critical: read the bundled docs first

This project runs **Next.js 16.2.6 + React 19.2.4 + Tailwind CSS v4**. These versions postdate common training data and have breaking changes. Before writing or editing any Next.js code, read the relevant guide under `node_modules/next/dist/docs/` (`01-app` for App Router, `02-pages`, `03-architecture`). Do not assume APIs from older Next.js versions.

## Commands

```bash
npm run dev      # dev server at http://localhost:3000
npm run build    # production build
npm run start    # serve production build (run build first)
npm run lint     # eslint (flat config)
```

No test setup exists yet.

## Architecture

- **App Router** under `app/`. `app/layout.tsx` is the root layout (loads Geist fonts via `next/font/google`, sets `<html>`/`<body>` shell); `app/page.tsx` is the home route.
- **Tailwind v4**: configured purely in CSS via `app/globals.css` (`@import "tailwindcss"` + `@theme inline`). No `tailwind.config.js` — design tokens (colors, fonts) live in the `@theme` block. PostCSS plugin in `postcss.config.mjs`.
- **TypeScript**: strict mode, `@/*` path alias maps to repo root (e.g. `@/app/...`).
- ESLint uses flat config (`eslint.config.mjs`) extending `eslint-config-next` core-web-vitals + typescript.
