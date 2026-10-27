"""Check the files Git would publish without printing credential values."""
from pathlib import Path
import re
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]


def git_paths(*args):
    output = subprocess.check_output(["git", *args, "-z"], cwd=ROOT)
    return [name for name in output.decode().split("\0") if name]


def main():
    findings = []
    tracked = set(git_paths("ls-files", "--cached"))
    candidates = tracked | set(git_paths("ls-files", "--others", "--exclude-standard"))
    for name in git_paths("ls-files", "--cached", "--ignored", "--exclude-standard"):
        findings.append(f"{name}: ignored file is still tracked; remove it from the Git index")

    patterns = {
        "private key": r"-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----",
        "GitHub token": r"\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{25,})",
        "AWS access ID": r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b",
        "Google API key": r"\bAIza[0-9A-Za-z_-]{30,}\b",
        "MongoDB credentials": r"mongodb(?:\+srv)?://[^\s/]+:[^\s/@]+@",
        "public signing-secret fallback": r"super_secret_fyp_key_\d+",
    }
    local_secrets = []
    for directory in [ROOT, ROOT / "backend", ROOT / "ML"]:
        for path in directory.glob(".env*"):
            if not path.is_file() or path.name.endswith(".example"):
                continue
            for line in path.read_text().splitlines():
                match = re.match(r"\s*([A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*)\s*=\s*(.+)", line)
                if match:
                    value = match[2].strip().strip("\"'")
                    if len(value) >= 16:
                        local_secrets.append((match[1], value))

    for name in sorted(candidates):
        path = ROOT / name
        parts = Path(name).parts
        is_example = path.name.startswith(".env") and path.name.endswith(".example")
        if path.name.startswith(".env") and not is_example:
            findings.append(f"{name}: private environment file would be published")
        if any(part in {".next", "node_modules", "__pycache__", "uploads", "mdb_extracted"} for part in parts):
            findings.append(f"{name}: generated output or private data would be published")
            continue
        if path.suffix.lower() in {".mdb", ".accdb", ".sqlite", ".sqlite3", ".pyc"} or ("db" in parts and path.name.startswith(("data_tvet", "ml_training_data"))):
            findings.append(f"{name}: local database or student export would be published")
            continue
        if not path.is_file():
            continue
        if path.stat().st_size > 10 * 1024 * 1024:
            findings.append(f"{name}: exceeds 10 MiB; review before publishing")
            continue
        try:
            content = path.read_text()
        except UnicodeError:
            continue
        for number, line in enumerate(content.splitlines(), 1):
            for label, pattern in patterns.items():
                if re.search(pattern, line):
                    findings.append(f"{name}:{number}: possible {label}; value withheld")
            for key, value in local_secrets:
                if value in line:
                    findings.append(f"{name}:{number}: contains local {key}; value withheld")
            if is_example and re.match(r"\s*\w*(?:KEY|SECRET|TOKEN|PASSWORD)\w*\s*=\s*\S", line):
                findings.append(f"{name}:{number}: leave example credentials empty")

    examples = {
        ".env.example": {"JWT_SECRET", "JSEARCH_API_KEY", "GEMINI_API_KEY", "CORS_ORIGIN", "MONGO_URI", "BACKEND_URL"},
        "backend/.env.example": {"PORT", "MONGO_URI", "JWT_SECRET", "ML_API_URL", "GEMINI_API_KEY", "JSEARCH_API_KEY", "CORS_ORIGIN", "REDIS_URL", "TZ"},
    }
    for name, required in examples.items():
        path = ROOT / name
        if name not in candidates or not path.is_file():
            findings.append(f"{name}: environment template is missing or ignored")
            continue
        keys = set(re.findall(r"^([A-Z_]+)=", path.read_text(), re.MULTILINE))
        for key in sorted(required - keys):
            findings.append(f"{name}: missing {key}")

    if findings:
        print("Repository checks failed:")
        print("\n".join(f"- {finding}" for finding in findings))
        return 1
    print(f"Repository checks passed for {len(candidates)} tracked and new files. Git history was not rewritten or certified secret-free.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
