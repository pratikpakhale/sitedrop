**!! NOT INTENDED FOR PUBLIC USE. THIS IS MY PERSONAL PROJECT USED ONLY BY ME !!**

# sitedrop


Drop a folder or a `.zip` of static files, get a live site on a subdomain.
Files live in a Cloudflare R2 bucket; a host rewrite maps `<name>.site.pakhale.com` onto
`sites/<name>/` and streams the assets back.

## Layout

Turborepo with bun workspaces:

- `apps/web` — the Next.js app: drop page, `/sites`, API routes, the site route.
- `apps/raycast` — the Raycast extension.
- `packages/core` — the shared protocol: prepare, publish, keys, mime,
  subdomain rules. TypeScript source, no build step; the web app transpiles
  it, the CLI and the extension bundle it.
- `packages/cli` — the `sitedrop` npm package. Bundled to a single
  dependency-free file that runs on node >= 20.

`turbo dev`, `turbo build`, `turbo typecheck` from the root fan out.

Outside the workspaces, `skills/sitedrop/` is an agent skill that documents the CLI
for coding agents; `npx skills add pratikpakhale/sitedrop -g -s sitedrop` installs it.

## Setup

1. `bun install`
2. Create a private R2 bucket and an R2 API token with **Object Read & Write** on
   that bucket only. Give the bucket a CORS policy allowing `PUT` with a
   `content-type` header from any origin, since the drop page uploads to it
   directly. The presigned URL is the credential, so `*` exposes nothing.
3. Create a Vercel project with **Root Directory** `apps/web` and set
   `NEXT_PUBLIC_ROOT_DOMAIN`, `DROP_PASSWORD`, and the four `R2_*` variables from
   `apps/web/.env.example`.
4. Add both `site.pakhale.com` and `*.site.pakhale.com` as domains on the project.
   The wildcard requires the domain to use Vercel's nameservers — Vercel needs
   DNS write access to answer the ACME DNS-01 challenge for the wildcard cert.

`cp apps/web/.env.example apps/web/.env.local` for local work. Subdomains
resolve under `*.localhost` in Chrome and Safari, so `foo.localhost:3000` just
works.

## Publishing

`/` is the drop page. `/sites` manages what is already live — previews, rename,
delete. The password is checked against `/api/sites` once and then kept in
`localStorage`.

From the terminal (`npx sitedrop`, or `bun run drop` inside the repo):

```bash
sitedrop ./dist                      # folder, random subdomain
sitedrop ./dist -n my-demo           # explicit subdomain
sitedrop ./site.zip                  # a zip
sitedrop report.html chart.png       # loose files
sitedrop ./assets --force            # publish without an index.html
```

From Raycast, the **Deploy** command publishes a path, the Finder selection, or files
picked from a dialog, in that order of preference. The path may be a file, a folder, or
a zip, with `~` expanded; leave it blank and the Finder selection is used, and with
nothing selected there a file picker opens. The second argument names the subdomain.
Publishing something without an `index.html` fails with a *Publish Anyway* action on the
toast. The link is copied and the site opens in a browser. Set the endpoint and password
in the extension's preferences.

`bun run --cwd apps/raycast dev` registers the extension with Raycast and watches for
changes; it must run once, against a logged-in `ray` CLI, before Raycast knows the
extension exists. `package` rebuilds it in place, minified, without the watcher.

The endpoint and password come from `--endpoint`/`--password` or the
`SITEDROP_ENDPOINT`/`SITEDROP_PASSWORD` environment variables. Redeploying the same
subdomain replaces the site and prunes files that are no longer part of it.
Publishing to npm is tagged: push a `v*` tag and `.github/workflows/publish.yml`
builds and publishes `packages/cli` with provenance (needs the `NPM_TOKEN`
repo secret).

## Rules

- Every file type is accepted. Known extensions get a real content type; the rest
  are served as `application/octet-stream`, which browsers download rather than
  render. Nothing is ever sniffed.
- A lone `.html` file at the root is renamed to `index.html`. Two root-level
  pages are ambiguous, and a nested page would have its relative links broken by
  the move, so neither is promoted.
- Without a root `index.html` the site root 404s. Publishing that way needs an
  explicit opt-in: the checkbox in the UI, `--force` on the CLI, `force: true` on
  `/api/commit`.
- A wrapper folder (`dist/index.html`) is stripped automatically, in both folders
  and archives.
- `/about` resolves to `about.html`, then `about/index.html`, then a literal
  `about`. A root `404.html` is served for misses, with a 404 status.
- Dot-files are never uploaded, so a stray `.env` or `.git/` in a dragged folder
  cannot leak. Dot-*directories* are allowed, which keeps `.well-known/` usable.
- Reserved subdomains (`www`, `api`, …) are rejected; see
  `packages/core/src/config.ts`.

Every rule the UI enforces is the same rule the CLI enforces, because both
call `prepare()` from `@sitedrop/core`.
