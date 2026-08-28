<div align="center">
  <h1>Art Supabase TMS Driver</h1>
  <p><strong>A driver-facing H5 and WeChat Mini Program connected to the Art Supabase TMS execution lifecycle</strong></p>
  <p>
    <a href="https://gitee.com/wangyanghub/supabase-mobile-tms-driver">Gitee</a> ·
    <a href="https://github.com/869123771/supabase-mobile-tms-driver">GitHub</a> ·
    <a href="https://gitee.com/wangyanghub/art-supabase-tms">TMS Web App</a> ·
    <a href="./README.md">简体中文</a>
  </p>
</div>

## Overview

This uni-app application gives drivers a focused mobile workflow for receiving assignments and completing transportation work. It uses Vue 3, TypeScript, Pinia, Wot Design Uni, and Supabase, and targets both H5 and WeChat Mini Programs.

![Driver workspace](screenshots/driver-home.png)

## Capabilities

- Password and WeChat phone login, driver profile, assigned tasks, and status filters.
- Assignment acceptance or cancellation, route and station details, contacts, and tracking history.
- Location/geofence check-in for loading and unloading, weight entry, photos, weighbridge tickets, and OCR assistance.
- Departure and return times, odometer readings, and vehicle-condition photos.
- Signatures, proof of delivery, execution timeline, and final completion.
- Expense reports with receipt upload, OCR draft, approval status, and synchronization with the web application.

## Local Development

Node.js 22 and pnpm are recommended.

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev:h5
```

Configure only the Supabase public URL and publishable/anon key in `.env.local`. Optional AMap variables enable map features.

```powershell
pnpm dev:mp-weixin
pnpm typecheck
pnpm build:h5
pnpm build:mp-weixin
```

The H5 build is written to `docs/`. A WeChat deployment also requires the correct AppID, allowed domains, location/media permissions, and phone authorization.

## Security

The client never contains a `service_role` or AI provider secret. Server-side contracts verify the driver identity, tenant, assignment, record status, and allowed transition for every business mutation. Location data and uploaded evidence remain business records governed by least-privilege access.
