#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_dabimas_stream.py

Excel 依存なしで `dabimasFactor.json` を生成するスクリプト。

このスクリプトは、次の VBA パイプラインを再現する:
`getHorseData -> writeDabifacSheet -> DabifacSheetToFile`

処理の流れ:
- 一覧ページ（または `--urls-file`）から馬詳細 URL を集める。
- 各詳細ページを VBA の ALL 行レイアウト互換でパースする。
- ALL 行 1 件を dabimasFactor の JSON 1 件へ変換する。
- 必要なら確認用に sparse ALL 行を NDJSON で出力する。

出力:
- `--output`: 最終 `{"horseLists":[...]}` JSON
- `--all-output`: 任意の sparse ALL 行 NDJSON
"""

from __future__ import annotations

import argparse
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from bs4.element import Tag


# スクレイピング対象 URL。
BASE_URL = "https://dabimas.jp"
STALLION_LIST_URL = f"{BASE_URL}/kouryaku/stallions/name.html"
BROODMARE_LIST_URL = f"{BASE_URL}/kouryaku/broodmares/name.html"


# VBA の ALL シート列番号（1-based）。
# 既存 JSON 互換のため、この番号は固定。
HD_GENDER = 1
HD_SERIAL_NUMBER = 2
HD_HORSE_ID = 3
HD_RARE = 4
HD_HORSE_NAME = 5
HD_PARENT_LINE = 6
HD_FACTOR_NAME1 = 7
HD_FACTOR_NAME2 = 8
HD_FACTOR_NAME3 = 9
HD_ICON = 10
HD_DISTANCE_MIN = 11
HD_DISTANCE_MAX = 12
HD_GROWTH = 13
HD_DIRT = 14
HD_HEALTH = 15
HD_CLEMENCY = 16
HD_RUNNING_STYLE = 17
HD_ACHIEVEMENT = 18
HD_POTENTIAL = 19
HD_STABLE = 20
HD_ABILITY = 21
HD_NATURE = 22
HD_NAME_T = 23
HD_PARENT_LINE_T = 38
HD_SON_T = 53
HD_FACTOR_T1 = 68

ROW_SIZE = 112


# 因子番号 -> 1文字略称（出力 JSON で使用）。
FACTOR_SHORT_DICT = {
    1: "短",
    2: "速",
    3: "底",
    4: "長",
    5: "適",
    6: "丈",
    7: "早",
    8: "晩",
    9: "堅",
    10: "難",
    11: "走",
    12: "中",
}

# 親系統名 -> 2文字コード。
# サイト上の表記ゆれを辞書で正規化する。
PARENTAL_LINE_DICT = {
    "エクリプス系": "Ec",
    "フェアウェイ系": "Fa",
    "フェアトライアル系": "Fa",
    "オーエンテューダー系": "Ha",
    "オリオール系": "Ha",
    "カーレッド系": "Ha",
    "サンインロー系": "Ha",
    "ハイペリオン系": "Ha",
    "ハンプトン系": "Ha",
    "ファイントップ系": "Ha",
    "ロックフェラ系": "Ha",
    "クラリオン系": "He",
    "トウルビヨン系": "He",
    "ヘロド系": "He",
    "マイバブー系": "He",
    "ヒムヤー系": "Hi",
    "インテント系": "Ma",
    "マッチェム系": "Ma",
    "マンノウォー系": "Ma",
    "レリック系": "Ma",
    "エタン系": "Na",
    "ネイティヴダンサー系": "Na",
    "レイズアネイティヴ系": "Na",
    "ニアークティック系": "Ne",
    "ノーザンダンサー系": "Ne",
    "グレイソヴリン系": "Ns",
    "ゼダーン系": "Ns",
    "ソヴリンパス系": "Ns",
    "ナスルーラ系": "Ns",
    "ネヴァーセイダイ系": "Ns",
    "ネヴァーベンド系": "Ns",
    "フォルティノ系": "Ns",
    "プリンスリーギフト系": "Ns",
    "ボールドルーラー系": "Ns",
    "レッドゴッド系": "Ns",
    "ダンテ系": "Ph",
    "ネアルコ系": "Ph",
    "ファロス系": "Ph",
    "ファラリス系": "Ph",
    "ファリス系": "Ph",
    "モスボロー系": "Ph",
    "サーゲイロード系": "Ro",
    "ハビタット系": "Ro",
    "ヘイルトゥリーズン系": "Ro",
    "ロイヤルチャージャー系": "Ro",
    "セントサイモン系": "St",
    "プリンスキロ系": "St",
    "プリンスビオ系": "St",
    "プリンスローズ系": "St",
    "ボワルセル系": "St",
    "リボー系": "St",
    "ワイルドリスク系": "St",
    "スインフォード系": "Sw",
    "ブラントーム系": "Sw",
    "ブランドフォード系": "Sw",
    "ブレニム系": "Sw",
    "テディ系": "Te",
    "トムフール系": "To",
}

# 旧実装で使っていた「特殊アイコン除外」対象。
# 実測するとこの除外は VBA 実出力（2712件）と一致しないため、
# デフォルトでは無効化し、参照用にのみ残しておく。
STALLION_SKIP_ICONS_LEGACY = {
    "https://cf.dabimas.jp/kouryaku/images/stallion/list_icn_cat_13.png",
    "https://cf.dabimas.jp/kouryaku/images/stallion/list_icn_cat_whiteday_01.png",
    "https://cf.dabimas.jp/kouryaku/images/stallion/list_icn_cat_whiteday_02.png",
    "https://cf.dabimas.jp/kouryaku/images/stallion/list_icn_cat_valentine_01.png",
    "https://cf.dabimas.jp/kouryaku/images/stallion/list_icn_cat_valentine_02.png",
}
STALLION_SKIP_ICONS: set[str] = set()

SUB_NAME_RE = re.compile(r"[0-9]...|[一-龠].")
NUM_RE = re.compile(r"\D")


def safe_str(v: object) -> str:
    """None を空文字にし、前後空白を除去して返す。"""
    if v is None:
        return ""
    return str(v).strip()


def extract_numbers(text: str) -> str:
    """文字列から数字だけを抽出する。"""
    if not text:
        return ""
    return NUM_RE.sub("", text)


def normalize_src(src: str) -> str:
    """画像/リンク src を絶対 URL に正規化する。"""
    src = safe_str(src)
    if not src:
        return ""
    if src.startswith("//"):
        return "https:" + src
    if src.startswith("/"):
        return urljoin(BASE_URL, src)
    return src


def new_row() -> list[str]:
    """ALL 行バッファを作る（index 0 は未使用）。"""
    return [""] * (ROW_SIZE + 1)


def row_get(row: list[str], idx: int) -> str:
    """範囲チェック付きの安全な行アクセス。"""
    if 0 <= idx < len(row):
        return row[idx]
    return ""


def get_parent_line_name(parent_line: str) -> str:
    """親系統コード2文字を返す（Nas/Nat の揺れは吸収）。"""
    s = safe_str(parent_line)
    if not s:
        return ""
    s = s.replace("Nas", "Ns").replace("Nat", "Na")
    return s[:2]


def get_factor(url1: str, url2: str, url3: str) -> tuple[str, str, str]:
    """
    因子画像 URL を最大3件受け取り、VBA 互換の (f1, f2, f3) に並べ替える。
    ルール:
    - 1件: f3
    - 2件: f2/f3
    - 3件: f1/f2/f3
    """
    f1 = ""
    f2 = ""
    f3 = ""
    if url3:
        f1 = extract_numbers(url1)
        f2 = extract_numbers(url2)
        f3 = extract_numbers(url3)
    elif url2:
        f2 = extract_numbers(url1)
        f3 = extract_numbers(url2)
    elif url1:
        f3 = extract_numbers(url1)
    return f1, f2, f3


def get_factor_short(factor_no: str) -> str:
    """因子番号文字列を1文字略称へ変換する。"""
    if not factor_no:
        return ""
    try:
        return FACTOR_SHORT_DICT.get(int(factor_no), "")
    except ValueError:
        return ""


def get_direct_child_by_tag(parent: Optional[Tag], tag_name: str) -> Optional[Tag]:
    """指定タグの直下子要素の最初の1件を返す。"""
    if parent is None:
        return None
    return parent.find(tag_name, recursive=False)


class Fetcher:
    """リトライ付き HTTP 取得と HTML パースのラッパー。"""
    def __init__(self, timeout: float, retries: int):
        # 接続再利用のため Session を使い回す。
        self.timeout = timeout
        self.retries = retries
        self.session = requests.Session()
        self.session.headers.update(
            {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        )

    def fetch_soup(self, url: str) -> BeautifulSoup:
        """URL を取得し BeautifulSoup(lxml) でパースする。"""
        last_err: Optional[Exception] = None
        for attempt in range(1, self.retries + 1):
            try:
                r = self.session.get(url, timeout=self.timeout)
                r.raise_for_status()
                return BeautifulSoup(r.content, "lxml", from_encoding="utf-8")
            except Exception as e:  # noqa: BLE001
                last_err = e
                if attempt < self.retries:
                    time.sleep(min(0.8 * attempt, 3.0))
        raise RuntimeError(f"failed to fetch: {url}") from last_err

    def close(self) -> None:
        """HTTP セッションを明示的に閉じる。"""
        self.session.close()


def collect_horse_urls(fetcher: Fetcher) -> list[str]:
    """種牡馬/牝馬一覧から詳細 URL を収集し、重複除去して返す。"""
    urls: list[str] = []
    seen: set[str] = set()
    targets = [
        (STALLION_LIST_URL, ".stallion_list_panel > a[href]"),
        (BROODMARE_LIST_URL, ".list_panel.broodmare > a[href]"),
    ]
    valid_re = re.compile(r"^/kouryaku/(stallions|broodmares)/\d+\.html$")

    for list_url, selector in targets:
        soup = fetcher.fetch_soup(list_url)
        for a in soup.select(selector):
            href = safe_str(a.get("href"))
            if not valid_re.match(href):
                continue
            full = urljoin(BASE_URL, href)
            if full not in seen:
                seen.add(full)
                urls.append(full)
    return urls


def load_horse_urls_from_file(urls_file: Path) -> list[str]:
    """
    URL リストファイルを読み込む。
    - 絶対 URL と `/path` 形式をサポート
    - `/path` は `BASE_URL` で補完
    - 行頭の UTF-8 BOM は除去
    - 空行と `#` コメント行は無視
    """
    urls: list[str] = []
    seen: set[str] = set()
    valid_re = re.compile(r"^https?://")

    for raw_line in urls_file.read_text(encoding="utf-8").splitlines():
        line = safe_str(raw_line)
        line = line.lstrip("\ufeff")
        if not line or line.startswith("#"):
            continue
        url = urljoin(BASE_URL, line) if line.startswith("/") else line
        if not valid_re.match(url):
            raise ValueError(f"invalid url in {urls_file}: {line}")
        if url not in seen:
            seen.add(url)
            urls.append(url)

    return urls


def fill_pedigree_and_factors(row: list[str], soup: BeautifulSoup) -> None:
    """血統45件と子孫因子45枠を ALL 行へ格納する。"""
    horse_elements = soup.select(".horse")
    for i in range(min(45, len(horse_elements))):
        row[HD_NATURE + 1 + i] = safe_str(horse_elements[i].get_text())

    factor_elements = soup.select(".factor")
    for i in range(min(45, len(factor_elements))):
        img = factor_elements[i].select_one("img")
        row[HD_FACTOR_T1 + i] = normalize_src(img.get("src", "")) if img else ""


def parse_stallion(url: str, serial_no: int, soup: BeautifulSoup) -> Optional[list[str]]:
    """種牡馬詳細ページを ALL 行 1 件へ変換する。"""
    # 1) VBA と同じ DOM 前提で辿る:
    # content -> wrapper div -> detail div -> main table
    content = soup.select_one("#content")
    wrapper = get_direct_child_by_tag(content, "div")
    detail = get_direct_child_by_tag(wrapper, "div")
    main_table = get_direct_child_by_tag(wrapper, "table")
    if main_table is None:
        return None

    trs = main_table.find_all("tr")
    if len(trs) < 3:
        return None

    row0_tds = trs[0].find_all("td")
    row1_tds = trs[1].find_all("td")
    if len(row0_tds) < 2 or len(row1_tds) < 1:
        return None

    # レア星数とアイコンを取得。
    star_count = len(row0_tds[1].find_all("img"))
    icon_img = row1_tds[0].find("img")
    icon_src = normalize_src(icon_img.get("src", "")) if icon_img else ""
    # 特殊アイコンによる除外（現在デフォルト無効）。
    # 必要なら STALLION_SKIP_ICONS に対象URLを入れて有効化できる。
    if star_count != 5 and icon_src in STALLION_SKIP_ICONS:
        return None

    # ALL 行を初期化して基本項目をセット。
    row = new_row()
    row[HD_GENDER] = "0"
    row[HD_SERIAL_NUMBER] = f"{serial_no:05d}"
    row[HD_HORSE_ID] = url
    row[HD_RARE] = str(star_count)
    row[HD_ICON] = icon_src

    name_span = trs[1].find("span")
    row[HD_HORSE_NAME] = safe_str(name_span.get_text()) if name_span else ""
    pl_div = trs[2].find("div")
    row[HD_PARENT_LINE] = safe_str(pl_div.get_text()) if pl_div else ""

    # 画面上部の因子（最大3）をセット。
    factor_div = None
    divs = row0_tds[1].find_all("div")
    if divs:
        factor_div = divs[0]
    if factor_div is not None:
        imgs = factor_div.find_all("img")
        for i, img in enumerate(imgs[:3]):
            row[HD_FACTOR_NAME1 + i] = normalize_src(img.get("src", ""))

    a_tags = detail.find_all("a") if detail else []
    ability_name = ""
    if a_tags:
        p = a_tags[0].find("p")
        if p:
            ability_name = safe_str(p.get_text())
    row[HD_ABILITY] = ability_name

    # 詳細テーブル（距離・成長・各スペック）をパース。
    if detail is not None:
        detail_table = get_direct_child_by_tag(detail, "table")
        if detail_table is not None:
            drows = detail_table.find_all("tr")
            if len(drows) >= 2:
                c0 = drows[0].find_all("td")
                c1 = drows[1].find_all("td")

                if len(c0) > 0:
                    p = c0[0].find("p")
                    row[HD_DISTANCE_MIN] = safe_str(p.get_text()) if p else ""
                if len(c0) > 1:
                    p = c0[1].find("p")
                    row[HD_GROWTH] = safe_str(p.get_text()) if p else ""
                if len(c1) > 0:
                    p = c1[0].find("p")
                    row[HD_RUNNING_STYLE] = safe_str(p.get_text()) if p else ""

                for cell_idx, target_idx in (
                    (2, HD_DIRT),
                    (3, HD_HEALTH),
                    (4, HD_CLEMENCY),
                ):
                    if len(c0) > cell_idx:
                        div_imgs = c0[cell_idx].find_all("div")
                        if len(div_imgs) >= 2:
                            img = div_imgs[1].find("img")
                            row[target_idx] = normalize_src(img.get("src", "")) if img else ""

                for cell_idx, target_idx in (
                    (1, HD_ACHIEVEMENT),
                    (2, HD_POTENTIAL),
                    (3, HD_STABLE),
                ):
                    if len(c1) > cell_idx:
                        div_imgs = c1[cell_idx].find_all("div")
                        if len(div_imgs) >= 2:
                            img = div_imgs[1].find("img")
                            row[target_idx] = normalize_src(img.get("src", "")) if img else ""

        # 天性の場所はページ差異があるため、VBA と同じフォールバックで取得。
        h4_tags = detail.find_all("h4")
        if len(h4_tags) >= 2:
            p = None
            if len(a_tags) >= 2:
                p = a_tags[1].find("p")
            elif len(a_tags) >= 1:
                p = a_tags[0].find("p")
            if p:
                row[HD_NATURE] = safe_str(p.get_text())

    # 血統45件 + 因子45件を埋める。
    fill_pedigree_and_factors(row, soup)
    return row


def parse_broodmare(url: str, serial_no: int, soup: BeautifulSoup) -> Optional[list[str]]:
    """牝馬詳細ページを ALL 行 1 件へ変換する。"""
    # 牝馬ページは種牡馬ページと詳細構造が異なる。
    content = soup.select_one("#content")
    wrapper = get_direct_child_by_tag(content, "div")
    detail = get_direct_child_by_tag(wrapper, "div")
    if detail is None:
        return None

    # 行を初期化し、基本識別子をセット。
    row = new_row()
    row[HD_GENDER] = "1"
    row[HD_SERIAL_NUMBER] = f"{serial_no:05d}"
    row[HD_HORSE_ID] = url

    # レア情報は detail 配下の 4番目の <p>。
    p_tags = detail.find_all("p")
    if len(p_tags) >= 4:
        row[HD_RARE] = safe_str(p_tags[3].get_text())

    bm_table = get_direct_child_by_tag(detail, "table")
    if bm_table is None:
        return None
    trs = bm_table.find_all("tr")
    if not trs:
        return None

    # 馬名とアイコンは先頭行にある。
    tds = trs[0].find_all("td")
    if len(tds) > 1:
        span = tds[1].find("span")
        row[HD_HORSE_NAME] = safe_str(span.get_text()) if span else ""
    if len(tds) > 0:
        img = tds[0].find("img")
        row[HD_ICON] = normalize_src(img.get("src", "")) if img else ""

    detail_div = get_direct_child_by_tag(detail, "div")
    row[HD_PARENT_LINE] = safe_str(detail_div.get_text()) if detail_div else ""

    fill_pedigree_and_factors(row, soup)
    return row


def all_row_to_dabifac_entry(row: list[str]) -> dict:
    """ALL 行1件を dabimasFactor JSON 1件へ変換する。"""
    # 入力は ALL レイアウト互換の配列。
    horse_name = row_get(row, HD_HORSE_NAME)

    # 馬名の接尾情報（年号/因名）を subName に分離。
    sub_name = ""
    pure_name = horse_name
    m = SUB_NAME_RE.search(horse_name)
    if m:
        sub_name = m.group(0)
        pure_name = horse_name.replace(sub_name, "").replace("-", "")

    parent_line_raw = row_get(row, HD_PARENT_LINE)

    f1, f2, f3 = get_factor(
        row_get(row, HD_FACTOR_NAME1),
        row_get(row, HD_FACTOR_NAME2),
        row_get(row, HD_FACTOR_NAME3),
    )

    # 固定オフセット列から子孫15件を構築。
    descendants = []
    for i in range(15):
        n = row_get(row, HD_NAME_T + i)
        pl = get_parent_line_name(row_get(row, HD_PARENT_LINE_T + i))
        son = row_get(row, HD_SON_T + i)
        df1, df2, df3 = get_factor(
            row_get(row, HD_FACTOR_T1 + i * 3),
            row_get(row, HD_FACTOR_T1 + i * 3 + 1),
            row_get(row, HD_FACTOR_T1 + i * 3 + 2),
        )
        descendants.append(
            {
                "name": n,
                "parentLine": pl,
                "son": son,
                "factors": [
                    get_factor_short(df1),
                    get_factor_short(df2),
                    get_factor_short(df3),
                ],
            }
        )

    # 親系統コードは辞書優先、見つからなければ2文字化で補完。
    return {
        "name": pure_name,
        "subName": sub_name,
        "nature": row_get(row, HD_NATURE),
        "sex": row_get(row, HD_GENDER),
        "parentLine": PARENTAL_LINE_DICT.get(parent_line_raw.strip(), get_parent_line_name(parent_line_raw)),
        "son": parent_line_raw,
        "factors": [
            get_factor_short(f1),
            get_factor_short(f2),
            get_factor_short(f3),
        ],
        "descendants": descendants,
    }


def all_row_to_sparse_dict(row: list[str]) -> dict[str, str]:
    """非空列のみを持つ sparse dict に変換する。"""
    return {str(i): row[i] for i in range(1, ROW_SIZE + 1) if row[i] != ""}


def main(argv: Optional[list[str]] = None) -> int:
    """CLI エントリポイント。成功時0、`--fail-on-error` 条件で1を返す。"""
    # CLI の流れ: 引数解析 -> URL収集 -> ページ解析 -> 出力書き込み。
    # CI でも再現しやすいよう、引数は明示的に定義している。
    parser = argparse.ArgumentParser(
        description="Excel 依存なしで dabimasFactor.json を生成する。"
    )
    parser.add_argument("--output", default="dabimasFactor.json", help="出力 JSON パス。")
    parser.add_argument(
        "--all-output",
        default=None,
        help="任意: ALL 行 sparse NDJSON の出力パス。",
    )
    parser.add_argument(
        "--urls-file",
        default=None,
        help="任意: URL リストファイル（1行1URL、絶対URLまたは /kouryaku/...）。",
    )
    parser.add_argument("--limit", type=int, default=0, help="先頭 N 件のみ処理（0=全件）。")
    parser.add_argument("--workers", type=int, default=8, help="並列フェッチ数（デフォルト8）。")
    parser.add_argument("--delay", type=float, default=0.3, help="馬ごとの待機秒数。")
    parser.add_argument("--timeout", type=float, default=30.0, help="HTTP タイムアウト秒。")
    parser.add_argument("--retries", type=int, default=3, help="HTTP リトライ回数。")
    parser.add_argument("--progress", type=int, default=100, help="進捗表示間隔。")
    parser.add_argument(
        "--fail-on-error",
        action="store_true",
        help="取得/解析エラーが1件でもあれば終了コード1にする。",
    )
    args = parser.parse_args(argv)

    output_path = Path(args.output)
    all_output_path = Path(args.all_output) if args.all_output else None
    urls_file = Path(args.urls_file) if args.urls_file else None

    # 出力前に親ディレクトリを作成する。
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if all_output_path is not None:
        all_output_path.parent.mkdir(parents=True, exist_ok=True)

    # URL 取得元の優先順位:
    # 1) --urls-file（明示指定）
    # 2) 一覧ページから自動収集
    fetcher = Fetcher(timeout=args.timeout, retries=args.retries)
    if urls_file is not None:
        urls = load_horse_urls_from_file(urls_file)
    else:
        urls = collect_horse_urls(fetcher)
    if args.limit > 0:
        urls = urls[: args.limit]

    workers = max(1, args.workers)

    print(f"target urls: {len(urls)}")
    print(f"output: {output_path}")
    print(f"workers: {workers}")
    if urls_file is not None:
        print(f"urls-file: {urls_file}")
    if all_output_path:
        print(f"all-output: {all_output_path}")

    written = 0
    skipped = 0
    errors = 0
    stallion_last_name = ""
    stallion_last_ability = ""

    all_fp = all_output_path.open("w", encoding="utf-8", newline="\n") if all_output_path else None

    def _fetch_and_parse(idx: int, url: str) -> tuple[int, str, Optional[list[str]], Optional[str]]:
        """ワーカースレッドで実行: フェッチ＋パースして (idx, url, row, error) を返す。"""
        try:
            soup = fetcher.fetch_soup(url)
            if "/broodmares/" in url:
                row = parse_broodmare(url, idx, soup)
            else:
                row = parse_stallion(url, idx, soup)
            if args.delay > 0:
                time.sleep(args.delay)
            return idx, url, row, None
        except Exception as e:  # noqa: BLE001
            return idx, url, None, str(e)

    try:
        with output_path.open("w", encoding="utf-8", newline="\n") as out:
            out.write('{"horseLists":[')
            first = True

            # バッチ単位で並列フェッチし、元の URL 順で書き出す。
            batch_size = workers * 2
            for batch_start in range(0, len(urls), batch_size):
                batch_urls = urls[batch_start:batch_start + batch_size]
                # バッチ内の結果を idx 順に格納するバッファ。
                results: dict[int, tuple[str, Optional[list[str]], Optional[str]]] = {}

                with ThreadPoolExecutor(max_workers=workers) as pool:
                    futures = {
                        pool.submit(_fetch_and_parse, batch_start + i + 1, url): batch_start + i + 1
                        for i, url in enumerate(batch_urls)
                    }
                    for future in as_completed(futures):
                        idx, url, row, err = future.result()
                        results[idx] = (url, row, err)

                # 元の URL 順で逐次書き出し（重複スキップロジックを維持）。
                for i in range(len(batch_urls)):
                    idx = batch_start + i + 1
                    url, row, err = results[idx]

                    if err is not None:
                        errors += 1
                        print(f"[error] {url}: {err}")
                        continue

                    if row is None:
                        skipped += 1
                        continue

                    # VBA 互換: 種牡馬は「馬名 + 非凡」が連続重複ならスキップ。
                    if row_get(row, HD_GENDER) == "0":
                        current_name = row_get(row, HD_HORSE_NAME)
                        current_ability = row_get(row, HD_ABILITY)
                        if current_name == stallion_last_name and current_ability == stallion_last_ability:
                            skipped += 1
                            continue
                        stallion_last_name = current_name
                        stallion_last_ability = current_ability

                    entry = all_row_to_dabifac_entry(row)
                    serialized = json.dumps(entry, ensure_ascii=False, separators=(",", ":"))
                    if not first:
                        out.write(",")
                    out.write(serialized)
                    first = False

                    if all_fp is not None:
                        all_fp.write(
                            json.dumps(all_row_to_sparse_dict(row), ensure_ascii=False, separators=(",", ":"))
                            + "\n"
                        )

                    written += 1
                    if args.progress > 0 and written % args.progress == 0:
                        print(f"processed: {written} (source index {idx})")

            out.write("]}\n")

    finally:
        if all_fp is not None:
            all_fp.close()
        fetcher.close()

    print(f"done: written={written}, skipped={skipped}, errors={errors}")
    if args.fail_on_error and errors > 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
