# sitedrop

Publish static files to a subdomain of a [sitedrop](https://github.com/pratikpakhale/sitedrop) deployment.

```bash
npx sitedrop ./dist                  # folder, random subdomain
npx sitedrop ./dist -n my-demo       # explicit subdomain
npx sitedrop ./site.zip              # a zip
npx sitedrop report.html chart.png   # loose files
npx sitedrop ./assets --force        # publish without an index.html
```

A path may be a folder, a `.zip`, or a file; mix them freely. Folder and
archive contents land at the site root, with a single wrapper directory
stripped. A lone `.html` file is renamed to `index.html` automatically.
Redeploying a subdomain replaces the site and prunes stale files.

The target service and its shared secret come from `--endpoint` and
`--password`, or the `SITEDROP_ENDPOINT` and `SITEDROP_PASSWORD` environment
variables.

Requires node >= 20. No dependencies.
