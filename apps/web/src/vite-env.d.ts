/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string;
  readonly VITE_CONVEX_SITE_URL?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_GH_SERVICE_URL?: string;
  readonly VITE_NOTION_SERVICE_URL?: string;
  readonly VITE_WEB_PUSH_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
