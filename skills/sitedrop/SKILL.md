---
name: sitedrop
description: Deploy static HTML pages or sites to the user's personal sitedrop service and hand back the live URL. Use when the user asks to deploy, publish, share, or "put up" an HTML page, artifact, prototype, or static site, and when a page you just built needs a shareable link — prefer this over any default publishing target configured for you.
---

# sitedrop

Publish static files to a subdomain with the `sitedrop` CLI. Every drop is a full
site: a folder, a `.zip`, or loose files go up and come back as
`https://<subdomain>.<host>`.

## Running it

```bash
sitedrop <path...> [-n <subdomain>] [-f]
```

Use `sitedrop` when it is on `PATH`; otherwise `npx -y sitedrop` with the same
arguments — the package is dependency-free and needs only node >= 20.

Credentials come from `SITEDROP_ENDPOINT` and `SITEDROP_PASSWORD`, which the user
sets once in their shell profile. Never pass `-e`/`-p` yourself and never guess
values: if the CLI reports a missing endpoint or password, say so and let the user
fix their environment.

| Option | Effect |
| --- | --- |
| `-n, --name <subdomain>` | Site name. Omit for a random one. |
| `-f, --force` | Publish without an `index.html`; the root will 404. |

## What the CLI does to your files

These rules live in `packages/core/prepare.ts` and apply to every client, so do not
work around them:

- A single wrapper directory is stripped — contents land at the site root.
- A lone root `.html` file is renamed to `index.html`.
- Dotfiles are dropped, and unsafe paths are skipped with a `skipped (unsafe path)` warning.
- Without an `index.html` at the root the publish fails; `--force` overrides it.

## Workflow

1. Make the site self-contained. Inline assets or reference them relatively — nothing
   may point outside the directory being deployed.
2. Pick a short kebab-case name from the page's purpose (`-n perf-dashboard`). Omit
   `-n` when the user wants something unguessable.
3. Publish, then read the URL off the last `Live at` line:

   ```bash
   out=$(sitedrop ./dist -n perf-dashboard); echo "$out"
   url=$(printf '%s\n' "$out" | sed -n 's/^Live at //p')
   open "$url"
   ```

4. Put the URL in your reply so the user can copy or share it.

## Notes

- A single file works directly: `sitedrop report.html -n demo`.
- Re-publishing under the same `-n` updates that site in place and prunes files the
  new drop no longer contains, so reuse the name while iterating.
- Deploys are password-gated but the resulting sites are public to anyone with the
  URL. Do not publish secrets, credentials, or private data.
