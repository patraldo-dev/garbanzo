// The home page must be server-rendered (not prerendered to a static asset)
// so that src/hooks.server.js fires and records the page view. With
// adapter-cloudflare, prerendered pages are served straight from the ASSETS
// binding and bypass SvelteKit's request pipeline entirely.
export const prerender = false;
