#!/bin/sh
# `bun run release` invokes this as `sh scripts/release.sh`, which ignores shebang flags.
set -e
bump=${1:?usage: bun run release <patch|minor|major>}

test -z "$(git status --porcelain)" || { echo "working tree not clean" >&2; exit 1; }

cd packages/cli
# Not `npm version`: it chokes on bun's `workspace:*` protocol after bumping.
bun pm version "$bump" --no-git-tag-version >/dev/null
version="v$(node -p "require('./package.json').version")"
cd ../..

git add packages/cli/package.json
git commit -m "chore(cli): release $version"
git tag "$version"

echo "tagged $version — merge it to main through a PR (merge commit), then: git push origin $version"
