# Desktop Runtime Notes

The desktop shell can render the web UI from two sources:

- external URL (`DEVSUITE_WEB_URL`)
- bundled renderer assets (`devsuite://app/`)

Resolution order:

1. if `DEVSUITE_WEB_URL` is set, desktop loads that URL
2. if desktop is unpackaged and no env URL is set, desktop defaults to `http://localhost:5173`
3. if desktop is packaged and renderer assets exist, desktop loads `devsuite://app/`
4. otherwise desktop falls back to the bootstrap HTML page

## Useful local runs

- Run desktop against web dev server:
  - start web app (`pnpm --filter @devsuite/web dev`)
  - launch desktop with `DEVSUITE_WEB_URL=http://localhost:5173`

- Run packaged desktop with bundled renderer:
  - build web assets into `apps/desktop/renderer` as part of desktop packaging/build flow
  - launch desktop without `DEVSUITE_WEB_URL`
