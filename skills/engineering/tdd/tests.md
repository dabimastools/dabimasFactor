# 良いテストと悪いテスト

## 良いテスト

**統合スタイル**：内部部品のモックではなく、本物のインターフェースを通してテストする。

```typescript
// GOOD: 観察可能な振る舞いをテストしている
test("有効なカートを持つユーザーはチェックアウトできる", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

特徴：

- ユーザー / 呼び出し側が気にする振る舞いをテストしている
- 公開 API だけを使っている
- 内部のリファクタリングを生き延びる
- 「どうやって（HOW）」ではなく「何を（WHAT）」を記述している
- 1 テストにつき論理的なアサーションは 1 つ

## 悪いテスト

**実装詳細テスト**：内部構造に結合している。

```typescript
// BAD: 実装の詳細をテストしている
test("checkout が paymentService.process を呼ぶ", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

危険信号：

- 内部のコラボレーターをモックしている
- プライベートメソッドをテストしている
- 呼び出し回数や呼び出し順序に対してアサートしている
- 振る舞いが変わっていないのにリファクタリングでテストが壊れる
- テスト名が WHAT ではなく HOW を説明している
- インターフェースを通さず、外部の手段で検証している

```typescript
// BAD: インターフェースを迂回して検証している
test("createUser がデータベースに保存する", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// GOOD: インターフェースを通して検証している
test("createUser で作ったユーザーは取得できる", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```

**トートロジーなテスト**：期待値が実装をなぞっているので、構造上必ず通ってしまう。

```typescript
// BAD: 期待値をコードと同じやり方で再計算している
test("calculateTotal が明細を合計する", () => {
  const items = [{ price: 10 }, { price: 5 }];
  const expected = items.reduce((sum, i) => sum + i.price, 0);
  expect(calculateTotal(items)).toBe(expected);
});

// GOOD: 期待値は独立した既知のリテラル
test("calculateTotal が明細を合計する", () => {
  expect(calculateTotal([{ price: 10 }, { price: 5 }])).toBe(15);
});
```
