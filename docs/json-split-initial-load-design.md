# JSON 分割による初期ロード軽量化 詳細設計案

## 目的

`json/dabimasFactor.json` の初期読み込みを軽くし、画面の初期表示を早くする。

ただし、以下は落とさない。

- 既存の血統選択、血統展開、因子計算、クロス判定、配合理論表示
- localStorage / IndexedDB からの配合復元
- オフライン利用
- 将来的な自家製種牡馬・自家製牝馬の保存と再利用
- 自家製馬に手動で付けた因子の継承

## 背景

現在は `dbinitializer()` が `json/dabimasFactor.json` を丸ごと読み込み、候補リストを作っている。

対象箇所:

- `index.html` / `index.exp.html`
  - `dbinitializer()`
  - `onChangeMain()`
  - `setDataForPedigree()`
  - `restoreInputData()`
  - localStorage 保存処理
- `scripts/build_dabimas_stream.py`
- `service-worker.js`
- `.github/workflows/*.yml`
- `vue/CombinationDialog.js`

現状データの概算:

| 項目 | サイズ |
| --- | ---: |
| `json/dabimasFactor.json` | 約 4.8MB |
| `descendants` 部分 | 約 4.27MB |
| summary 想定 | 約 0.84MB |
| detail 全体想定 | 約 4.34MB |

ローカル Node 計測の参考値:

| 処理 | 中央値 |
| --- | ---: |
| full JSON parse | 約 35ms |
| summary JSON parse | 約 4ms |
| detail 全体 parse | 約 31ms |
| 1頭分 detail parse | ほぼ 0ms |

この計測はブラウザ実機の値ではない。実機では通信、キャッシュ、メインスレッド負荷、端末性能の影響を受ける。

補足: 初期化の主スレッド処理（`Object.freeze` ループ、各種配列構築）は entry 件数に比例するため、summary 化しても件数自体は変わらず、JS 実行時間は大きくは縮まない。本施策の主な効果は次の 2 点。

- 転送量の削減（約 4.8MB → 約 0.84MB）。低速モバイル回線で効く。
- メモリ削減（descendants 約 4.27MB を初期にロードしない）。低スペック端末で効く。

## 現状コード突き合わせメモ（レビュー反映）

実コードと突き合わせた結果、設計に反映すべき指摘を以下にまとめる。各論は後続セクションにも反映済み。

### 指摘 A（最重要）: `id` は「出力連番」ではなく安定キーにする

`x_post.yml` はデータを定期的に再生成・commit する。`build_dabimas_stream.py` は `horseLists` を URL 収集順で書き出すだけなので、元サイトの馬の増減・並び替えで「同じ馬の連番」がズレる。

連番 `id` を join key にすると、再生成のたびに以下が別の馬を指す危険がある。

- 保存済み `dabimasFactor` snapshot の `id`
- `dabimasCustomHorses` が参照する base 馬の `id`

対策: `parse_stallion()` / `parse_broodmare()` が既に持つ詳細ページ URL（`row[HD_HORSE_ID]`）から安定 `id` を導出する。URL 内の数値（例 `/kouryaku/stallions/12345.html`）を使えば再生成に強く、調査で見つかった同名重複（アドマイヤムーン等）も URL で正しく区別できる。

注意: URL は馬の識別子としては安定だが、種牡馬の連続重複スキップ（`name + ability` 一致でスキップ）後も一意である必要がある。`sex` 接頭 + URL 数値などで衝突しない `id` を設計する。

### 指摘 B: `getHorseDetailChunkIndex(horseId)` は持たない

summary が各馬に `detailChunk` を持つなら、id から chunk を計算する必要はない。`horse.detailChunk` を読むだけにする。id 由来の計算にすると、指摘 A の不安定さが chunk 割当にも波及する。chunk 番号自体は生成時の並び順由来でよい（summary に焼き込むため）。

### 指摘 C: service worker は既に runtime cache 済み

現 `service-worker.js` の fetch ハンドラは、同一オリジン GET 全てを network-first で取得し `updateCache()` で都度キャッシュしている。したがって detail chunk は追加コードなしで runtime cache される。案 B 採用時の SW 変更は「`urlsToCache` に summary を足す（移行後に full json を外す）」だけで足りる。

