from __future__ import annotations

import json
import mimetypes
import os
import uuid
from pathlib import Path

import requests

TOKEN_URL = "https://api.x.com/2/oauth2/token"
POST_URL = "https://api.x.com/2/tweets"
MEDIA_UPLOAD_URL = "https://api.x.com/2/media/upload"


def get_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing env: {name}")
    return value


def refresh_access_token(client_id: str, refresh_token: str) -> dict:
    data = {
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
        "client_id": client_id,
    }
    response = requests.post(TOKEN_URL, data=data, timeout=30)
    if response.status_code >= 400:
        raise RuntimeError(f"Token refresh failed: {response.status_code} {response.text}")
    return response.json()


def set_github_output(name: str, value: str) -> None:
    output_path = os.getenv("GITHUB_OUTPUT")
    if not output_path:
        return

    delimiter = f"EOF_{uuid.uuid4().hex}"
    with open(output_path, "a", encoding="utf-8") as fp:
        fp.write(f"{name}<<{delimiter}\n{value}\n{delimiter}\n")


def mask_for_github_logs(value: str) -> None:
    if os.getenv("GITHUB_ACTIONS") == "true" and value:
        print(f"::add-mask::{value}")


def upload_image(access_token: str, image_path: str) -> str:
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Image file not found: {path}")

    media_type = mimetypes.guess_type(path.name)[0] or "image/png"
    headers = {"Authorization": f"Bearer {access_token}"}

    with path.open("rb") as fp:
        files = {
            "media": (path.name, fp, media_type),
        }
        data = {
            "media_category": "tweet_image",
            "media_type": media_type,
        }
        response = requests.post(
            MEDIA_UPLOAD_URL,
            headers=headers,
            files=files,
            data=data,
            timeout=120,
        )

    if response.status_code >= 400:
        hint = " Ensure your token includes media.write scope."
        raise RuntimeError(f"Media upload failed: {response.status_code} {response.text}.{hint}")

    body = response.json()
    media_id = body.get("data", {}).get("id") or body.get("id")
    if not media_id:
        raise RuntimeError(f"No media id in response: {body}")
    return str(media_id)


def post_tweet(access_token: str, text: str, media_id: str | None = None) -> dict:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    payload: dict[str, object] = {"text": text}
    if media_id:
        payload["media"] = {"media_ids": [media_id]}

    response = requests.post(POST_URL, headers=headers, json=payload, timeout=30)
    if response.status_code >= 400:
        raise RuntimeError(f"Post failed: {response.status_code} {response.text}")
    return response.json()


def main() -> int:
    client_id = get_env("X_CLIENT_ID")
    refresh_token = get_env("X_REFRESH_TOKEN")
    text = get_env("X_TWEET_TEXT")
    media_path = (os.getenv("X_MEDIA_PATH") or "").strip()

    token_response = refresh_access_token(client_id, refresh_token)
    access_token = token_response.get("access_token")
    if not access_token:
        raise RuntimeError(f"No access_token in response: {token_response}")

    refreshed_token = token_response.get("refresh_token")
    if isinstance(refreshed_token, str) and refreshed_token:
        mask_for_github_logs(refreshed_token)
        set_github_output("new_refresh_token", refreshed_token)
    else:
        set_github_output("new_refresh_token", "")

    media_id = upload_image(access_token, media_path) if media_path else None
    post_response = post_tweet(access_token, text, media_id=media_id)
    print(json.dumps(post_response, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
