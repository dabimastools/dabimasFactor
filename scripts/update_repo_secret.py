from __future__ import annotations

import argparse
import base64
import os

import requests
from nacl import encoding, public


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Update a repository Actions secret via GitHub REST API.")
    parser.add_argument("--repo", default=os.getenv("GITHUB_REPOSITORY", ""), help="owner/repo")
    parser.add_argument("--secret-name", required=True)
    parser.add_argument("--secret-value", default="")
    parser.add_argument("--secret-value-env", default="")
    parser.add_argument("--token-env", default="GH_SECRETS_TOKEN")
    parser.add_argument("--timeout", type=float, default=30.0)
    return parser.parse_args()


def resolve_secret_value(secret_value: str, secret_value_env: str) -> str:
    if secret_value:
        return secret_value
    if secret_value_env:
        return require_env(secret_value_env)
    raise RuntimeError("Either --secret-value or --secret-value-env is required")


def get_repo_public_key(owner: str, repo: str, headers: dict[str, str], timeout: float) -> tuple[str, str]:
    url = f"https://api.github.com/repos/{owner}/{repo}/actions/secrets/public-key"
    response = requests.get(url, headers=headers, timeout=timeout)
    if response.status_code != 200:
        raise RuntimeError(f"Public key fetch failed: {response.status_code} {response.text}")
    body = response.json()
    return body["key_id"], body["key"]


def encrypt_secret(public_key_b64: str, secret_value: str) -> str:
    public_key = public.PublicKey(public_key_b64.encode("utf-8"), encoding.Base64Encoder())
    sealed_box = public.SealedBox(public_key)
    encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))
    return base64.b64encode(encrypted).decode("utf-8")


def update_repo_secret(
    owner: str,
    repo: str,
    secret_name: str,
    encrypted_value: str,
    key_id: str,
    headers: dict[str, str],
    timeout: float,
) -> None:
    url = f"https://api.github.com/repos/{owner}/{repo}/actions/secrets/{secret_name}"
    payload = {
        "encrypted_value": encrypted_value,
        "key_id": key_id,
    }
    response = requests.put(url, headers=headers, json=payload, timeout=timeout)
    if response.status_code not in (201, 204):
        raise RuntimeError(f"Secret update failed: {response.status_code} {response.text}")


def main() -> int:
    args = parse_args()
    if not args.repo:
        raise RuntimeError("Missing repo. Set --repo or GITHUB_REPOSITORY")

    owner, repo = split_owner_repo(args.repo)
    token = require_env(args.token_env)
    secret_value = resolve_secret_value(args.secret_value, args.secret_value_env)

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    key_id, public_key = get_repo_public_key(owner, repo, headers, args.timeout)
    encrypted_value = encrypt_secret(public_key, secret_value)
    update_repo_secret(owner, repo, args.secret_name, encrypted_value, key_id, headers, args.timeout)
    print(f"Updated secret: {args.secret_name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
