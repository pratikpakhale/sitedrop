#!/bin/sh -e
bump=${1:?usage: bun run release <patch|minor|major>}

test -z "$(git status --porcelain)" || { echo "working tree not clean" >&2; exit 1; }

cd packages/cli
version=$(npm version "$bump" --no-git-tag-version)
cd ../..

git add packages/cli/package.json
git commit -m "chore(cli): release $version"
git tag "$version"

echo "tagged $version — push with: git push origin main $version"
