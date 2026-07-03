/**
 * このファイルの役割:
 * - judgeInbreed が作った sameNameGroups / siblingGroups を名前でマージし、
 *   重複を除去したうえで、表示用の因子コード行列（32×3、"00"〜"10"）を作る
 *   （buildInbreedFactorCounts）。
 * - あわせて、自動クロスのハートボタンを非活性化すべき index 一覧
 *   （disabledIndexes）と、inbreedList へ反映すべき (index, element) の
 *   一覧（inbreedEntries）も返す。
 *
 * このファイルに置かない処理:
 * - Vue state（this.isInbreedButtonClicked / this.inbreedList /
 *   this.inbreedFactorNumtoString）への代入。呼び出し側（root app の
 *   performInbreedFactorCounts）が担当する。
 *
 * 逐語移動時の注意（構造上必要な最小限の置換）:
 * - 旧実装はこの計算の途中で `this.inbreedList[element.index] = element` を
 *   直接実行してから `this.inbreedList` 全体（32件、今回のマージ対象以外の
 *   既存エントリ＝手動クロス等も含む）を読み直して factorCd を作っていた。
 *   純関数化にあたり、呼び出し時点の inbreedList をそのまま引数で受け取り、
 *   その複製（workingInbreedList）の上で同じ反映をしてから読み直すことで、
 *   「マージ対象以外の既存エントリも合算される」という挙動を変えずに保つ。
 *   実際の this.inbreedList への書き込みは呼び出し側が inbreedEntries を
 *   使って行う。
 */
(function (window) {
  window.Dabimas = window.Dabimas || {};
  window.Dabimas.logic = window.Dabimas.logic || {};
  window.Dabimas.logic.inbreed = window.Dabimas.logic.inbreed || {};

  var factorMap = window.Dabimas.logic.factor.factorMap;

  window.Dabimas.logic.inbreed.buildInbreedFactorCounts = function (
    sameNameGroups,
    siblingGroups,
    inbreedList
  ) {
    const indexSet = new Set();

    sameNameGroups.forEach(group => {
      group.forEach(node => {
        if (node && node.index !== undefined) {
          indexSet.add(node.index);
        }
      });
    });
    siblingGroups.forEach(group => {
      group.forEach(node => {
        if (node && node.index !== undefined) {
          indexSet.add(node.index);
        }
      });
    });
    const disabledIndexes = Array.from(indexSet);

    const mergedGroupsByName = new Map();

    // sameNameGroupsを追加
    sameNameGroups.forEach(group => {
      if (group.length > 0 && group[0]?.name) {
        const name = group[0].name;
        if (!mergedGroupsByName.has(name)) {
          mergedGroupsByName.set(name, []);
        }
        const existingIndexes = mergedGroupsByName.get(name).map(n => n.index);
        group.forEach(node => {
          if (node && node.index !== undefined && !existingIndexes.includes(node.index)) {
            mergedGroupsByName.get(name).push(node);
            existingIndexes.push(node.index);
          }
        });
      }
    });

    // siblingGroupsを追加
    siblingGroups.forEach(group => {
      if (group.length > 0 && group[0]?.name) {
        const name = group[0].name;
        if (!mergedGroupsByName.has(name)) {
          mergedGroupsByName.set(name, []);
        }
        const existingIndexes = mergedGroupsByName.get(name).map(n => n.index);
        group.forEach(node => {
          if (node && node.index !== undefined && !existingIndexes.includes(node.index)) {
            mergedGroupsByName.get(name).push(node);
            existingIndexes.push(node.index);
          }
        });
      }
    });

    // Map → 配列に変換
    const mergedGroups = Array.from(mergedGroupsByName.values());

    // 呼び出し時点の inbreedList を複製し、その上で反映してから読み直す
    // （元実装が this.inbreedList を直接書き換えてから読み直していたのと同じにするため）。
    const workingInbreedList = inbreedList.slice();
    const inbreedEntries = [];
    mergedGroups.flat().flat().forEach(element => {
      if (element) {
        workingInbreedList[element.index] = element;
        inbreedEntries.push({ index: element.index, element });
      }
    });

    // 空欄、数字、(で始まるものを除外する
    const excludeString = /^$|^\d*$|^\(.+?\)/;
    let inbreedArray = [];

    workingInbreedList.map((value) => {
      if (value) {
        // subNameが(で始まる場合(繫殖牝馬選択時)や数字の因名被りなのでそれは削除する
        inbreedArray.push({
          name: value.name,
          subName: excludeString.test(value.subName)
            ? "dummy"
            : value.subName,
          factors: value.factors,
          selfInbreed: false,
        });
      }
    });

    const factorCd = Array.from(new Array(32), () =>
      new Array(3).fill("00")
    );
    // 重複を削除する
    const inbreedArraySimple = inbreedArray.filter(
      ({ name, subName }, i) =>
        i ===
        inbreedArray.findIndex(
          (e) => e?.name === name && e?.subName === subName
        )
    );

    // 因子をコード変換する。Ex.速→02にさせる
    if (inbreedArraySimple) {
      inbreedArraySimple.map((element, index) => {
        factorCd[index][0] = factorMap.get(element?.factors[0]) ?? "00";
        factorCd[index][1] = factorMap.get(element?.factors[1]) ?? "00";
        factorCd[index][2] = factorMap.get(element?.factors[2]) ?? "00";
      });
    }

    return { disabledIndexes, inbreedEntries, factorCd };
  };
})(window);
