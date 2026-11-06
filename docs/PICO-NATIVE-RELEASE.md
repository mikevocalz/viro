# PICO native package releases

## App consumers

Install a reviewed Viro package version or immutable Git commit that includes the
renderer and bridge for your application. Both AARs are part of the package:

- `android/viro_renderer/viro_renderer-release.aar`
- `android/react_viro/react_viro-release.aar`

The Gradle shim projects consume these files directly. An app build, Expo
prebuild, or clean native regeneration does not require rebuilding ViroCore or
copying AARs into `node_modules`. If an installation is missing an AAR, contains a
Git LFS pointer, or fails a recorded hash check, reinstall the pinned package.
Keep the application's dependency lockfile so local and CI builds select the
same package. Avoid an unqualified `github:mikevocalz/viro` dependency: it follows
the repository's default branch rather than identifying a reviewed native pair.

Packages produced by the paired release workflow also contain
`android/native-artifacts.json`. This records the exact renderer and bridge
source commits and SHA-256 values. Older packages can contain valid AARs without
this manifest; its absence alone does not demonstrate a broken installation.

## Release owners

The **PICO paired package** workflow builds a complete npm tarball for review.
It runs on relevant pull requests against the explicitly pinned ViroCore commit
in the workflow. A manual run accepts a different full 40-character ViroCore
commit. Both paths use read-only repository permissions and upload build
artifacts; neither publishes npm, changes the default branch, or creates a
release. CI artifacts expire after 14 days, so they are review inputs rather than
permanent dependency URLs. Promote the reviewed tarball through the project's
normal release process before giving consumers a stable version to install.

The build performs these steps:

1. Require clean Viro and ViroCore checkouts and an exact ViroCore commit match.
2. Invoke ViroCore's existing `scripts/build-pico-aar.sh`, including its 16KB
   arm64 ELF alignment gate. Verify its source commit, clean-tree flag and hash.
3. Stage that renderer, extract its Java classes into a temporary build input,
   and compile `:viro_bridge:assembleRelease` with those classes first. Preserve
   `android/viro_renderer/main-classes/viro-renderer-main-classes.jar` as the
   compatibility fallback for the wider bridge surface. The bridge build uses
   a 4GB Java heap and at most two Gradle workers so Jetifier can process React
   Native's release AAR in clean CI; app-consumer Gradle settings are unchanged.
4. Record both AAR hashes and source commits in `android/native-artifacts.json`,
   along with the selected renderer classes, compatibility JAR, installed React
   Native version and dependency-lock hash. Update the older
   `controller-build.json` renderer record to match the new build.
5. Build TypeScript explicitly, pack with npm lifecycle scripts disabled, and
   inspect the actual tarball. Reject missing files, duplicate/symlink artifact
   entries, invalid AAR ZIPs, wrong hashes, source pins or package identity, and
   any manifest that differs from this build. Upload only after verification.

The script leaves both newly built AARs and their provenance staged in the
dedicated Viro checkout after success. It restores the previous pair if the
build or verification fails. It never substitutes a downloaded AAR or replaces
the tracked full compatibility JAR with the narrower PICO classes.

### Running locally

Use clean, dedicated sibling checkouts of `mikevocalz/viro` and
`mikevocalz/virocore`. Check out the exact Viro revision to release, and a full
ViroCore commit that includes `scripts/build-pico-aar.sh`. Install Node 24,
Python 3, JDK 17, Android SDK platform/build tools 36, and the NDK pinned by that
ViroCore checkout. On Linux the renderer also needs `uuid-dev` and `ninja-build`.
Install Viro's JavaScript build dependencies with `npm ci`.

From the Viro checkout, run the following, replacing `FULL_VIROCORE_COMMIT` with
the chosen 40-character SHA and checking out that SHA in `../virocore` first:

```bash
npm run bundle:pico -- \
  --virocore ../virocore \
  --virocore-commit FULL_VIROCORE_COMMIT \
  --out ../pico-release
```

The output directory must be new or empty and outside both source checkouts. It
contains one `.tgz`, `native-artifacts.json`, and `package.sha256`. This Android
release path does not invoke `prepare_release.sh` or build Apple frameworks;
Apple binaries in the package retain their existing provenance and require
their own release validation.

The package can be checked again without Android tools or npm dependencies:

```bash
python3 scripts/build-pico-package.py verify ../pico-release/PACKAGE_NAME.tgz
```

The verifier checks integrity and the recorded pairing. It does not authenticate
an unknown package producer or prove headset compatibility. The workflow records
`headsetTested: false`: a successful bridge compile and aligned native binaries
still require runtime testing for the intended PICO headset and OS release.

### Manifest contract

`schemaVersion: 1` fixes the paths above. Each of `renderer` and `bridge` contains
`path`, a lowercase 64-character `sha256`, and a full lowercase 40-character
`sourceCommit`. The bridge commit identifies the Viro sources used to build it;
the renderer commit identifies ViroCore. `bridge.builtAgainstRendererSha256`
binds the bridge build to the renderer in the same package.
`compatibilityClasses.sourceCommit` identifies the Viro checkout that supplied
the tracked compatibility JAR, not an inferred ViroCore source revision.

The source commits and lockfile make the selected inputs repeatable. This flow
does not claim bit-for-bit reproducibility across different Android toolchain
installations. Do not copy a manifest from a previous release or keep its hashes
after replacing either native artifact.