また install は `cache.addAll(urlsToCache)` でアトミックに動くため、案 A のように全 chunk を入れると 1 ファイルの 404 で install 全体が失敗する。これは案 B を推奨する技術的根拠でもある。

### 指摘 D: CombinationDialog に `dabimasCustomHorses` を含める

`vue/CombinationDialog.js` の `saveConfig()` は 6 キーだけを IndexedDB に保存する。custom horse を使った配合を保存 → 別端末・クリア後に復元すると detail が失われる。`dabimasCustomHorses` を save/restore 双方に追加する必要がある（指摘 D は「8. 自家製馬保存」と連動）。

### 指摘 E: `ensureHorseDetail` に null ガードと旧データ経路

chunk に id が無い場合 `detailMap.get(horse.id).descendants` は throw する。旧 snapshot（id 無し・descendants 無し）復元時に該当する。null ガードと、旧 `descendants` があればそれを使うフォールバックを入れる。

### 指摘 F: hydration はセル状態を壊す前に行う

現 `onChangeMain()` は先に `clearManualInbreedForIndex()` → `deleteHorses()` を実行してから血統を構築する。detail 補完を後ろに差し込むと、await 中やネットワーク失敗時に既存セルが消えたまま復帰できない。`ensureHorseDetail()` は state 変更前（関数先頭）で await し、失敗時は何も変更しないトランザクション的順序にする。

### 指摘 G: その他

- 現 `dbinitializer()` に `.catch` が無い。summary 化と同時にエラー処理＋ full JSON fallback を明示する。
- summary 馬は `Object.freeze` 済み。`ensureHorseDetail()` は新オブジェクトを返すので問題ないが、「freeze 済みオブジェクトを直接 mutate しない」を実装ルールにする。
- 現状 localStorage の `selected` に `descendants` が入るのは主役セル（index 0 と 16）だけ。descendant slot は `name/parentLine/son/factors` のみ。軽量化と旧データ互換の対象は実質この 2 セル。
- `index.html` と `index.exp.html` は同一変更が必要な二重メンテ。差分ドリフトに注意（`.claude/worktrees/` 配下のコピーは対象外）。

## 現状実装の依存関係

### 初期化

`dbinitializer()` は `json/dabimasFactor.json` を読み込み、以下を作る。

- `horsesBase`
- `horses`
- `stallionsBase`
- `stallions`
- `broodmaresBase`
- `broodmares`
- `horseDataLists`

この時点で全馬の `descendants` もメモリに乗る。

### 選択時

`onChangeMain()` は選択された `horseData` を `setDataForPedigree()` に渡す。

`setDataForPedigree()` は `horseData.descendants[0..14]` を直接参照する。

つまり、候補リストに表示される馬は、選択時までに `descendants` を持っている必要がある。

### 復元

`restoreInputData()` は localStorage の `dabimasFactor` を復元する。

現在は保存済み `selected` を候補リストにも足している。ここに `descendants` が無い馬を混ぜると、再選択時に `setDataForPedigree()` が壊れる可能性がある。

### 配合保存

`vue/CombinationDialog.js` は localStorage の文字列をそのまま IndexedDB に保存する。

したがって localStorage の保存形式を変える場合は、配合保存・復元にも影響する。

ただし現状の `saveConfig()` が保存するのは 6 キー（`dabimasFactor` / `dabimasFactorCategory` / `dabimasMemo` / `dabimasMemoStallion` / `dabimasMemoBroodmare` / `dabimasManualInbreed`）だけで、`dabimasCustomHorses` は含まれない。custom horse を使った配合を別端末・クリア後に復元すると detail が失われるため、`dabimasCustomHorses` を save/restore 双方に追加する必要がある（指摘 D）。

## 設計方針

単純に `descendants` を削除するのではなく、用途を分離する。

1. 初期表示・検索用の軽い summary を読む。
2. 血統展開に必要な detail は、選択前または選択時に補完する。
3. detail は全体 1 ファイルではなく chunk に分割する。
4. 通常馬 detail と自家製馬 detail を別管理にする。
5. localStorage の画面復元データは軽量化するが、自家製馬ライブラリには再利用に必要な detail を保存する。

