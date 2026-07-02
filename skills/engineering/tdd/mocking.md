# モックすべきとき

モックは**システム境界**でのみ行う：

- 外部 API（決済、メールなど）
- データベース（場合による — テスト用 DB の方が望ましい）
- 時刻 / 乱数
- ファイルシステム（場合による）

モックしないもの：

- 自分のクラス / モジュール
- 内部のコラボレーター
- 自分が制御しているものすべて

## モックしやすい設計

システム境界では、モックしやすいインターフェースを設計する：

**1. 依存性注入（DI）を使う**

外部依存は内部で生成せず、外から渡す：

```typescript
// モックしやすい
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// モックしにくい
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**2. 汎用フェッチャーより SDK 風のインターフェースを好む**

条件分岐を持つ 1 つの汎用関数ではなく、外部操作ごとに専用の関数を作る：

```typescript
// GOOD: 各関数を個別にモックできる
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch('/orders', { method: 'POST', body: data }),
};

// BAD: モックの中に条件分岐が必要になる
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

SDK 方式の利点：

- 各モックは特定の形を 1 つ返すだけでよい
- テストのセットアップに条件分岐がない
- テストがどのエンドポイントを叩くのか見えやすい
- エンドポイントごとの型安全性
