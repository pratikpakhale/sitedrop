# site drop

Drop a folder or a `.zip` of static files, get a live site on a subdomain.
Files live in Vercel Blob; a Next.js proxy maps `<name>.site.pakhale.com` onto
`sites/<name>/` and streams the assets back.

```
browser / CLI ──▶ /api/name     random subdomain (adjective-noun-token)
              ──▶ /api/upload   mints a one-pathname Blob token (password-checked)
              ──▶ Vercel Blob   client uploads directly, no 4.5MB body limit
              ──▶ /api/commit   deletes anything left over from the old deploy

visitor ──▶ <name>.site.pakhale.com ──▶ proxy.ts rewrites to /s/<name>/…
                                    ──▶ streams sites/<name>/… out of Blob
```

## Setup

1. `bun install`
2. Create a Vercel project, attach a **Blob** store (sets `BLOB_READ_WRITE_TOKEN`).
3. Set `NEXT_PUBLIC_ROOT_DOMAIN` and `DROP_PASSWORD` in the project's env vars.
4. Add both `site.pakhale.com` and `*.site.pakhale.com` as domains on the project.
   The wildcard requires the domain to use Vercel's nameservers — Vercel needs
   DNS write access to answer the ACME DNS-01 challenge for the wildcard cert.

`cp .env.example .env.local` for local work. Subdomains resolve under
`*.localhost` in Chrome and Safari, so `foo.localhost:3000` just works.

## Publishing

Web UI at the apex: drop a folder or a `.zip`, enter the password, publish.
Leave the subdomain blank to get a random one.

From the terminal:

```bash
bun run drop ./dist              # random subdomain
bun run drop ./dist my-demo      # explicit subdomain
bun run drop ./site.zip          # zip works too
```

Redeploying the same subdomain replaces the site and prunes files that are no
longer part of it.

## Rules

- A site must have `index.html` at its root. A wrapper folder (`dist/index.html`)
  is stripped automatically, in both folders and archives.
- `/about` resolves to `about.html`, then `about/index.html`. A root `404.html`
  is served for misses, with a 404 status.
- Only the extensions in `lib/mime.ts` are accepted. Anything else is reported
  as unsupported rather than silently dropped.
- Dot-files are never uploaded, so a stray `.env` or `.git/` in a dragged folder
  cannot leak. Dot-*directories* are allowed, which keeps `.well-known/` usable.
- Reserved subdomains (`www`, `api`, …) are rejected; see `lib/config.ts`.
- Responses are served with a content type derived from the file extension and
  `X-Content-Type-Options: nosniff` — never from the stored blob metadata.

## Caching

Assets go out with `s-maxage=60, stale-while-revalidate=86400`, so Vercel's CDN
absorbs repeat traffic while a redeploy becomes visible within a minute. Raise
`CACHE_CONTROL` in `app/s/[subdomain]/[[...path]]/route.ts` if you fingerprint
your assets and want them cached indefinitely.

## A note on cookies

`a.site.pakhale.com` can set a cookie scoped to `Domain=pakhale.com`, because
`pakhale.com` is not on the Public Suffix List. If you ever host something
authenticated on `pakhale.com`, JavaScript in a dropped site can clobber its
cookies. That is fine while you are the only person publishing. If you open this
up to others, move it to a domain you do not otherwise depend on, and prefix
real cookies with `__Host-`.
