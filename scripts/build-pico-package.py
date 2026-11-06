#!/usr/bin/env python3
"""Release-owner build and verification of one pinned PICO renderer/bridge pair.

Uses only Python's standard library; Android/Node build tools are required for
`build`, but `verify` needs only Python. Never downloads an AAR or publishes npm.
"""

import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import zipfile


ROOT = Path(__file__).resolve().parent.parent
RENDERER = "android/viro_renderer/viro_renderer-release.aar"
BRIDGE = "android/react_viro/react_viro-release.aar"
MANIFEST = "android/native-artifacts.json"
COMPATIBILITY = "android/viro_renderer/main-classes/viro-renderer-main-classes.jar"
LEGACY_PROVENANCE = "android/viro_renderer/controller-build.json"
COMMIT = re.compile(r"[0-9a-f]{40}\Z")
SHA256 = re.compile(r"[0-9a-f]{64}\Z")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def run(args, cwd, capture=False):
    print("+ " + " ".join(map(str, args)), file=sys.stderr)
    return subprocess.run(
        list(map(str, args)), cwd=cwd, check=True, text=True,
        stdout=subprocess.PIPE if capture else None,
    ).stdout


def clean_commit(root):
    top = Path(run(["git", "rev-parse", "--show-toplevel"], root, True).strip())
    require(top.resolve() == root, f"Expected a repository root: {root}")
    dirty = run(["git", "status", "--porcelain", "--untracked-files=normal"], root, True)
    require(not dirty.strip(), f"Use a clean, dedicated checkout: {root}\n{dirty}")
    return run(["git", "rev-parse", "HEAD"], root, True).strip()


def json_bytes(value):
    return (json.dumps(value, indent=2) + "\n").encode()


def check_aar(data, label, renderer=False):
    """Reject pointers, truncated ZIPs and archives with no usable Java payload."""
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names = archive.namelist()
        for member in ("AndroidManifest.xml", "classes.jar"):
            require(names.count(member) == 1, f"{label}: expected one {member}")
        require(archive.testzip() is None, f"{label}: corrupt ZIP member")
        classes = archive.read("classes.jar")
        with zipfile.ZipFile(io.BytesIO(classes)) as jar:
            require(jar.testzip() is None, f"{label}: corrupt classes.jar")
            require(any(n.endswith(".class") for n in jar.namelist()),
                    f"{label}: classes.jar contains no classes")
        if renderer:
            require(any(n.startswith("jni/arm64-v8a/") and n.endswith(".so") for n in names),
                    f"{label}: no arm64-v8a native libraries")
        return classes


def verify_contents(read, expected_manifest=None):
    """Read only the fixed package paths; never extract an untrusted tarball."""
    manifest = json.loads(read(MANIFEST))
    require(isinstance(manifest, dict) and manifest.get("schemaVersion") == 1,
            "Expected native-artifacts.json schemaVersion 1")
    if expected_manifest is not None:
        require(manifest == expected_manifest, "Package manifest differs from this build")
    package = json.loads(read("package.json"))
    require(manifest.get("package") == {"name": package["name"], "version": package["version"]},
            "Manifest package name/version does not match package.json")
    for kind, relative in (("renderer", RENDERER), ("bridge", BRIDGE)):
        artifact = manifest.get(kind, {})
        require(artifact.get("path") == relative, f"Unexpected {kind} artifact path")
        require(COMMIT.fullmatch(str(artifact.get("sourceCommit", ""))),
                f"{kind}: sourceCommit must be a full Git commit SHA")
        require(SHA256.fullmatch(str(artifact.get("sha256", ""))), f"{kind}: invalid sha256")
        data = read(relative)
        require(sha256(data) == artifact["sha256"], f"{kind}: SHA-256 mismatch")
        classes = check_aar(data, kind, renderer=kind == "renderer")
        if kind == "renderer":
            require(sha256(classes) == artifact.get("classesSha256"),
                    "Renderer classes do not match the recorded compile input")
    require(manifest["bridge"].get("builtAgainstRendererSha256") == manifest["renderer"]["sha256"],
            "Bridge was not recorded against this renderer")
    compatibility = manifest.get("compatibilityClasses", {})
    require(compatibility.get("path") == COMPATIBILITY, "Unexpected compatibility JAR path")
    require(sha256(read(COMPATIBILITY)) == compatibility.get("sha256"),
            "Compatibility JAR changed")
    require(compatibility.get("sourceCommit") == manifest["bridge"]["sourceCommit"],
            "Compatibility JAR must come from the bridge source checkout")
    return manifest


