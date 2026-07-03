// 始祖（parent line）の一覧データ。index.html からそのまま移した。
// 2026-06 時点では index.html 側からの参照は無い（未使用）データだが、
// 挙動を変えない移行のため削除はせず、そのまま外部化する。
(function (window) {
  window.Dabimas = window.Dabimas || {};
  window.Dabimas.constants = window.Dabimas.constants || {};

  var FOUNDER = [
    {key:"Intent" ,value:"インテント系"},
    {key:"エタン" ,value:"エタン系"},
    {key:"Owen Tudor" ,value:"オーエンテューダー系"},
    {key:"Aureole" ,value:"オリオール系"},
    {key:"Khaled" ,value:"カーレッド系"},
    {key:"Clarion" ,value:"クラリオン系"},
    {key:"Grey Sovereign" ,value:"グレイソヴリン系"},
    {key:"Sir Gaylord" ,value:"サーゲイロード系"},
    {key:"Son-in-Law" ,value:"サンインロー系"},
    {key:"Swynford" ,value:"スインフォード系"},
    {key:"ゼダーン" ,value:"ゼダーン系"},
    {key:"St.Simon" ,value:"セントサイモン系"},
    {key:"Sovereign Path" ,value:"ソヴリンパス系"},
    {key:"ダンテ" ,value:"ダンテ系"},
    {key:"Teddy" ,value:"テディ系"},
    {key:"Tourbillon" ,value:"トウルビヨン系"},
    {key:"Tom Fool" ,value:"トムフール系"},
    {key:"Nasrullah" ,value:"ナスルーラ系"},
    {key:"Nearctic" ,value:"ニアークティック系"},
    {key:"ネアルコ" ,value:"ネアルコ系"},
    {key:"ネイティヴダンサー" ,value:"ネイティヴダンサー系"},
    {key:"Never Say Die" ,value:"ネヴァーセイダイ系"},
    {key:"Never Bend" ,value:"ネヴァーベンド系"},
    {key:"ノーザンダンサー" ,value:"ノーザンダンサー系"},
    {key:"ハイペリオン" ,value:"ハイペリオン系"},
    {key:"ハビタット" ,value:"ハビタット系"},
    {key:"Fine Top" ,value:"ファイントップ系"},
    {key:"Phalaris" ,value:"ファラリス系"},
    {key:"Pharis" ,value:"ファリス系"},
    {key:"Pharos" ,value:"ファロス系"},
    {key:"Fairway" ,value:"フェアウェイ系"},
    {key:"Fair Trial" ,value:"フェアトライアル系"},
    {key:"フォルティノ" ,value:"フォルティノ系"},
    {key:"Brantome" ,value:"ブラントーム系"},
    {key:"Blandford" ,value:"ブランドフォード系"},
    {key:"Princequillo" ,value:"プリンスキロ系"},
    {key:"Prince Bio" ,value:"プリンスビオ系"},
    {key:"Princely Gift" ,value:"プリンスリーギフト系"},
    {key:"Prince Rose" ,value:"プリンスローズ系"},
    {key:"Blenheim" ,value:"ブレニム系"},
    {key:"ヘイルトゥリーズン" ,value:"ヘイルトゥリーズン系"},
    {key:"ボールドルーラー" ,value:"ボールドルーラー系"},
    {key:"Bois Roussel" ,value:"ボワルセル系"},
    {key:"My Babu" ,value:"マイバブー系"},
    {key:"Man o'War" ,value:"マンノウォー系"},
    {key:"Mossborough" ,value:"モスボロー系"},
    {key:"Ribot" ,value:"リボー系"},
    {key:"Raise a Native" ,value:"レイズアネイティヴ系"},
    {key:"Red God" ,value:"レッドゴッド系"},
    {key:"Relic" ,value:"レリック系"},
    {key:"Royal Charger" ,value:"ロイヤルチャージャー系"},
    {key:"Rockefella" ,value:"ロックフェラ系"},
    {key:"ワイルドリスク" ,value:"ワイルドリスク系"},
  ];

  window.Dabimas.constants.parentLines = Object.freeze({
    FOUNDER: FOUNDER,
  });
})(window);
