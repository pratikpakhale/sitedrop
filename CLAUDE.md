# sitedrop

Turborepo with bun workspaces. Password-gated static-site drops: files land in a
Cloudflare R2 bucket, a Next.js route serves them at `<subdomain>.site.pakhale.com`.

```
apps/web        Next.js app: drop page, /sites, API routes, site route
apps/raycast    Raycast extension (not published to the Store)
packages/core   shared protocol; raw TS, no build step
packages/cli    the `sitedrop` npm package
skills/         the agent skill for driving the CLI (not a workspace)
```

`bun run dev | build | typecheck` fan out through turbo. `bun run drop` runs the CLI
from source.

## skills/

`skills/sitedrop/SKILL.md` teaches a coding agent to publish with the CLI. It lives here
rather than in a dotfiles repo because it documents `packages/cli`'s interface — flags,
the `prepare.ts` rules, the `Live at` output line — so a CLI change and its skill update
are one commit. Consumers install it straight from this repo:

```bash
npx skills add pratikpakhale/sitedrop -g -s sitedrop
```

Keep it free of machine-specific values: it names `SITEDROP_ENDPOINT`/`SITEDROP_PASSWORD`
but must never carry them.

## packages/core

Runtime-agnostic on purpose. Every consumer imports subpaths (`@sitedrop/core/prepare`);
the exports map is `"./*": "./src/*.ts"`, so a new module needs no manifest change. The
web app transpiles core via `transpilePackages`; the CLI and the extension bundle it.

`publish.ts` needs only the endpoint and the shared password, and uses plain `fetch`.
`POST /api/upload` returns one presigned PUT URL per file, with the content type and
exact byte length signed in, and clients upload straight to R2. No client ever holds R2
credentials.

`disk.ts` is the only module importing `node:*`. The CLI and the extension use it; the
web app must not, or Node builtins reach the browser bundle. Keep new browser-hostile
code confined to it.

The publish rules (dotfiles dropped, lone root `.html` promoted to `index.html`, wrapper
directory stripped, `index.html` required unless forced) live in `prepare.ts` and apply
identically to all three clients. Fix them there, never in a client.

## packages/cli

Bundled by `bun build` into one dependency-free `dist/index.js` for node >= 20.
Credentials come from `--endpoint`/`--password` or `SITEDROP_ENDPOINT`/`SITEDROP_PASSWORD`.
Note the server's own variable is `DROP_PASSWORD` — a deliberately separate namespace.

### Cutting a release

```bash
bun run release patch|minor|major   # bumps packages/cli, commits, tags
# open a PR, merge it with a merge commit, then:
git push origin vX.Y.Z              # the tag is what triggers the workflow
```

`.github/workflows/publish.yml` fires on `v*` tags only, checks the tag matches the CLI's
version, builds, and runs `npm publish`. Pushing `main` alone publishes nothing. The
hook on `main` blocks direct pushes, so a release goes through a PR merged with a merge
commit, never a squash, so the tagged commit lands on `main`. Push the tag after the
merge.

Publishing uses npm trusted publishing (OIDC), with no token in the repo. npm trusts
`publish.yml` in `pratikpakhale/sitedrop`, which was set up once with
`npm trust github sitedrop --file publish.yml --repo pratikpakhale/sitedrop --allow-publish`.
The old `NPM_TOKEN` secret expired between releases and failed with a misleading `E404`
on `PUT`; long-lived npm write tokens no longer exist, which is why it is gone.

Things that break the publish:

- `repository.url` in `packages/cli/package.json` must match the GitHub repo the workflow
  runs in. Renaming the repo or the workflow file silently invalidates it, and so does
  the trust relationship, which must then be revoked and recreated.
- Trusted publishing needs npm >= 11.5.1, so the workflow pins node 24.

## apps/web

