"""Package the current workspace source and verification evidence without private runtime state."""
from pathlib import Path
import hashlib
import json
import os
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output"
ARCHIVE = OUTPUT / "GovCare_EHR_Renal_Trends_V56.zip"
MANIFEST = OUTPUT / "GovCare_EHR_Renal_Trends_V56.manifest.json"
SKIP_DIRS = {".git", "node_modules", ".venv", ".venv-cdss", ".venv-cdss312", "__pycache__", "target", ".improve", ".vite", "logs", "govcare-storage", "tmp", ".pytest_cache", ".mypy_cache"}
SKIP_FILES = {"local-role-accounts.sql", "LOCAL_ROLE_CREDENTIALS.md", "qa-failure.png"}


def included(path):
    name = path.name
    if path in (ARCHIVE, MANIFEST) or name.startswith("GovCare_EHR_Renal_Trends_V56"):
        return False
    if name in SKIP_FILES or "credentials" in name.lower():
        return False
    if name == ".env" or name.startswith(".env.") and not name.endswith(("example", "sample")):
        return False
    if path.suffix.lower() in {".zip", ".pyc", ".tsbuildinfo", ".pem", ".key", ".dump", ".db"}:
        return False
    if path.suffix.lower() == ".log":
        return "verification" in path.parts and any(word in name for word in ("tests", "typescript", "vite-build", "browser"))
    return True


def main():
    OUTPUT.mkdir(exist_ok=True)
    files = []
    for directory, folders, names in os.walk(ROOT):
        folders[:] = sorted(d for d in folders if d not in SKIP_DIRS)
        for name in sorted(names):
            file = Path(directory) / name
            if file.is_file() and included(file):
                files.append(file)
    entries = []
    for file in files:
        data = file.read_bytes()
        entries.append({"path": file.relative_to(ROOT).as_posix(), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    manifest = {"package": ARCHIVE.name, "scope": "Current complete project source, existing model artifacts, frontend dist and verification evidence; installed environments and private runtime state excluded.", "excludedDirectories": sorted(SKIP_DIRS), "excludedFiles": "Credentials, private environment files, keys, archives, runtime logs and temporary build state", "fileCount": len(entries), "files": entries}
    manifest_bytes = json.dumps(manifest, indent=2).encode("utf-8")
    MANIFEST.write_bytes(manifest_bytes)
    with zipfile.ZipFile(ARCHIVE, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for file in files:
            archive.write(file, file.relative_to(ROOT).as_posix())
        archive.writestr("RENAL_TRENDS_PACKAGE_MANIFEST.json", manifest_bytes)
    with zipfile.ZipFile(ARCHIVE) as archive:
        assert archive.testzip() is None
        for entry in entries:
            assert hashlib.sha256(archive.read(entry["path"])).hexdigest() == entry["sha256"]
        for required in ("spring-api/pom.xml", "src/components/ai/RenalTrendsDashboard.tsx", "verification/renal-trends-v56/browser.json", "verification/renal-trends-v56/verified-trends.pdf", "RENAL_TRENDS_DELIVERY_V56.txt"):
            assert required in archive.namelist(), required
        assert not any(name.endswith("/.env") or "local-role-credentials" in name for name in archive.namelist())
    digest = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
    (OUTPUT / "GovCare_EHR_Renal_Trends_V56.sha256.txt").write_text(f"{digest}  {ARCHIVE.name}\n", encoding="utf-8")
    print(json.dumps({"archive": str(ARCHIVE), "files": len(entries), "bytes": ARCHIVE.stat().st_size, "sha256": digest, "integrity": "CRC and every file SHA-256 verified"}))


if __name__ == "__main__":
    main()