## データ設計

### ファイル構成

推奨構成:

```text
json/
  dabimasFactor.summary.json
  dabimasFactor.details.000.json
  dabimasFactor.details.001.json
  ...
  brosData.json
  inbreed-exceptions.json
```

detail chunk は 128 件単位を推奨する。

理由:

- 64件: 1 chunk は軽いがファイル数が多い
- 128件: 最大約 200KB でバランスが良い
- 256件: 最大約 400KB で初回選択時の待ちがやや大きい
- 512件: 最大約 790KB で選択時遅延が目立つ可能性がある

現データ 2,843 件なら 128 件単位で 23 chunk 程度。

### summary schema

```json
{
  "version": 1,
  "chunkSize": 128,
  "horseLists": [
    {
      "id": 0,
      "detailChunk": 0,
      "name": "ノーザンダンサー",
      "ruby": "のーざんだんさー",
      "subName": "",
      "nature": "",
      "sex": "0",
      "parentLine": "Ne",
      "son": "ノーザンダンサー系",
      "factors": ["", "", ""],
      "displayName": "ノーザンダンサー",
      "searchText": "のーざんだんさー|ノーザンダンサー|..."
    }
  ]
}
```

`id` は必須。既存フィールドだけでは重複があるため、`name/subName/nature/sex/factors` の組み合わせをキーにしてはいけない。

さらに `id` は出力連番にしてはいけない（指摘 A 参照）。再生成で並びが変わると別の馬を指す。詳細ページ URL から導出した安定 `id` を使う。`detailChunk` は summary に焼き込み、アプリ側は `horse.detailChunk` を直接読む（id から計算しない＝指摘 B）。

調査では同一キー重複が存在した。

例:

- `アドマイヤムーン|||0|,,`
- `キタサンブラック|||0|,,長`
- その他

### detail chunk schema

```json
{
  "version": 1,
  "chunkIndex": 0,
  "horseDetails": [
    {
      "id": 0,
      "descendants": [
        {
          "name": "...",
          "parentLine": "...",
          "son": "...",
          "factors": ["", "", ""]
        }
      ]
    }
  ]
}
```

`descendants` は現行互換の 15 件を維持する。

## 自家製馬と descendants の扱い

### 重要な前提

`descendants` は「その馬自身」ではなく「その馬の先祖 15 件」。

自家製種牡馬に手動で付けた因子は、まずその馬自身の `factors` に入る。

その自家製種牡馬をさらに次世代の配合で使った場合、次世代馬の `descendants` の中に、その自家製種牡馬が先祖として入り、その時点の `factors` も保存されるべき。

### localStorage を分ける

画面復元用と再利用用を分ける。

#### 画面復元用

キー:

```text
dabimasFactor
dabimasFactorCategory
dabimasMemo
dabimasMemoStallion
dabimasMemoBroodmare
dabimasManualInbreed
```

ここには「今の32セル表示を復元するための軽量 snapshot」を保存する。

原則として `descendants` は保存しない。

#### 自家製馬ライブラリ用

新規キー案:

```text
dabimasCustomHorses
```

保存例:

```json
[
  {
    "id": "custom-20260620-xxxxx",
    "source": "custom",
    "name": "★１薄め...",
    "ruby": "",
    "subName": "",
    "nature": "",
    "sex": "0",
    "parentLine": "Ro",
    "son": "ヘイルトゥリーズン系",
    "factors": ["短", "速", ""],
    "descendants": [
      {
        "name": "...",
        "parentLine": "...",
        "son": "...",
        "factors": ["", "", ""]
      }
    ],
    "createdAt": "2026-06-20T00:00:00.000Z"
  }
]
```

自家製馬を「候補として再利用する」場合は、この `descendants` が必要。

したがって、「localStorage に descendants を保存しない」は `dabimasFactor` の話であり、`dabimasCustomHorses` には保存する。

## 実装修正案

### 1. 生成スクリプト

対象:

- `scripts/build_dabimas_stream.py`
- `tests/test_build_dabimas_stream.py`
- `.github/workflows/build-dabimas-stream.yml`
- `.github/workflows/x_post.yml`

追加する機能:

