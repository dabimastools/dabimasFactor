from __future__ import annotations

import argparse
import re
import sys

import requests
from bs4 import BeautifulSoup, Tag


def _normalize_spaces(text: str) -> str:
    # Collapse runs of whitespace while keeping readable separators.
    return re.sub(r"\s+", " ", text).strip()


def _find_latest_news_item(html: str) -> Tag:
    soup = BeautifulSoup(html, "lxml")

    target_h4: Tag | None = None
    for h4 in soup.find_all("h4"):
        if "\u65b0\u7740\u60c5\u5831" in h4.get_text(strip=True):
            target_h4 = h4
            break

    if target_h4 is None:
        raise ValueError("Failed to find the 'new information' section.")

    news_ul = target_h4.find_next_sibling("ul")
    if news_ul is None:
        raise ValueError("Failed to find the news list after the section heading.")

    first_item = news_ul.find("li")
    if first_item is None:
        raise ValueError("The first news row is missing.")

    return first_item


def extract_latest_stallions_text(html: str) -> str:
    first_item = _find_latest_news_item(html)

    stallion_names: list[str] = []
    for a_tag in first_item.find_all("a", href=True):
        href = a_tag["href"]
        if "/kouryaku/stallions/" not in href:
            continue

        name = _normalize_spaces(a_tag.get_text(" ", strip=True))
        if name:
            stallion_names.append(name)

    if not stallion_names:
        raise ValueError("No stallion entries were found in the first news row.")

    suffix = "\u3092\u8ffd\u52a0\u3057\u307e\u3057\u305f\u3002"
    return "\n".join([*stallion_names, suffix])


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Fetch only stallion names from the first row of the "
            "'new information' section and write them to a txt file."
        )
    )
    parser.add_argument(
        "--url",
        default="https://dabimas.jp/kouryaku/",
        help="Source URL (default: %(default)s)",
    )
    parser.add_argument(
        "--out",
        default="latest_stallions.txt",
        help="Output file path (default: %(default)s)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=20.0,
        help="HTTP timeout in seconds (default: %(default)s)",
    )
    args = parser.parse_args()

    response = requests.get(args.url, timeout=args.timeout)
    response.raise_for_status()

    text = extract_latest_stallions_text(response.text)

    with open(args.out, "w", encoding="utf-8") as f:
        f.write(text + "\n")

    print(f"Saved: {args.out}")
    print(text)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover - CLI fallback
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