def verify_package(package_path, expected_manifest=None):
    with tarfile.open(package_path, "r:gz") as archive:
        entries = {}
        for entry in archive.getmembers():
            entries.setdefault(entry.name, []).append(entry)

        def read(relative):
            matches = entries.get("package/" + relative, [])
            require(len(matches) == 1 and matches[0].isfile(),
                    f"Package must contain exactly one regular file: {relative}")
            return archive.extractfile(matches[0]).read()

        return verify_contents(read, expected_manifest)


def check_renderer_metadata(metadata, expected_commit, data):
    require(metadata.get("repository") == "mikevocalz/virocore", "Unexpected renderer repository")
    require(metadata.get("commit") == expected_commit, "Renderer source commit does not match pin")
    require(metadata.get("dirty") is False, "Renderer was built from a dirty source checkout")
    require(metadata.get("sha256") == sha256(data), "Renderer build metadata hash mismatch")
    require(metadata.get("artifact") == "viro_renderer-release.aar", "Unexpected renderer artifact")
    alignment = metadata.get("elf_alignment_verified", {})
    require(alignment.get("abi") == "arm64-v8a" and
            isinstance(alignment.get("min_p_align"), int) and alignment["min_p_align"] >= 16384,
            "Renderer has no successful 16KB arm64 ELF alignment result")


