"""Package tracked files only. Run after committing a verified build."""
import hashlib
import json
import subprocess
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
destination = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root.parent
destination.mkdir(parents=True, exist_ok=True)
manifest = json.loads((root / "spindle.json").read_text(encoding="utf-8"))
version = manifest["version"]
tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode("utf-8").split("\0")
tracked = [name for name in tracked if name]
release_files = [name for name in tracked if name in {"spindle.json", "README.md", "CHANGELOG.md", "assets/README.md", "assets/kazz-cover.png", "assets/fonts/OFL.txt"} or name.startswith(("dist/", "docs/", "assets/readme/"))]
results = []
for suffix, names, prefix in [("runtime", release_files, "kazzware"), ("source", tracked, "KazzWare")]:
    path = destination / f"KazzWare-{version}-{suffix}.zip"
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name in sorted(names):
            local = (root / name).resolve()
            local.relative_to(root)
            archive.write(local, f"{prefix}/{name}")
    with zipfile.ZipFile(path) as archive:
        if archive.testzip() is not None:
            raise RuntimeError(f"Corrupt archive: {path}")
        if f"{prefix}/spindle.json" not in archive.namelist() or f"{prefix}/dist/frontend.js" not in archive.namelist():
            raise RuntimeError("Missing install files")
    results.append({"file": path.name, "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
record = {"version": version, "commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip(), "artifacts": results}
(destination / f"KazzWare-{version}-checksums.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
print(json.dumps(record, indent=2))
