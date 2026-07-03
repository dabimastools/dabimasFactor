/**
 * このファイルの役割:
 * - 血統表32行（種牡馬側16行＋繁殖牝馬側16行）の「行の形」を作る。
 * - 何行目に何個セルを結合するか（headCells / autoColspan）、親系統を表示するか
 *   （showParentLine）、行の背景テーマ（autoClass）を、side（'stallion' / 'broodmare'）
 *   を受け取って組み立てる。
 * - ここで作るのは「不変の行定義」だけで、選ばれている馬や因子などの
 *   変化する値（rowState 相当）はここには持たない。
 *
 * このファイルに置かない処理:
 * - 血統展開、因子集計、保存処理。
 *
 * 分けている理由:
 * - 元の index.html には rowConfigs（種牡馬側）と rowConfigsBloodmare（繁殖牝馬側）が
 *   ほぼ同じ内容で2つの配列として重複していた。headCells の中身は両側で完全に
 *   一致しており、違うのは行の背景テーマ（autoClass）と index のオフセットだけなので、
 *   1つの生成関数にまとめて重複を無くす。
 */
(function (window) {
  window.Dabimas = window.Dabimas || {};
  window.Dabimas.logic = window.Dabimas.logic || {};
  window.Dabimas.logic.pedigree = window.Dabimas.logic.pedigree || {};

  // 表示順は上から [0, 1, 2, 4, 8, 9, 5, 10, 11, 3, 6, 12, 13, 7, 14, 15]。
  // headCells の key ("r1c1" 等) は localIndex 基準で、種牡馬側・繁殖牝馬側で
  // 値を変えない（元の index.html でも offset を付けていなかったのでそれに合わせる）。
  var BASE_ROWS = [
    { localIndex: 0, autoColspan: 5, showParentLine: false, headCells: [] },
    { localIndex: 1, autoColspan: 4, showParentLine: true,
      headCells: [{ key: 'r1c1', text: '父', class: 'father_0', align: 'center', width: 15 }] },
    { localIndex: 2, autoColspan: 3, showParentLine: true,
      headCells: [
        { key: 'r2c1', text: '', class: 'father_1', rowspan: 7, width: 15, align: 'center' },
        { key: 'r2c2', text: '父', class: 'father_0', width: 15 },
      ] },
    { localIndex: 4, autoColspan: 2, showParentLine: false,
      headCells: [
        { key: 'r4c1', text: '', class: 'father_1', rowspan: 3, width: 15, align: 'center' },
        { key: 'r4c2', text: '父', class: 'father_0', width: 15 },
      ] },
    { localIndex: 8, autoColspan: 1, showParentLine: false,
      headCells: [
        { key: 'r8c1', text: '', class: 'father_1', width: 15, align: 'center' },
        { key: 'r8c2', text: '父', class: 'father', width: 15 },
      ] },
    { localIndex: 9, autoColspan: 1, showParentLine: true,
      headCells: [
        { key: 'r9c1', text: '母', class: 'mother' },
        { key: 'r9c2', text: '父', class: 'father' },
      ] },
    { localIndex: 5, autoColspan: 2, showParentLine: true,
      headCells: [
        { key: 'r5c1', text: '母', class: 'mother_0' },
        { key: 'r5c2', text: '父', class: 'father_0' },
      ] },
    { localIndex: 10, autoColspan: 1, showParentLine: false,
      headCells: [
        { key: 'r10c1', text: '', class: 'mother_1', rowspan: 2 },
        { key: 'r10c2', text: '', class: 'father_1' },
        { key: 'r10c3', text: '父', class: 'father' },
      ] },
    { localIndex: 11, autoColspan: 1, showParentLine: true,
      headCells: [
        { key: 'r11c1', text: '母', class: 'mother' },
        { key: 'r11c2', text: '父', class: 'father' },
      ] },
    { localIndex: 3, autoColspan: 3, showParentLine: true,
      headCells: [
        { key: 'r3c1', text: '母', class: 'mother_0' },
        { key: 'r3c2', text: '父', class: 'father_0' },
      ] },
    { localIndex: 6, autoColspan: 2, showParentLine: false,
      headCells: [
        { key: 'r6c1', text: '', class: 'mother_1', rowspan: 6 },
        { key: 'r6c2', text: '', class: 'father_1', rowspan: 3 },
        { key: 'r6c3', text: '父', class: 'father_0' },
      ] },
    { localIndex: 12, autoColspan: 1, showParentLine: false,
      headCells: [
        { key: 'r12c1', text: '', class: 'father_1' },
        { key: 'r12c2', text: '父', class: 'father' },
      ] },
    { localIndex: 13, autoColspan: 1, showParentLine: true,
      headCells: [
        { key: 'r13c1', text: '母', class: 'mother' },
        { key: 'r13c2', text: '父', class: 'father' },
      ] },
    { localIndex: 7, autoColspan: 2, showParentLine: true,
      headCells: [
        { key: 'r7c1', text: '母', class: 'mother_0' },
        { key: 'r7c2', text: '父', class: 'father_0' },
      ] },
    { localIndex: 14, autoColspan: 1, showParentLine: false,
      headCells: [
        { key: 'r14c1', text: '', class: 'mother_1', rowspan: 2 },
        { key: 'r14c2', text: '', class: 'father_1' },
        { key: 'r14c3', text: '父', class: 'father' },
      ] },
    { localIndex: 15, autoColspan: 1, showParentLine: true,
      headCells: [
        { key: 'r15c1', text: '母', class: 'mother' },
        { key: 'r15c2', text: '父', class: 'father' },
      ] },
  ];

  // autoClass だけは種牡馬側・繁殖牝馬側で異なる localIndex がある。
  // 変わらない localIndex（2,4,6,8,10,12,14）は両側とも 'horse_0'。
  var AUTO_CLASS_BY_LOCAL_INDEX = {
    0: { stallion: 'horse_all AliceBlue', broodmare: 'horse_all SalmonPink' },
    1: { stallion: 'omoshiro_0', broodmare: 'horse_all Broodmare' },
    2: { stallion: 'horse_0', broodmare: 'horse_0' },
    3: { stallion: 'omoshiro_0', broodmare: 'horse_all Broodmare' },
    4: { stallion: 'horse_0', broodmare: 'horse_0' },
    5: { stallion: 'omoshiro_0', broodmare: 'horse_all Broodmare' },
    6: { stallion: 'horse_0', broodmare: 'horse_0' },
    7: { stallion: 'omoshiro_0', broodmare: 'horse_all Broodmare' },
    8: { stallion: 'horse_0', broodmare: 'horse_0' },
    9: { stallion: 'migoto_0', broodmare: 'horse_0' },
    10: { stallion: 'horse_0', broodmare: 'horse_0' },
    11: { stallion: 'migoto_0', broodmare: 'horse_0' },
    12: { stallion: 'horse_0', broodmare: 'horse_0' },
    13: { stallion: 'migoto_0', broodmare: 'horse_0' },
    14: { stallion: 'horse_0', broodmare: 'horse_0' },
    15: { stallion: 'migoto_0', broodmare: 'horse_0' },
  };

  function resolveAutoClass(localIndex, side) {
    var entry = AUTO_CLASS_BY_LOCAL_INDEX[localIndex];
    return entry ? entry[side] : 'horse_0';
  }

  // side: 'stallion' | 'broodmare'
  function createPedigreeRowConfigs(side) {
    var rowsPerSide = window.Dabimas.constants.pedigreeIndexes.ROWS_PER_SIDE;
    var offset = side === 'broodmare' ? rowsPerSide : 0;
    return BASE_ROWS.map(function (row) {
      return {
        index: row.localIndex + offset,
        autoClass: resolveAutoClass(row.localIndex, side),
        autoColspan: row.autoColspan,
        showParentLine: row.showParentLine,
        headCells: row.headCells,
        // Phase 4（pedigree-row の props整理）で :key として使う想定の安定キー。
        key: side + '-' + row.localIndex,
      };
    });
  }

  window.Dabimas.logic.pedigree.createPedigreeRowConfigs = createPedigreeRowConfigs;
})(window);
