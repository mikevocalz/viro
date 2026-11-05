# Releasing the Specs surface of @reactvision/react-viro

Release `@viro-external/xr-contract` and `@viro-external/specs` first
(viro-external, `packages/specs/doc/Release.md`). This package's peer range
names the specs version, so the specs version must exist before this one
is published.

## Version rules

The package version covers all of Viro, so the Specs surface follows the
package's semver:

- **Major**: a name is removed from, or narrowed in, `api/specs.api.d.ts`;
  a diagnostic code changes severity or meaning; the manifest or scene
  protocol drops a version it used to read; a peer range drops a version
  it used to accept (other than a prerelease line).
- **Minor**: new exports, components, props, diagnostic codes, manifest
  fields or formats; a new peer major (for example `@viro-external/specs`
  ^0.3.0 to ^0.4.0, which is breaking only for the Specs path, and is
  called out in the CHANGELOG).
- **Patch**: fixes that leave the snapshot unchanged, or change only doc
  comments.

`api/specs.api.d.ts` is the record. Any diff in it is reviewed against
these rules in the release PR. Diagnostic codes are append-only.

## Local gates

```bash
npm ci --ignore-scripts --no-audit --no-fund
npx tsc --noEmit
npx tsc --noEmit --strict
npm run build:specs-cli
npm run test:specs                    # goldens, both-path byte identity, gallery, lens-ts snapshot, docs
npm run test:specs-compiler           # CLI exit codes and formats
npm run typecheck:specs-examples      # examples against the package root
npm run test:specs-api                # api/specs.api.d.ts
node scripts/specs-error-reference.cjs --check
mkdir -p /tmp/viro-pack && npm pack --pack-destination /tmp/viro-pack
npm run test:specs-consumer -- --viro-tarball /tmp/viro-pack/<file>.tgz --specs-tarballs <dir with viro-external-*.tgz>
```

All must exit 0. The last command installs the tarballs into a clean app
with `--strict-peer-deps` and must report every check as PASS, including
"every installed peer is inside the declared range" and "VS5xxx host
codes match". Use the specs tarballs you are about to publish, or the
published versions (`npm pack @viro-external/specs@<version>`).

If `test:specs-api` reports drift and the change is intended, run
`node scripts/specs-api-snapshot.cjs --update` and commit it with the
CHANGELOG entry. If you added or changed a diagnostic code, run
`npm run docs:specs-errors` and commit `docs/specs-error-reference.md`;
`docs/specs-diagnostics.md` also needs its own `### VSnnnn · severity`
section, which `test:specs` enforces.

## Release PR

1. CHANGELOG.md: under `Unreleased`, a `Specs` entry per consumer-visible
   change, with migration steps for anything breaking
   ([specs-migration.md](specs-migration.md) holds the long form).
2. Peer range for `@viro-external/specs` matches the version just
   published.
3. [specs-compatibility.md](specs-compatibility.md) rows and the "latest on
   npm" column re-checked with `npm view <name> version`.
4. Lens Studio Preview evidence, recorded in the PR:
   - the generated hosts in `__test__/fixtures/specs/lens-ts/` and the
     reference-app scene documents compile in Lens Studio 5.22 or later
     (lens-compiled);
   - every LEAF scenario listed in [specs-examples.md](specs-examples.md)
     run in the SPECS 27 Interactive Preview, results attached
     (preview-validated). The `ExpectedFailure` scenario must fail.
5. CI: `Specs public API` green on the PR, including the `consumer` job.
   If the job summary says the viro-external checks were skipped, run the
   consumer command above locally with the specs tarballs and paste the
   output.

## Publish

The repo's release flow (`npm run release`, `.release-it.json`) bumps the
version and runs `prepare_release.sh`; it does not publish. After it:

```bash
npm pack --pack-destination /tmp/viro-release
npm run test:specs-consumer -- --viro-tarball /tmp/viro-release/<file>.tgz --specs-tarballs <dir>
npm publish /tmp/viro-release/<file>.tgz
npm view @reactvision/react-viro@<version> peerDependencies
```

Publish the same tarball the consumer check passed. Rolling back works as
for any npm package: publish a fixing patch and `npm deprecate` the bad
version with the version to use instead.