Vercel project with **Root Directory** `apps/web`, linked to the GitHub repo: pushing
`main` deploys production, other branches get previews. Needs `NEXT_PUBLIC_ROOT_DOMAIN`,
`DROP_PASSWORD`, and `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET`.
Both `site.pakhale.com` and `*.site.pakhale.com` are attached; the wildcard cert requires
Vercel's nameservers.

The R2 bucket is private. An R2 custom domain would need the zone on Cloudflare, which
the wildcard cert rules out, and `r2.dev` is rate-limited. So the site route reads each
object through a presigned GET. The bucket's CORS policy allows `PUT` with `content-type` from
`*`. Without it, browser uploads fail while the CLI keeps working. The wildcard is
deliberate: the presigned URL is the credential, and pinning origins only breaks preview
deployments and local ports.

Serving is built so a cache hit never runs code:

- Tenant hosts reach `app/s/[subdomain]` through a `has: host` rewrite in
  `next.config.ts`, not middleware. Vercel resolves static rewrites in its CDN, but
  `proxy.ts` would run before the cache on every request.
- Every site response, 404s included, carries `Vercel-CDN-Cache-Control` for a year and a
  `site:<name>` cache tag. Each write (`/api/commit`, rename, delete) purges its tags
  through `lib/cdn.ts`. A new write path that skips the purge serves stale files for a
  year. Purges take about half a second to land, so a request fired straight after a
  publish can still get the old copy; tests must poll rather than expect it instantly.
  The cache key includes the deployment, so every deploy starts all sites cold.
- The route refuses any request whose `Host` is not the tenant itself, so `/s/<name>` on
  the apex, where the publish password lives, cannot run a tenant's scripts.

`apps/web/lib/` is web-only (auth, storage, host parsing, browser file reading). Shared rules
belong in core. Auth is a `Bearer <DROP_PASSWORD>` header compared with `timingSafeEqual`.

`apps/web/.env.local` is a Vercel CLI pull and drifts; re-pull rather than trusting it.

## apps/raycast

One `Deploy` command, `mode: view`, with `path` and `subdomain` arguments. It resolves its
source in order: the path argument, then `getSelectedFinderItems()`, then a file picker.
Raycast renders argument fields before the command runs, so they cannot be shown
conditionally. `src/lib/deploy.ts` holds the whole routine; the commands are thin.

The `ray` CLI is at `node_modules/.bin/ray` (not on PATH). It targets **Raycast Beta**
(`RAY_Target` defaults to `x`, config in `~/.config/raycast-x`); set `RAY_Target=` for the
stable app.

**Only `ray develop` registers the extension with Raycast, and only when the CLI is logged
in (`ray login`).** Without a session it still builds, still exits 0, still prints
`ready - built extension successfully`, and Raycast never sees the extension. Dropping
files into the extensions directory does nothing; Raycast does not scan it.

- `bun run --cwd apps/raycast dev` — register + watch. Run once after cloning.
- `bun run --cwd apps/raycast package` — minified rebuild in place, no watcher.
- `bun run --cwd apps/raycast build` — build to a local `dist/`, for turbo.

`build` passes `--skip-types` because `ray` shells out to a hardcoded
`./node_modules/.bin/tsc` that bun's hoisting never creates; turbo's `typecheck` task
covers it instead.

`ray lint` fails on `author`, which is a GitHub handle rather than a Raycast username.
That is intentional and only matters for Store publishing. Nothing runs lint.

The extension's package is named `sitedrop-raycast`; bun workspaces reject a second
package called `sitedrop`.

Icons must have a real alpha channel. `qlmanage` composites SVGs onto opaque white, so the
512×512 `assets/icon.png` is rasterized directly rather than converted from
`apps/web/app/icon.svg`.

## Testing

The full publish path is exercised by stubbing `@raycast/api` (or by running the CLI) and
deploying to the live service, then deleting the test subdomains via
`DELETE /api/sites/<subdomain>`. Worth covering each input shape: a folder, a lone `.html`,
loose files, a zip, and a source with no `index.html`.
