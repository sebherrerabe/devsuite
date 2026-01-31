import { defineApp } from 'convex/server';
import betterAuth from './betterAuth/convex.config';

// Type assertion needed for composite TypeScript builds
// The app object has complex inferred types from Convex's component system
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const app: any = defineApp();
app.use(betterAuth);

export default app;
