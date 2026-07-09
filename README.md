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

`/` is the drop page: drop a folder or a `.zip`, publish. `/sites` manages what
is already live — live previews, rename, delete. The password is checked against
`/api/sites` once and then kept in `localStorage`.

From the terminal:

```bash
bun run drop ./dist              # random subdomain
bun run drop ./dist my-demo      # explicit subdomain
bun run drop ./site.zip          # zip works too
bun run drop ./assets --force    # publish without an index.html
```

Redeploying the same subdomain replaces the site and prunes files that are no
longer part of it.

## Rules

- Every file type is accepted. Known extensions get a real content type; the rest
  are served as `application/octet-stream`, which browsers download rather than
  render. Nothing is ever sniffed.
- A lone `.html` file at the root is renamed to `index.html`. Two root-level
  pages are ambiguous, and a nested page would have its relative links broken by
  the move, so neither is promoted.
- Without a root `index.html` the site root 404s. Publishing that way needs an
  explicit opt-in: the checkbox in the UI, `--force` on the CLI, `force: true` on
  `/api/commit`. This mirrors the `-f`/`--force` convention in [clig.dev].
- A wrapper folder (`dist/index.html`) is stripped automatically, in both folders
  and archives.
- `/about` resolves to `about.html`, then `about/index.html`, then a literal
  `about`. A root `404.html` is served for misses, with a 404 status.
- Dot-files are never uploaded, so a stray `.env` or `.git/` in a dragged folder
  cannot leak. Dot-*directories* are allowed, which keeps `.well-known/` usable.
- Reserved subdomains (`www`, `api`, …) are rejected; see `lib/config.ts`.

[clig.dev]: https://clig.dev/

## Renaming

Blob has no directory move, so `PATCH /api/sites/<name>` renames every key under
the prefix, eight at a time. `rename` copies before deleting and leaves the
source alone if the copy fails, so an error mid-flight strands the site across
both prefixes rather than losing files. Re-running the rename finishes the job.

## Previews

`/sites` frames each live site in a sandboxed iframe rendered at 4× the card and
scaled down, so the page sees a desktop viewport. The sandbox withholds
`allow-same-origin`, which drops the frame into an opaque origin with no access
to cookies or storage. The frame URL carries the site's `updatedAt` as a query
param so a republish busts the CDN copy.

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
