from __future__ import annotations

import argparse
import base64
import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing env: {name}")
    return value


def split_owner_repo(value: str) -> tuple[str, str]:
    if "/" not in value:
        raise ValueError(f"Invalid owner/repo: {value}")
    owner, repo = value.split("/", 1)
    if not owner or not repo:
        raise ValueError(f"Invalid owner/repo: {value}")
    return owner, repo


def get_existing_sha(api_url: str, headers: dict[str, str], branch: str, timeout: float) -> str | None:
    response = requests.get(api_url, headers=headers, params={"ref": branch}, timeout=timeout)
    if response.status_code == 200:
        return response.json()["sha"]
    if response.status_code == 404:
        return None
    raise RuntimeError(f"GET failed: {response.status_code} {response.text}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload a local JSON file to a repo path via GitHub Contents API.")
    parser.add_argument("--repo", default=os.getenv("GITHUB_REPOSITORY", "dabimastools/dabimasFactor"))
    parser.add_argument("--branch", default="main")
    parser.add_argument("--local-file", default="dabimasFactor.json")
    parser.add_argument("--dest-path", default="json/dabimasFactor.json")
    parser.add_argument("--message", default="")
    parser.add_argument("--timezone", default="Asia/Tokyo")
    parser.add_argument("--timeout", type=float, default=30.0)
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    token = require_env("GITHUB_TOKEN")
    owner, repo = split_owner_repo(args.repo)
    today = datetime.now(ZoneInfo(args.timezone)).strftime("%Y-%m-%d")
    message = args.message or f"Update {args.dest_path} ({today})"

    local_file = Path(args.local_file)
    if not local_file.exists():
        raise FileNotFoundError(f"Local file not found: {local_file}")

    api_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{args.dest_path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }

    sha = get_existing_sha(api_url, headers, args.branch, args.timeout)

    content_b64 = base64.b64encode(local_file.read_bytes()).decode("utf-8")
    payload: dict[str, str] = {
        "message": message,
        "content": content_b64,
        "branch": args.branch,
    }
    if sha:
        payload["sha"] = sha

    response = requests.put(api_url, headers=headers, json=payload, timeout=args.timeout)
    if response.status_code not in (200, 201):
        raise RuntimeError(f"PUT failed: {response.status_code} {response.text}")

    commit_url = response.json()["commit"]["html_url"]
    print(f"OK: {commit_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
