// /tracking is server-rendered: it reads the Cf-Access-Jwt-Assertion header
// and D1, neither of which are available at prerender time.
export const prerender = false;
