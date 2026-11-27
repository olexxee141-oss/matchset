import { defineConfig } from '@neon/config/v1';

// Postgres is provisioned by Neon for every project. MatchSet only needs
// that built-in service; no Auth, Functions, buckets, or Data API are needed.
export default defineConfig({});
