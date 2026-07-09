# sitedrop

Turborepo with bun workspaces. Password-gated static-site drops: files land in Vercel
Blob, a Next.js proxy serves them at `<subdomain>.site.pakhale.com`.

```
apps/web        Next.js app: drop page, /sites, API routes, proxy
apps/raycast    Raycast extension (not published to the Store)
packages/core   shared protocol; raw TS, no build step
packages/cli    the `sitedrop` npm package
```

`bun run dev | build | typecheck` fan out through turbo. `bun run drop` runs the CLI
from source.

## packages/core

Runtime-agnostic on purpose. Every consumer imports subpaths (`@sitedrop/core/prepare`);
the exports map is `"./*": "./src/*.ts"`, so a new module needs no manifest change. The
web app transpiles core via `transpilePackages`; the CLI and the extension bundle it.

`publish.ts` uploads with `upload()` from `@vercel/blob/client`, which needs only the
endpoint and the shared password. The server mints a scoped Blob token per file at
`POST /api/upload`, so no client ever holds `BLOB_READ_WRITE_TOKEN`.

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
git push origin main vX.Y.Z         # the tag is what triggers the workflow
```

`.github/workflows/publish.yml` fires on `v*` tags only, checks the tag matches the CLI's
version, builds, and runs `npm publish --provenance`. Pushing `main` alone publishes
nothing.

Two things break provenance publishes, both learned the hard way:

- `repository.url` in `packages/cli/package.json` must match the GitHub repo the workflow
  runs in. Renaming the repo silently invalidates it.
- `NPM_TOKEN` must be a **classic Automation token** (or a granular token scoped to *all*
  packages). A classic Publish token demands an OTP and fails with `EOTP`; a package-scoped
  granular token cannot create a new package and fails with `E403`.

## apps/web

Vercel project with **Root Directory** `apps/web`. Needs `NEXT_PUBLIC_ROOT_DOMAIN`,
`DROP_PASSWORD`, and a Blob store. Both `site.pakhale.com` and `*.site.pakhale.com` are
attached; the wildcard cert requires Vercel's nameservers.

`apps/web/lib/` is web-only (auth, blob, host parsing, browser file reading). Shared rules
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