- `--summary-output json/dabimasFactor.summary.json`
- `--details-output-dir json/details`
- `--detail-chunk-size 128`

または既存 `--output` を維持しつつ、追加オプションで分割ファイルも出す。

推奨:

既存 `json/dabimasFactor.json` は移行期間だけ残す。新実装が安定したら削除または fallback 用にする。

生成時の処理:

1. `all_row_to_dabifac_entry()` は従来通り full entry を作る。
2. `id` を付与する。出力連番ではなく、詳細ページ URL（`row[HD_HORSE_ID]`、`parse_stallion()` / `parse_broodmare()` で既に取得済み）から導出した安定 `id` にする（指摘 A）。例: `sex` 接頭 + URL 内数値。再生成で並びが変わっても同じ馬に同じ `id` を割り当てられる。
3. `detailChunk` は生成時の並び順 + `chunkSize` から決め、summary に焼き込む。アプリは id から計算しない（指摘 B）。
4. summary には `descendants` を含めない。
5. details には `id` と `descendants` だけ入れる。details 側も `id` で引けるよう map 化前提にする。
6. `displayName` と `searchText` を生成時に持たせる。

`id` 一意性の注意: 種牡馬の連続重複スキップ（`name + ability` 一致でスキップ）後も `id` が衝突しないこと。URL 由来 + `sex` 接頭で衝突回避する。テストで一意性を保証する（テスト計画参照）。

### 2. アプリ側データ読み込み

対象:

- `index.html`
- `index.exp.html`

追加する data:

```js
horseDetailChunks: {},
horseDetailChunkPromises: {},
customHorseDetails: {},
horseSummaryLoaded: false,
horseDetailPreloadStarted: false
```

追加する methods:

```js
normalizeHorseSummary(horse)
getHorseDetailChunkIndex(horseId)
fetchHorseDetailChunk(chunkIndex)
ensureHorseDetail(horse)
hydrateHorseWithDetail(horse)
prefetchHorseDetails()
loadCustomHorseDetails()
getCustomHorseDetail(customHorseId)
stripHorseForStorage(horse)
```

`dbinitializer()` の変更:

現状:

```js
fetch("./json/dabimasFactor.json")
```

変更後:

```js
fetch("./json/dabimasFactor.summary.json")
```

summary 読み込み後:

- `horsesBase`
- `horses`
- `stallionsBase`
- `stallions`
- `broodmaresBase`
- `broodmares`
- `horseDataLists`

を作る。

`descendants` はこの時点では持たない。

### 3. 選択処理

対象:

- `onChangeMain()`
- `setDataForPedigree()`

`onChangeMain()` は現在 async なので、そのまま detail 補完を差し込める。

ただし現状は先頭で `clearManualInbreedForIndex()` → `deleteHorses()` を実行してから血統を構築している。detail 補完を後ろに置くと、await 中やネットワーク失敗時に既存セルが消えたまま復帰できない。そこで hydration を state 変更前に行う（指摘 F）。

変更案:

```js
onChangeMain: async function (sex, id, horseData) {
  // state を壊す前に detail を確定させる（失敗時は何もしない）
  let hydratedHorseData = null;
  if (horseData) {
    try {
      hydratedHorseData = await this.ensureHorseDetail(horseData);
    } catch (e) {
      // ここで再試行可能なメッセージを出して return（既存セルは保持）
      return;
    }
  }

  // ここから既存の clear / delete / 構築処理
  ...
  if (hydratedHorseData) {
    const dataForPedigree = this.setDataForPedigree(sex, id, hydratedHorseData);
    this.setPedigree(sex, id, dataForPedigree);
  } else {
    this.deleteHorses(sex, id);
  }
  ...
}
```

`setDataForPedigree()` の入口で防御も入れる。

```js
if (!Array.isArray(horseData?.descendants) || horseData.descendants.length !== 15) {
  throw new Error("Horse detail is not loaded.");
}
```

UI 対策:

- detail 取得中は対象セルだけ選択中状態を出す
- 取得失敗時は alert ではなく、再試行可能なメッセージを出す
- `onChangeMain()` の途中で二重選択されないよう、対象 index を loading map で管理する

### 4. detail 取得

通常馬:

