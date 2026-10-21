"""Package the current workspace source and verification evidence without private runtime state."""
from pathlib import Path
import hashlib
import json
import os
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output"
PACKAGE_NAME = "GovCare_EHR_Clinical_Workspace_V60" if "--clinical" in sys.argv else "GovCare_EHR_Testing_PDF_Workflow_V59" if "--testing" in sys.argv else "GovCare_EHR_Smart_PDF_Workflow_V58" if "--wizard" in sys.argv else "GovCare_EHR_Clinical_PDF_Reuse_V57"
ARCHIVE = OUTPUT / (PACKAGE_NAME + ".zip")
MANIFEST = OUTPUT / (PACKAGE_NAME + ".manifest.json")
SKIP_DIRS = {".git", "node_modules", ".venv", ".venv-cdss", ".venv-cdss312", "__pycache__", "target", ".improve", ".vite", "logs", "govcare-storage", "tmp", ".pytest_cache", ".mypy_cache"}
SKIP_FILES = {"local-role-accounts.sql", "LOCAL_ROLE_CREDENTIALS.md", "qa-failure.png", "browser-failure.txt", "failure.png"}


def included(path):
    name = path.name
    if path in (ARCHIVE, MANIFEST) or name.startswith(("GovCare_EHR_Clinical_PDF_Reuse_V57", "GovCare_EHR_Smart_PDF_Workflow_V58", "GovCare_EHR_Testing_PDF_Workflow_V59", "GovCare_EHR_Clinical_Workspace_V60")):
        return False
    if name in SKIP_FILES or "credentials" in name.lower():
        return False
    if name == ".env" or name.startswith(".env.") and not name.endswith(("example", "sample")):
        return False
    if path.suffix.lower() in {".zip", ".pyc", ".tsbuildinfo", ".pem", ".key", ".dump", ".db"}:
        return False
    if path.suffix.lower() == ".log":
        return "verification" in path.parts and any(word in name for word in ("tests", "typescript", "vite-build", "browser", "backend-package", "frontend-build"))
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
        archive.writestr("CLINICAL_PDF_PACKAGE_MANIFEST.json", manifest_bytes)
    with zipfile.ZipFile(ARCHIVE) as archive:
        assert archive.testzip() is None
        for entry in entries:
            assert hashlib.sha256(archive.read(entry["path"])).hexdigest() == entry["sha256"]
        for required in ("spring-api/pom.xml", "src/components/ai/ClinicalPdfImportWorkspace.tsx", "spring-api/src/main/resources/db/migration/V49__clinical_pdf_reviewed_sources.sql", "verification/pdf-reuse-v57/browser.json", "verification/pdf-reuse-v57/browser-repeat.json", "verification/pdf-reuse-v57/final-live-verification.json", "verification/pdf-reuse-v57/screenshots/pdf-review-1440.png", "verification/pdf-reuse-v57/screenshots/pdf-review-375.png", "CLINICAL_PDF_REUSE_DELIVERY_V57.txt", "RENAL_TRENDS_DELIVERY_V56.txt", "verification/renal-trends-v56/verified-trends.pdf"):
            assert required in archive.namelist(), required
        assert not any(name.endswith("/.env") or "local-role-credentials" in name for name in archive.namelist())
        if "--clinical" in sys.argv:
            for required in ("CLINICAL_WORKSPACE_DELIVERY_V60.txt", "verification/clinical-workspace-v60/browser.json", "verification/clinical-workspace-v60/live.json", "verification/clinical-workspace-v60/score-fhir.json", "verification/clinical-workspace-v60/java-tests.log", "verification/clinical-workspace-v60/django-tests.log", "verification/clinical-workspace-v60/node-tests.log", "verification/clinical-workspace-v60/frontend-build.log", "verification/clinical-workspace-v60/screenshots/desktop-findings.png", "verification/clinical-workspace-v60/screenshots/desktop-source-review.png", "verification/clinical-workspace-v60/screenshots/mobile-reports.png", "output/pdf/GovCare_Synthetic_Clinical_Summary_V60.pdf", "spring-api/src/main/resources/clinical-test-documents/scanned.pdf", "spring-api/src/main/java/lk/gov/health/govcare/ai/CkdConciseReportPdf.java", "src/components/ai/ClinicalPdfDocumentPreview.tsx"):
                assert required in archive.namelist(), required
        if "--testing" in sys.argv:
            for required in ("verification/pdf-workflow-v59/browser.json", "verification/pdf-workflow-v59/live-verification.json", "verification/pdf-workflow-v59/java-tests.log", "verification/pdf-workflow-v59/node-tests.log", "verification/pdf-workflow-v59/backend-package.log", "verification/pdf-workflow-v59/screenshots/desktop-upload.png", "verification/pdf-workflow-v59/screenshots/mobile-review.png", "CLINICAL_PDF_TESTING_WORKFLOW_DELIVERY_V59.txt", "spring-api/src/main/resources/db/migration/V50__clinical_pdf_upload_and_verification.sql", "spring-api/src/main/java/lk/gov/health/govcare/ai/ClinicalPdfVerificationService.java", "src/components/ai/ClinicalPdfObservationReview.tsx"):
                assert required in archive.namelist(), required
        if "--wizard" in sys.argv:
            for required in ("verification/pdf-wizard-v58/browser.json", "verification/pdf-wizard-v58/java-tests.log", "verification/pdf-wizard-v58/node-tests.log", "verification/pdf-wizard-v58/screenshots/desktop-selection.png", "verification/pdf-wizard-v58/screenshots/tablet-review.png", "verification/pdf-wizard-v58/screenshots/mobile-review.png", "CLINICAL_PDF_SMART_WORKFLOW_DELIVERY_V58.txt", "spring-api/src/main/java/lk/gov/health/govcare/ai/ClinicalPdfOcrService.java"):
                assert required in archive.namelist(), required
    digest = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
    (OUTPUT / (PACKAGE_NAME + ".sha256.txt")).write_text(f"{digest}  {ARCHIVE.name}\n", encoding="utf-8")
    print(json.dumps({"archive": str(ARCHIVE), "files": len(entries), "bytes": ARCHIVE.stat().st_size, "sha256": digest, "integrity": "CRC and every file SHA-256 verified"}))


if __name__ == "__main__":
    main()
