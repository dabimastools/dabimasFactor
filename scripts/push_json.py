from __future__ import annotations

import base64
import os
from datetime import datetime
from zoneinfo import ZoneInfo

import requests

OWNER = "dabimastools"
REPO = "dabimasFactor"
BRANCH = "main"
LOCAL_FILE = "dabimasFactor.json"
DEST_PATH = "json/dabimasFactor.json"
TIMEZONE = "Asia/Tokyo"

token = os.getenv("GITHUB_TOKEN")
if not token:
    raise RuntimeError("Missing env: GITHUB_TOKEN")

today = datetime.now(ZoneInfo(TIMEZONE)).strftime("%Y-%m-%d")
api = f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{DEST_PATH}"
headers = {
    "Authorization": f"Bearer {token}",
    "Accept": "application/vnd.github+json",
}

r = requests.get(api, headers=headers, params={"ref": BRANCH}, timeout=30)
if r.status_code == 200:
    sha = r.json()["sha"]
elif r.status_code == 404:
    sha = None
else:
    raise RuntimeError(f"GET failed: {r.status_code} {r.text}")

with open(LOCAL_FILE, "rb") as f:
    content_b64 = base64.b64encode(f.read()).decode("utf-8")

payload = {
    "message": f"Update dabimasFactor.json ({today})",
    "content": content_b64,
    "branch": BRANCH,
}
if sha:
    payload["sha"] = sha

u = requests.put(api, headers=headers, json=payload, timeout=30)
if u.status_code not in (200, 201):
    raise RuntimeError(f"PUT failed: {u.status_code} {u.text}")

print("OK:", u.json()["commit"]["html_url"])