```js
ensureHorseDetail(horse) {
  // 旧 snapshot 互換: 既に descendants を持つならそのまま使う
  if (Array.isArray(horse?.descendants) && horse.descendants.length === 15) {
    return Promise.resolve(horse);
  }
  if (horse?.source === "custom" || horse?.customHorseId) {
    return this.getCustomHorseDetail(horse.customHorseId || horse.id);
  }
  // detailChunk は summary 由来をそのまま使う（id から計算しない = 指摘 B）
  return this.fetchHorseDetailChunk(horse.detailChunk).then(detailMap => {
    const detail = detailMap.get(horse.id);
    // chunk に id が無い旧データ等はガードして握りつぶさない（指摘 E）
    if (!detail || !Array.isArray(detail.descendants)) {
      return Promise.reject(new Error("Horse detail not found: " + horse.id));
    }
    // freeze 済み summary を直接 mutate せず新オブジェクトで返す（指摘 G）
    return { ...horse, descendants: detail.descendants };
  });
}
```

chunk fetch は Promise cache する。

```js
fetchHorseDetailChunk(chunkIndex) {
  if (this.horseDetailChunks[chunkIndex]) {
    return Promise.resolve(this.horseDetailChunks[chunkIndex]);
  }
  if (this.horseDetailChunkPromises[chunkIndex]) {
    return this.horseDetailChunkPromises[chunkIndex];
  }
  this.horseDetailChunkPromises[chunkIndex] = fetch(...)
    .then(...)
    .then(map => {
      this.$set(this.horseDetailChunks, chunkIndex, map);
      return map;
    });
  return this.horseDetailChunkPromises[chunkIndex];
}
```

### 5. prefetch

summary 読み込み後、画面初期表示を邪魔しないタイミングで detail chunk を事前取得する。

推奨:

- `requestIdleCallback` があれば使う
- 無ければ `setTimeout(..., 1000)` で開始
- 1 chunk ずつ順番に読む
- 途中でユーザーが選択した場合は `ensureHorseDetail()` を優先

注意:

全 chunk を一気に `Promise.all` しない。

理由:

- ネットワークを占有する
- low-end 端末で parse が集中する
- 初期表示の軽量化メリットが消える

### 6. localStorage 保存

対象:

- `onChangeMain()` の `localStorage.setItem("dabimasFactor", ...)`
- `applyManualFactors()`
- `restoreInputData()`
- `CombinationDialog.js`

保存前に lightweight 化する。

```js
serializeSelectedForStorage(selected) {
  return selected.map(horse => horse ? this.stripHorseForStorage(horse) : null);
}
```

通常馬に保存する情報:

```js
{
  id,
  source: "base",
  name,
  ruby,
  subName,
  nature,
  sex,
  parentLine,
  son,
  factors,
  disabled,
  selectedHorse,
  uuid,
  selfSelected,
  fullBrothers,
  fullSisters,
  childName,
  index
}
```

保存しない:

```js
descendants
searchText
displayName
```

ただし既存保存データに `descendants` が入っている場合は、そのまま読めるようにする。移行時に破棄してはいけない。

### 7. 復元処理

`restoreInputData()` は次の順にする。

1. summary 読み込み完了を待つ
2. localStorage の `dabimasFactor` を読む
3. 各セルは軽量 snapshot として復元
4. 候補リストに足す自家製/disabled 馬は `descendants` の有無を問わず表示できるようにする
5. その馬が再選択されたときに `ensureHorseDetail()` で補完する

既存データ互換:

- `descendants` を持つ旧保存データはそのまま使える
- `id` を持たない旧保存データは、表示復元だけは行う
- 再選択対象にする場合は `name/subName/sex/factors` などから summary 側を探す。ただし重複があるため完全保証はしない
- 将来的には custom horse store へ移行保存する導線を作る

### 8. 自家製馬保存

今回の JSON 分割対応で必ず custom horse UI まで作る必要はない。

ただし、保存形式と helper は先に用意する。

必要 helper:

```js
buildCustomHorseFromSelected(rowIndex)
buildDescendantsFromSelected(rowIndex)
saveCustomHorse(customHorse)
loadCustomHorses()
```

設計上のルール:

