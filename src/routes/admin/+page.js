import { env } from 'cloudflare:workers';
// This route is fully dynamic — needs env bindings at request time
export const prerender = false;
export const ssr = true;
