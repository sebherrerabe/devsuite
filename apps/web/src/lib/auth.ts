import { createAuthClient } from 'better-auth/react';
import {
  convexClient,
  crossDomainClient,
} from '@convex-dev/better-auth/client/plugins';
import { readWebRuntimeConfig } from './runtime-config';

const runtimeConfig = readWebRuntimeConfig();

export const authClient = createAuthClient({
  baseURL: runtimeConfig.ok
    ? runtimeConfig.value.convexSiteUrl
    : 'http://localhost',
  plugins: [convexClient(), crossDomainClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
