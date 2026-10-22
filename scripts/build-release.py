"""Build manual downloads and the in-app update bundle from Git-listed package files."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
args.output.mkdir(parents=True, exist_ok=True)
assets = []

for folder in ("plugins/aswin-today-actions", "themes/aswin-midnight"):
    package = root / folder
    metadata = json.loads((package / "package.json").read_text())
    paths = subprocess.check_output(["git", "ls-files", "--", folder], cwd=root, text=True).splitlines()
    files = []
    for name in paths:
        file = root / name
        if not file.is_file() or file.is_symlink():
            raise ValueError(f"Release source is not a regular file: {name}")
        files.append((file.relative_to(package).as_posix(), file.read_bytes()))
    archive = args.output / f"{metadata['name']}-{metadata['version']}.zip"
    with zipfile.ZipFile(archive, "x", zipfile.ZIP_DEFLATED) as output:
        for name, content in files:
            entry = zipfile.ZipInfo(f"{metadata['name']}/{name}", (1980, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            output.writestr(entry, content)
    assets.append(archive)
    if metadata["name"] == "aswin-today-actions":
        bundle = {"name": metadata["name"], "version": metadata["version"], "files": [
            {"path": name, "sha256": hashlib.sha256(content).hexdigest(),
             "content": base64.b64encode(content).decode("ascii")} for name, content in files]}
        update = args.output / f"aswin-today-actions-update-{metadata['version']}.json"
        with update.open("x") as output:
            json.dump(bundle, output, separators=(",", ":"))
            output.write("\n")
        assets.append(update)

with (args.output / "SHA256SUMS.txt").open("x") as output:
    output.writelines(hashlib.sha256(asset.read_bytes()).hexdigest() + "  " + asset.name + "\n"
                      for asset in assets)
print(f"Built {len(assets)} release assets and SHA256SUMS.txt in {args.output.resolve()}")
