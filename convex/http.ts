import { httpRouter } from 'convex/server';
import { authComponent, createAuth } from './betterAuth/auth';

const http = httpRouter();

// CORS handling is required for client-side frameworks (e.g. React SPA).
authComponent.registerRoutes(http, createAuth, { cors: true });

export default http;
