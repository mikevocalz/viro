#!/usr/bin/env python3
"""Packaging/integrity tests with synthetic AARs; these do not compile Android."""

import importlib.util
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest import mock
import zipfile


# Do not make the release-owner checkout dirty just by running this test suite.
sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("pico_package", Path(__file__).with_name("build-pico-package.py"))
pico = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(pico)
CORE_SHA = "a" * 40
BRIDGE_SHA = "b" * 40


def zip_bytes(files):
    result = io.BytesIO()
    with zipfile.ZipFile(result, "w") as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    return result.getvalue()


def aar(name, renderer=False):
    files = {
        "AndroidManifest.xml": b"test manifest",
        "classes.jar": zip_bytes({f"com/viro/{name}.class": b"synthetic class for packaging tests"}),
    }
    if renderer:
        files["jni/arm64-v8a/libviro_renderer.so"] = b"synthetic native library; no ELF test here"
    return zip_bytes(files)


def fixture_files():
    renderer = aar("Renderer", renderer=True)
    bridge = aar("Bridge")
    compatibility = zip_bytes({"com/viro/FullSurface.class": b"unchanged full API"})
    package = {"name": "@test/viro-pico", "version": "1.0.0"}
    manifest = {
        "schemaVersion": 1,
        "package": package,
        "renderer": {"path": pico.RENDERER, "sourceCommit": CORE_SHA,
                     "sha256": pico.sha256(renderer),
                     "classesSha256": pico.sha256(pico.check_aar(renderer, "renderer", True))},
        "bridge": {"path": pico.BRIDGE, "sourceCommit": BRIDGE_SHA, "sha256": pico.sha256(bridge),
                   "builtAgainstRendererSha256": pico.sha256(renderer)},
        "compatibilityClasses": {"path": pico.COMPATIBILITY, "sourceCommit": BRIDGE_SHA,
                                 "sha256": pico.sha256(compatibility)},
    }
    return {
        "package.json": pico.json_bytes(package),
        pico.MANIFEST: pico.json_bytes(manifest),
        pico.RENDERER: renderer, pico.BRIDGE: bridge, pico.COMPATIBILITY: compatibility,
    }


def write_tar(destination, files, extra=None):
    with tarfile.open(destination, "w:gz") as archive:
        for name, data in files.items():
            entry = tarfile.TarInfo("package/" + name)
            entry.size = len(data)
            archive.addfile(entry, io.BytesIO(data))
        if extra:
            archive.addfile(extra, io.BytesIO(b""))


class IntegrityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.archive = Path(self.temp.name) / "viro.tgz"
        self.files = fixture_files()

    def verify(self, extra=None):
        write_tar(self.archive, self.files, extra)
        return pico.verify_package(self.archive)

    def update_manifest(self, update):
        manifest = json.loads(self.files[pico.MANIFEST])
        update(manifest)
        self.files[pico.MANIFEST] = pico.json_bytes(manifest)

    def test_complete_pair_verifies(self):
        result = self.verify()
        self.assertEqual(result["renderer"]["sourceCommit"], CORE_SHA)
        self.assertEqual(result["bridge"]["sourceCommit"], BRIDGE_SHA)

    def test_missing_artifact_or_manifest_rejected(self):
        for path in (pico.RENDERER, pico.BRIDGE, pico.MANIFEST):
            with self.subTest(path=path):
                self.files = fixture_files()
                del self.files[path]
                with self.assertRaisesRegex(ValueError, "exactly one regular file"):
                    self.verify()

    def test_mixed_or_modified_pair_rejected(self):
        self.files[pico.BRIDGE] = aar("BridgeFromAnotherBuild")
        with self.assertRaisesRegex(ValueError, "bridge: SHA-256 mismatch"):
            self.verify()

    def test_lfs_pointer_rejected_even_when_its_hash_matches(self):
        self.files[pico.RENDERER] = b"version https://git-lfs.github.com/spec/v1\noid sha256:abc\n"
        self.update_manifest(lambda m: m["renderer"].update(sha256=pico.sha256(self.files[pico.RENDERER])))
        with self.assertRaises(zipfile.BadZipFile):
            self.verify()

    def test_short_source_commit_rejected(self):
        self.update_manifest(lambda m: m["bridge"].update(sourceCommit="abcdef0"))
        with self.assertRaisesRegex(ValueError, "full Git commit SHA"):
            self.verify()

    def test_manifest_cannot_redirect_artifact_path(self):
        self.update_manifest(lambda m: m["renderer"].update(path="../renderer.aar"))
        with self.assertRaisesRegex(ValueError, "Unexpected renderer artifact path"):
            self.verify()

    def test_duplicate_and_symlink_entries_rejected(self):
        with self.subTest(kind="duplicate"):
            duplicate = tarfile.TarInfo("package/" + pico.BRIDGE)
            with self.assertRaisesRegex(ValueError, "exactly one regular file"):
                self.verify(duplicate)
        with self.subTest(kind="symlink"):
            del self.files[pico.BRIDGE]
            link = tarfile.TarInfo("package/" + pico.BRIDGE)
            link.type = tarfile.SYMTYPE
            link.linkname = pico.RENDERER
            with self.assertRaisesRegex(ValueError, "exactly one regular file"):
                self.verify(link)

    def test_compatibility_jar_cannot_be_replaced(self):
        self.files[pico.COMPATIBILITY] = zip_bytes({"PicoOnly.class": b"wrong API"})
        with self.assertRaisesRegex(ValueError, "Compatibility JAR changed"):
            self.verify()

    def test_bridge_must_record_this_renderer(self):
        self.update_manifest(lambda m: m["bridge"].update(builtAgainstRendererSha256="0" * 64))
        with self.assertRaisesRegex(ValueError, "against this renderer"):
            self.verify()

    def test_expected_manifest_rejects_another_valid_package(self):
        expected = json.loads(self.files[pico.MANIFEST])
        self.update_manifest(lambda m: m["renderer"].update(sourceCommit="c" * 40))
        self.verify()
        with self.assertRaisesRegex(ValueError, "differs from this build"):
            pico.verify_package(self.archive, expected)

    def test_renderer_metadata_must_match_pin_hash_and_alignment(self):
        data = self.files[pico.RENDERER]
        valid = {"repository": "mikevocalz/virocore", "commit": CORE_SHA, "dirty": False,
                 "sha256": pico.sha256(data), "artifact": "viro_renderer-release.aar",
                 "elf_alignment_verified": {"abi": "arm64-v8a", "min_p_align": 16384}}
        pico.check_renderer_metadata(valid, CORE_SHA, data)
        for changes in ({"commit": "c" * 40}, {"dirty": True}, {"sha256": "0" * 64},
                        {"elf_alignment_verified": {"abi": "arm64-v8a", "min_p_align": 4096}}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                pico.check_renderer_metadata({**valid, **changes}, CORE_SHA, data)

    @unittest.skipUnless(shutil.which("npm"), "npm is needed for the actual packlist check")
    def test_real_npm_pack_includes_manifest_and_both_aars(self):
        root = Path(self.temp.name) / "npm-fixture"
        root.mkdir()
        package = json.loads(self.files["package.json"])
        package["files"] = json.loads((pico.ROOT / "package.json").read_text())["files"]
        self.files["package.json"] = pico.json_bytes(package)
        for relative, data in self.files.items():
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        result = subprocess.run(["npm", "pack", "--ignore-scripts", "--json"], cwd=root,
                                text=True, capture_output=True, check=True)
        packed = json.loads(result.stdout)[0]["filename"]
        pico.verify_package(root / packed)


class BuildFlowTests(unittest.TestCase):
    """Exercise staging, command arguments and rollback using mocked compilers."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        base = Path(self.temp.name)
        self.root, self.core, self.out = base / "viro", base / "virocore", base / "output"
        self.files = fixture_files()
        for relative, data in self.files.items():
            if relative != pico.MANIFEST:
                self.write(self.root / relative, data)
        self.write(self.root / "package-lock.json", b'{"lockfileVersion":3}')
        self.write(self.root / "node_modules/react-native/package.json", b'{"version":"0.88.1"}')
        self.write(self.root / "node_modules/.bin/react-native", b"placeholder CLI")
        self.write(self.root / "android/gradlew", b"placeholder Gradle")
        self.write(self.core / "scripts/build-pico-aar.sh", b"placeholder renderer build")
        self.new_renderer = aar("NewRenderer", True)
        self.new_bridge = aar("NewBridge")
        self.fail_bridge = False
        self.omit_manifest = False
        self.seen = []

    @staticmethod
    def write(path, data):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def fake_run(self, args, cwd, capture=False):
        args = list(map(str, args))
        self.seen.append(args)
        if args[0] == "bash":
            target = Path(args[args.index("--out") + 1])
            self.write(target / "viro_renderer-release.aar", self.new_renderer)
            self.write(target / "viro_renderer-release.json", pico.json_bytes({
                "repository": "mikevocalz/virocore", "commit": CORE_SHA, "dirty": False,
                "sha256": pico.sha256(self.new_renderer), "artifact": "viro_renderer-release.aar",
                "elf_alignment_verified": {"abi": "arm64-v8a", "min_p_align": 16384},
            }))
        elif args[0].endswith("react-native"):
            return '{"dependencies":{}}'
        elif args[0] == "./gradlew":
            self.assertIn("--max-workers=2", args)
            self.assertIn("-Dorg.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8", args)
            self.assertEqual((self.root / pico.RENDERER).read_bytes(), self.new_renderer)
            jar_arg = next(a for a in args if a.startswith("-PviroRendererClassesJar="))
            self.assertEqual(Path(jar_arg.split("=", 1)[1]).read_bytes(),
                             pico.check_aar(self.new_renderer, "renderer", True))
            self.assertEqual((self.root / pico.COMPATIBILITY).read_bytes(), self.files[pico.COMPATIBILITY])
            self.assertIn(":viro_bridge:clean", args)
            if self.fail_bridge:
                raise subprocess.CalledProcessError(1, args)
            self.write(self.root / "android/viro_bridge/build/outputs/aar/viro_bridge-release.aar", self.new_bridge)
        elif args[:2] in (["node", "--version"], ["npm", "--version"]):
            return "test-version\n"
        elif args[:3] == ["npm", "run", "build"]:
            return None
        elif args[:2] == ["npm", "pack"]:
            self.assertIn("--ignore-scripts", args)
            target = Path(args[args.index("--pack-destination") + 1]) / "test-viro-1.0.0.tgz"
            paths = ("package.json", pico.MANIFEST, pico.RENDERER, pico.BRIDGE, pico.COMPATIBILITY)
            files = {p: (self.root / p).read_bytes() for p in paths if not (self.omit_manifest and p == pico.MANIFEST)}
            write_tar(target, files)
            return json.dumps([{"filename": target.name}])
        else:
            self.fail(f"Unexpected subprocess: {args}")

    def build(self, pin=CORE_SHA):
        def commit(root):
            return CORE_SHA if root == self.core else BRIDGE_SHA
        with mock.patch.object(pico, "clean_commit", side_effect=commit), \
             mock.patch.object(pico, "run", side_effect=self.fake_run), \
             mock.patch.object(pico.shutil, "which", return_value="/test/node"):
            return pico.build_package(self.root, self.core, pin, self.out)

    def test_build_stages_matched_pair_and_verified_output(self):
        artifact = self.build()
        manifest = pico.verify_package(artifact)
        self.assertEqual(manifest["renderer"]["sourceCommit"], CORE_SHA)
        self.assertEqual(manifest["bridge"]["sourceCommit"], BRIDGE_SHA)
        self.assertEqual(manifest["bridge"]["sha256"], pico.sha256(self.new_bridge))
        self.assertFalse(manifest["validation"]["headsetTested"])
        self.assertEqual((self.root / pico.COMPATIBILITY).read_bytes(), self.files[pico.COMPATIBILITY])
        self.assertEqual(json.loads((self.out / "native-artifacts.json").read_text()), manifest)
        self.assertEqual((self.out / "package.sha256").read_text().split()[0], pico.sha256(artifact.read_bytes()))

    def test_pin_mismatch_fails_before_any_build(self):
        with self.assertRaisesRegex(ValueError, "HEAD does not match"):
            self.build("c" * 40)
        self.assertEqual(self.seen, [])

    def assert_original_pair_restored(self):
        self.assertEqual((self.root / pico.RENDERER).read_bytes(), self.files[pico.RENDERER])
        self.assertEqual((self.root / pico.BRIDGE).read_bytes(), self.files[pico.BRIDGE])
        self.assertFalse((self.root / pico.MANIFEST).exists())
        self.assertEqual(list(self.out.iterdir()), [])

    def test_bridge_failure_restores_pair_without_package(self):
        self.fail_bridge = True
        with self.assertRaises(subprocess.CalledProcessError):
            self.build()
        self.assert_original_pair_restored()

    def test_pack_omission_restores_pair_without_package(self):
        self.omit_manifest = True
        with self.assertRaisesRegex(ValueError, "exactly one regular file"):
            self.build()
        self.assert_original_pair_restored()


if __name__ == "__main__":
    unittest.main(verbosity=2)
