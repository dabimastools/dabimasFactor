---
name: implement
description: "PRD や Issue 群に基づいて、ひとまとまりの作業を実装する。"
disable-model-invocation: true
---

ユーザーが PRD や Issue で示した作業を実装する。

可能な限り /tdd を使い、事前に合意した継ぎ目（seam）でテストする。

チェック（リント・型チェックなど、プロジェクトにあるもの）と個別のテストファイルはこまめに実行し、テストスイート全体は最後に 1 回実行する。

完了したら /code-review で作業をレビューする。

現在のブランチに作業をコミットする。