def build_package(root, core, expected_core_commit, output):
    root, core, output = root.resolve(), core.resolve(), output.resolve()
    require(COMMIT.fullmatch(expected_core_commit), "--virocore-commit must be a full 40-character Git SHA")
    bridge_commit = clean_commit(root)
    require(clean_commit(core) == expected_core_commit, "ViroCore checkout HEAD does not match --virocore-commit")
    require(not output.is_relative_to(root) and not output.is_relative_to(core),
            "--out must be outside both source checkouts")
    require(not output.exists() or (output.is_dir() and not any(output.iterdir())),
            "--out must be a new or empty directory")
    for relative in (COMPATIBILITY, "package-lock.json", "node_modules/react-native/package.json",
                     "node_modules/.bin/react-native", "android/gradlew"):
        require((root / relative).is_file(), f"Missing {relative}; install locked build dependencies with npm ci")
    require((core / "scripts/build-pico-aar.sh").is_file(), "Pinned ViroCore lacks scripts/build-pico-aar.sh")
    compatibility = (root / COMPATIBILITY).read_bytes()
    package = json.loads((root / "package.json").read_text())
    react_native = json.loads((root / "node_modules/react-native/package.json").read_text())["version"]
    output.mkdir(parents=True, exist_ok=True)

    # Failure restores the original pair and provenance. No partial package is
    # copied into --out; a successful build intentionally leaves the new pair staged.
    staged_paths = (RENDERER, BRIDGE, MANIFEST, LEGACY_PROVENANCE, COMPATIBILITY)
    originals = {p: (root / p).read_bytes() if (root / p).exists() else None for p in staged_paths}
    try:
        with tempfile.TemporaryDirectory(prefix=".pico-build-", dir=output) as work_dir:
            work = Path(work_dir)
            renderer_output = work / "renderer"
            run(["bash", core / "scripts/build-pico-aar.sh", "--out", renderer_output], core)
            renderer = (renderer_output / "viro_renderer-release.aar").read_bytes()
            metadata = json.loads((renderer_output / "viro_renderer-release.json").read_text())
            check_renderer_metadata(metadata, expected_core_commit, renderer)
            require(clean_commit(core) == expected_core_commit, "ViroCore changed during its build")
            renderer_classes = check_aar(renderer, "renderer", renderer=True)
            classes_path = work / "renderer-classes.jar"
            classes_path.write_bytes(renderer_classes)
            (root / RENDERER).write_bytes(renderer)

            # Compile against the new renderer first, with the tracked full Java
            # surface as a fallback for platform-specific APIs absent on PICO.
            autolink = run([root / "node_modules/.bin/react-native", "config"], root, True)
            json.loads(autolink)  # Do not pass a truncated/error log to Gradle.
            autolink_path = root / "android/.gradle/autolinking.json"
            autolink_path.parent.mkdir(parents=True, exist_ok=True)
            autolink_path.write_text(autolink)
            node = shutil.which("node")
            require(node, "Node.js is required")
            # React Native's release AAR exceeds the checkout's legacy 1536m
            # Jetifier heap in a clean CI build. Keep this release-only and bound
            # parallel transforms instead of changing app-consumer Gradle settings.
            run(["./gradlew", "--no-daemon", "--max-workers=2",
                 "-Dorg.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8",
                 f"-PnodeExecutable={node}",
                 f"-PviroRendererClassesJar={classes_path}",
                 ":viro_bridge:clean", ":viro_bridge:assembleRelease"], root / "android")
            bridge = (root / "android/viro_bridge/build/outputs/aar/viro_bridge-release.aar").read_bytes()
            check_aar(bridge, "bridge")
            require((root / COMPATIBILITY).read_bytes() == compatibility,
                    "Bridge build modified the full compatibility JAR")
            (root / BRIDGE).write_bytes(bridge)

            manifest = {
                "schemaVersion": 1,
                "target": "pico",
                "package": {"name": package["name"], "version": package["version"]},
                "renderer": {
                    "path": RENDERER, "sha256": sha256(renderer),
                    "sourceRepository": "mikevocalz/virocore", "sourceCommit": expected_core_commit,
                    "classesSha256": sha256(renderer_classes),
                },
                "bridge": {
                    "path": BRIDGE, "sha256": sha256(bridge),
                    "sourceRepository": "mikevocalz/viro", "sourceCommit": bridge_commit,
                    "builtAgainstRendererSha256": sha256(renderer),
                },
                "compatibilityClasses": {
                    "path": COMPATIBILITY, "sha256": sha256(compatibility),
                    "sourceCommit": bridge_commit,
                },
                "build": {
                    "reactNativeVersion": react_native,
                    "packageLockSha256": sha256((root / "package-lock.json").read_bytes()),
                    "nodeVersion": run(["node", "--version"], root, True).strip(),
                    "npmVersion": run(["npm", "--version"], root, True).strip(),
                    "renderer": metadata,
                },
                "validation": {"bridgeCompile": "passed", "headsetTested": False},
            }
            (root / MANIFEST).write_bytes(json_bytes(manifest))
            # Keep the older renderer-specific provenance file truthful too.
            (root / LEGACY_PROVENANCE).write_bytes(json_bytes({
                "sourceRepository": "mikevocalz/virocore", "sourceCommit": expected_core_commit,
                "sha256": sha256(renderer), "packaging": "scripts/build-pico-package.py",
                "validation": "16KB arm64 ELF alignment verified; bridge compiled; no headset run.",
            }))

            run(["npm", "run", "build"], root)
            packed_dir = work / "package"
            packed_dir.mkdir()
            # Build explicitly above, then disable lifecycle hooks so packing cannot
            # replace either native input after its hash has been recorded.
            result = json.loads(run(["npm", "pack", "--ignore-scripts", "--json",
                                     "--pack-destination", packed_dir], root, True))
            require(isinstance(result, list) and len(result) == 1, "npm pack must produce one package")
            filename = result[0]["filename"]
            require(Path(filename).name == filename and filename.endswith(".tgz"), "Invalid npm package filename")
            packed = packed_dir / filename
            verify_package(packed, manifest)
            verify_contents(lambda relative: (root / relative).read_bytes(), manifest)
            (output / "native-artifacts.json").write_bytes(json_bytes(manifest))
            (output / "package.sha256").write_text(f"{sha256(packed.read_bytes())}  {filename}\n")
            packed.replace(output / filename)
            print(f"Verified package: {output / filename}")
            print("Both native artifacts are staged. Compilation passed; headset validation is still required.")
            return output / filename
    except BaseException:
        for relative, original in originals.items():
            path = root / relative
            if original is None:
                path.unlink(missing_ok=True)
            else:
                path.write_bytes(original)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    build = commands.add_parser("build", help="Build a matched pair in clean release-owner checkouts")
    build.add_argument("--virocore", type=Path, required=True)
    build.add_argument("--virocore-commit", required=True)
    build.add_argument("--out", type=Path, required=True)
    verify = commands.add_parser("verify", help="Verify both AARs and provenance in an existing npm tarball")
    verify.add_argument("package", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "build":
            build_package(ROOT, args.virocore, args.virocore_commit, args.out)
        else:
            manifest = verify_package(args.package)
            print(f"Verified pair: renderer {manifest['renderer']['sourceCommit']} / "
                  f"bridge {manifest['bridge']['sourceCommit']}")
    except (ValueError, OSError, KeyError, TypeError, subprocess.CalledProcessError,
            zipfile.BadZipFile, tarfile.TarError) as error:
        parser.exit(1, f"PICO package verification failed: {error}\n")


if __name__ == "__main__":
    main()
