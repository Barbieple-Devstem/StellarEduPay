/** @type {import('next').NextConfig} */

// External-origin allow-lists are defined in a single shared module so that
// both this file (runtime policy) and tests/csp.test.js (assertions) stay in
// sync automatically. To add a new origin, edit only cspSources.js.
const {
  CONNECT_SRC_ORIGINS,
  STYLE_SRC_ORIGINS,
  FONT_SRC_ORIGINS,
} = require('./src/config/cspSources');

const isDev = process.env.NODE_ENV !== 'production';

// Origin of the backend API (scheme://host:port) — only needed when
// NEXT_PUBLIC_API_URL is an explicit absolute cross-host override (#1578).
// With the default relative base "/api" every call is same-origin, so
// connect-src 'self' already covers it and no extra origin is added.
const API_ORIGIN = (() => {
  const base = (process.env.NEXT_PUBLIC_API_URL || '/api').trim();
  if (base.startsWith('/')) return '';
  try {
    return new URL(base).origin;
  } catch {
    return '';
  }
})();

// Content-Security-Policy for the Next.js frontend.
//
// Why here and not in the Express backend?
// The backend serves only JSON API responses — CSP directives like scriptSrc
// and styleSrc are meaningless for JSON. The frontend (Next.js) renders HTML
// and is the correct place to enforce a browser-facing CSP.
//
// CSP posture (issue #396): scripts are locked down — script-src is strict 'self'
// in production (the meaningful XSS control). React/Next.js style the DOM with
// inline styles (dynamic style props + Next's CSS injection), so style-src permits
// 'unsafe-inline' — a low-risk allowance that is the industry-standard Next.js CSP
// when per-request nonces aren't in use. Dev additionally needs script-src
// 'unsafe-eval' for HMR; production never grants it.
const scriptSrc = isDev ? "script-src 'self' 'unsafe-eval'" : "script-src 'self'";

const CSP = [
  "default-src 'self'",
  scriptSrc,
  `style-src 'self' 'unsafe-inline' ${STYLE_SRC_ORIGINS.join(' ')}`,
  "img-src 'self' data:",
  `font-src 'self' ${FONT_SRC_ORIGINS.join(' ')} data:`,
  // Allow fetch/XHR to the backend API and Stellar Horizon (testnet + mainnet).
  // The backend API origin is only included for an explicit cross-host
  // NEXT_PUBLIC_API_URL override; the default same-origin /api needs none.
  `connect-src ${["'self'", API_ORIGIN, ...CONNECT_SRC_ORIGINS].filter(Boolean).join(' ')}`,
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

// Server-side origin of the backend, used by the same-origin proxy (rewrites)
// below. Lets the browser call the API same-origin (/api/*) so cookies stay
// first-party — essential in split-host setups like GitHub Codespaces.
// Note: rewrites are resolved at `next build`, so in Docker this must be passed
// as a build arg (see frontend/Dockerfile and docker-compose.yml).
const BACKEND_ORIGIN = process.env.BACKEND_PROXY_TARGET || 'http://localhost:5000';

const nextConfig = {
  // Produces a self-contained build in .next/standalone — required for Docker
  output: 'standalone',
  // Same-origin API proxy: browser → /api/* (this origin) → backend. Keeps
  // requests first-party so HttpOnly SameSite=Strict auth cookies are sent.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${BACKEND_ORIGIN}/api/:path*` },
    ];
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