- 自家製馬自身の手動因子は top-level `factors` に保存する
- その馬を先祖として使う次世代馬の `descendants` には、その時点の `factors` を含める
- custom horse の detail は `dabimasCustomHorses` から取得する
- `CombinationDialog.js` の `saveConfig()` / `restoreConfig()` に `dabimasCustomHorses` を追加する（指摘 D）。これを忘れると custom horse を含む配合が別端末・クリア後に壊れる

## service worker 設計

対象:

- `service-worker.js`

選択肢:

### 案 A: install 時に全 detail chunk を cache

メリット:

- 初回 install 完了後は offline で安定
- 選択時 fetch が cache hit しやすい

デメリット:

- 初回訪問時に結局全 detail を取りに行く
- install が重くなる
- 初期軽量化の通信メリットが弱くなる

### 案 B: summary だけ install cache、detail は runtime cache

メリット:

- 初期表示が軽い
- 未使用 detail を読まない

デメリット:

- 初回選択時に未取得 chunk を待つ可能性
- 初回 visit 直後に offline になると未取得 detail は使えない

### 推奨

案 B を基本にし、アプリ側で background prefetch する。

つまり:

- install cache: summary, app shell, CSS/JS, small JSON
- runtime cache: detail chunk
- app idle: detail chunk を順次 prefetch

これなら初期表示を軽くしつつ、使っているうちに offline 耐性も上がる。

実装上の注意（指摘 C）: 現 `service-worker.js` の fetch ハンドラは同一オリジン GET 全てを network-first で取得し `updateCache()` で都度キャッシュしている。よって detail chunk の runtime cache は追加コード不要で機能する。案 B での SW 変更は実質次だけ。

- `urlsToCache` に `dabimasFactor.summary.json` を追加
- 移行が安定したら `urlsToCache` から full `dabimasFactor.json` を外す
- `CACHE_NAME` を更新（既存どおりデプロイ毎に bump）

`urlsToCache` は install 時に `cache.addAll()` でアトミックに取得される。全 detail chunk をここに入れる（案 A）と 1 ファイルの 404 で install 全体が失敗するため、chunk は install cache に入れない。

## CI / 自動更新

### `.github/workflows/x_post.yml`

現在は `json/dabimasFactor.json` だけを生成・commit している。

変更後:

```sh
python scripts/build_dabimas_stream.py \
  --output json/dabimasFactor.json \
  --summary-output json/dabimasFactor.summary.json \
  --details-output-dir json/dabimasFactor-details \
  --detail-chunk-size 128 \
  --progress 200 \
  --fail-on-error
```

`git add` 対象:

```sh
git add \
  .github/state/latest_news_snapshot.txt \
  json/dabimasFactor.json \
  json/dabimasFactor.summary.json \
  json/dabimasFactor-details \
  service-worker.js
```

### `.github/workflows/build-dabimas-stream.yml`

artifact に分割 JSON も含める。

### push_json scripts

`scripts/push_json.py` と `scripts/push_json_action.py` は単一ファイル upload 前提。

今後も使うなら複数ファイル対応が必要。

使っていないなら README またはコメントで非推奨扱いにする。

## 懸念と対案

### 懸念 1: 初期ロードは早くなるが、選択時に遅くなるのでは

対案:

- detail 全体 1 ファイル遅延読み込みはしない
- 128 件単位の chunk にする
- Promise cache する
- summary 読み込み後に idle prefetch する
- 選択時は対象 chunk だけ待つ

結論:

未取得 chunk の初回選択だけ短い待ちが発生し得る。通常は background prefetch と cache hit で抑える。

### 懸念 2: 自家製種牡馬・自家製牝馬を流用したい

対案:

- 画面復元用 `dabimasFactor` と再利用用 `dabimasCustomHorses` を分ける
- custom horse には `descendants` を保存する
- 通常馬 detail は chunk から取得する
- custom horse detail は localStorage / IndexedDB から取得する

結論:

`descendants` を完全に捨てるのではなく、保存場所を分ける。

### 懸念 3: 自家製馬に付けた因子は descendants に入るのか

対案:

- 自家製馬自身の因子は top-level `factors` に保存する
- 次世代馬を保存するとき、その自家製馬が先祖なら `descendants` 側にもその `factors` を含める
- custom horse detail 生成は `selected` の現在値から行う

