# Browser checks

Playwright scripts that load the built app in a real browser against a stubbed API. They need no credentials and no network.

`sections-pass.cjs` opens every section path with a fake admin session, with the API empty and with it down. Its "BOUNDARY" flag matches the sections' own designed error card ("Something went wrong ... Try again"), so a flag in API-down mode is the dashboard handling the failure, not a crash; real crashes show up as page errors, overflow or a login bounce. `business-logins.cjs` drives the Business logins screen.

## Run

```
npm run build && npx vite preview --port <port> &
node scripts/browser-checks/<script>.cjs
```

Each script's header gives its default port and options (`BASE_URL`, `OUT_DIR` for screenshots, `PW_CHROMIUM` to point at an installed Chromium if this repo pins its own Playwright). Exit code is non-zero if a check fails.
