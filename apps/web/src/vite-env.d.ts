/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GH_SERVICE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
