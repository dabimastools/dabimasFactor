# Engineering

コード作業で日常的に使うスキル。

## ユーザー起動（User-invoked）

自分でタイプしたときだけ起動する（`disable-model-invocation: true`）。

- **[implement](./implement/SKILL.md)** — PRD や Issue に基づいてひとまとまりの作業を実装する。/tdd で進め、最後に /code-review でレビューする。

## モデル起動（Model-invoked）

モデルが自律的に呼べる（自分でタイプしても起動できる）。

- **[diagnosing-bugs](./diagnosing-bugs/SKILL.md)** — 難しいバグやパフォーマンス劣化のための規律ある診断ループ：再現 → 最小化 → 仮説 → 計測 → 修正 → 回帰テスト。
- **[tdd](./tdd/SKILL.md)** — red-green-refactor ループによるテスト駆動開発。機能開発やバグ修正を垂直スライスで 1 つずつ進める。
- **[prototype](./prototype/SKILL.md)** — 設計上の疑問に答える使い捨てプロトタイプ：ロジック / 状態なら実行可能なターミナルアプリ、見た目なら切り替え可能な複数の UI バリエーション。
- **[code-review](./code-review/SKILL.md)** — 固定点以降の diff の 2 軸レビュー：**Standards**（リポジトリの規約＋Fowler のスメル・ベースラインに沿っているか）と **Spec**（元の Issue / 仕様を忠実に実装しているか）。並列サブエージェントで実行。
- **[resolving-merge-conflicts](./resolving-merge-conflicts/SKILL.md)** — 進行中の git マージ / リベースのコンフリクトを、両方の意図を保ちながら解決する。