結論:

手動因子を失わないため、custom horse 保存時は `selected` の snapshot から `descendants` を組み直す。

### 懸念 4: 既存保存データが壊れるのでは

対案:

- 旧形式 `descendants` ありの保存データは読めるようにする
- `id` が無い保存データでも表示復元は維持する
- 再選択時に detail が無い場合は旧 `descendants` を使う
- それでも無い場合だけ summary matching を試みる

結論:

破壊的 migration はしない。

### 懸念 5: offline が弱くなるのでは

対案:

- summary は install cache
- detail chunk は runtime cache
- app idle で全 chunk を順次 prefetch
- prefetch 完了後は従来に近い offline 利用が可能

結論:

初回訪問直後の offline だけは未取得 detail が使えない可能性がある。必要なら「detail preload 完了」フラグを持つ。

### 懸念 6: JSON ファイル数が増えて管理が複雑になる

対案:

- detail chunk は生成スクリプトで完全自動生成
- 手編集禁止
- CI で summary/detail の整合性をテストする

結論:

運用コストは増えるが、生成物として扱えば許容範囲。

## テスト計画

### 単体テスト

- `build_dabimas_stream.py`
  - summary に `descendants` が無い
  - detail に `id` と `descendants` がある
  - id が一意
  - id が URL 由来で、再生成（並び替え後）でも同じ馬に同じ id が付く（安定性テスト）
  - summary の `detailChunk` と実際の chunk 配置が一致する
  - detail chunk に抜け漏れが無い（全 id が summary と 1:1）
  - `descendants.length === 15`

### ブラウザ確認

PC:

- 初期表示
- 種牡馬選択
- 繁殖牝馬選択
- 途中セルへの選択
- 削除
- リセット
- 配合理論表示
- クロス表示
- 手動因子
- 配合保存/復元

スマホ:

- 初期表示
- モバイル検索ダイアログ
- 検索
- 選択
- クリア
- スクリーンショット保存
- 回転/リサイズ

### performance 確認

比較対象:

- 現行 full JSON
- summary + detail chunk

見る指標:

- 初期 DOM 表示
- loader 消滅時刻
- summary fetch/parse
- 初回選択時間
- detail cache hit 時の選択時間
- detail cache miss 時の選択時間
- localStorage 保存サイズ

## 段階的な実装順

1. 生成スクリプトに summary/detail 出力を追加する。
2. テストで summary/detail の整合性を保証する。
3. アプリに summary 読み込みを追加する。ただし full JSON fallback は残す。
4. `ensureHorseDetail()` を追加し、選択時に detail を補完する。
5. service worker を summary/detail 対応にする。
6. localStorage 保存を lightweight 化する。
7. 旧保存データ互換を確認する。
8. background prefetch を追加する。
9. CI の生成・commit 対象を更新する。
10. full JSON fallback を残すか削除するか判断する。

## やらない方がよい実装

- detail 全体 4.3MB を初回選択時に読む
- `name/subName/factors` だけを detail のキーにする
- 出力連番を join key の `id` にする（再生成で別の馬を指す）
- localStorage から無条件に `descendants` を削除する
- 自家製馬と通常馬を同じ detail chunk に混ぜる
- service worker install で全 chunk を必ず `addAll` する
- 旧保存データを破壊的に migration する
- `CombinationDialog` の保存対象から `dabimasCustomHorses` を漏らす

## 推奨結論

実装するなら、次の構成が妥当。

- `dabimasFactor.summary.json`
- `dabimasFactor.details.NNN.json`
- URL 由来の安定 `id` ベースの detail 解決（出力連番にしない）
- `detailChunk` は summary 焼き込みを直接使う
- `ensureHorseDetail()` による選択時補完（state 変更前に await、null ガードあり）
- idle background prefetch
- runtime cache
- `dabimasFactor` は画面復元用に軽量保存
- `dabimasCustomHorses` は自家製馬再利用用に detail 込みで保存

この設計なら初期ロードは軽くなる可能性が高い。

一方で、初回訪問直後の未取得 detail 選択では短い待ちが発生し得る。そこは chunk サイズ、prefetch、loading 表示で吸収する。

