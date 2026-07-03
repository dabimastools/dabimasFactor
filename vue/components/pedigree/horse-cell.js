/**
 * このファイルの役割:
 * - 血統表の1セル分の「馬を選ぶ／メモを書く」部品（common-autocomplete）。
 * - PC ではオートコンプリート、モバイルではダイアログ式の検索・選択 UI を
 *   同じコンポーネント内で出し分ける（isMobileLayout）。
 * - Phase 3（docs/index-split-completion-plan.md）でさらに
 *   memo-cell / desktop-horse-autocomplete / mobile-horse-picker へ
 *   分割していく前提の、無変更のファイル移動（Phase 3-1）。
 *
 * このファイルに置かない処理:
 * - 保存、fetch、IndexedDB、血統計算、インブリード判定。
 * - 馬名の正規化・絞り込み（vue/logic/horses/horse-search.js に委譲）。
 *
 * 分けている理由:
 * - index.html に全部書くと変更箇所が広がるため、この部品だけ見れば
 *   検索・選択・メモまわりを直せるようにする。
 */
(function (window, Vue) {
  window.Dabimas = window.Dabimas || {};
  window.Dabimas.components = window.Dabimas.components || {};

  // v-forの:key用に、馬オブジェクトごとの一意で安定したキーを採番する。
  // データにはid空＋同名(キタサンブラック等)で内容が完全一致する馬が複数あり、
  // 内容ベースのkeyだとVueのkeyed diffが重複keyで破綻してリストが正しく
  // 更新されない/ダイアログが閉じない等の不具合を起こすため、instance単位で一意化する。
  var horseListKeyCache = new WeakMap();
  var horseListKeySeq = 0;

  // index.html のモジュールスコープにあった定数を同名で再宣言する。
  // これによりメソッド本体を1文字も変えずに移動できる（逐語移動原則）。
  var INDEX_TO_ROW_NUMBER = window.Dabimas.constants.pedigreeIndexes.INDEX_TO_ROW_NUMBER;

  // カスタムコンポーネント定義（コンボボックス）
  Vue.component("common-autocomplete", {
      template: `
      <div class="exp-mobile-autocomplete-root">
        <template v-if="dispCategory%2 === 0">
          <template v-if="isMobileLayout">
            <button
              type="button"
              class="exp-mobile-horse-trigger"
              @click="openMobileEditor"
            >
              <span class="exp-mobile-horse-text">{{ mobileTriggerLabel }}</span>
              <i class="mdi mdi-chevron-down"></i>
            </button>
            <v-dialog
              v-model="mobileDialogVisible"
              content-class="exp-mobile-picker-dialog"
              max-width="560"
            >
              <v-card>
                <div class="exp-mobile-picker-header">
                  <div>
                    <div class="exp-mobile-picker-title">{{ mobileDialogTitle }}</div>
                    <div class="exp-mobile-picker-subtitle">{{ mobileDialogContextLabel }}</div>
                  </div>
                  <div class="exp-mobile-picker-actions">
                    <button
                      v-if="selected[index]"
                      type="button"
                      class="exp-mobile-picker-action exp-mobile-picker-action--clear"
                      @click="clearMobileHorse"
                    >クリア</button>
                    <button
                      type="button"
                      class="exp-mobile-picker-action exp-mobile-picker-action--close"
                      @click="closeMobileEditor"
                    >閉じる</button>
                  </div>
                </div>
                <div class="exp-mobile-picker-body">
                  <div class="exp-mobile-current-selection">
                    <div class="exp-mobile-current-selection-label">現在の選択</div>
                    <div class="exp-mobile-current-selection-context">
                      {{ mobileDialogContextLabel }}
                    </div>
                    <div class="exp-mobile-current-selection-value">
                      {{ mobileCurrentSelectionLabel }}
                    </div>
                  </div>
                  <label
                    class="exp-mobile-search-label"
                    :for="mobileInputId"
                  >候補を検索</label>
                  <div class="exp-mobile-search-shell">
                    <i class="mdi mdi-magnify"></i>
                    <input
                      :id="mobileInputId"
                      ref="mobileSearchInput"
                      :value="mobileQueryInput"
                      class="exp-mobile-search-input"
                      type="text"
                      :placeholder="placeholderText"
                      autocomplete="off"
                      autocapitalize="off"
                      spellcheck="false"
                      inputmode="search"
                      lang="ja"
                      :aria-busy="mobileSearchCompositionActive ? 'true' : 'false'"
                      enterkeyhint="search"
                      @input="onMobileSearchInput"
                      @compositionstart="onMobileCompositionStart"
                      @compositionend="onMobileCompositionEnd"
                      @keydown.enter="onMobileSearchEnter"
                    />
                    <button
                      v-if="mobileQueryInput"
                      type="button"
                      class="exp-mobile-search-clear"
                      @click="clearMobileQuery"
                    >クリア</button>
                  </div>
                  <div class="exp-mobile-option-list">
                    <button
                      v-for="horse in filteredMobileLists"
                      :key="getHorseListKey(horse)"
                      type="button"
                      :class="[
                        'exp-mobile-option-btn',
                        { 'exp-mobile-option-btn--selected': isSelectedHorse(horse) }
                      ]"
                      @click="selectMobileHorse(horse)"
                    >
                      <div class="exp-option-item">
                        <span class="exp-option-label exp-mobile-option-name">
                          {{ getHorseBaseText(horse) }}
                        </span>
                        <span
                          v-for="(factor, factorIndex) in getHorseFactorBadges(horse)"
                          :key="getHorseListKey(horse) + '-factor-' + factorIndex"
                          :class="['exp-option-factor-badge', factor.className]"
                        >{{ factor.text }}</span>
                      </div>
                    </button>
                    <div
                      v-if="filteredMobileLists.length === 0"
                      class="exp-mobile-option-empty"
                    >
                      該当するデータはありません
                    </div>
                  </div>
                </div>
              </v-card>
            </v-dialog>
          </template>

          <desktop-horse-autocomplete
            v-else
            :index="index"
            :sex="sex"
            :selected="selected"
            :lists="lists"
            :placeholder-text="placeholderText"
            @horse-change="onChange(sex, $event.localIndex, $event.horse)"
          ></desktop-horse-autocomplete>
        </template>
      <memo-cell
        v-else
        :index="index"
        :category="category"
        :inputed="inputed"
        @memo-change="memoChange(index, $event)"
      ></memo-cell>
    </div>    `,
      props: {
        index: {
          type: Number,
          required: true,
        },
        inputed: {
          type: Array,
          required: true,
        },
        selected: {
          type: Array,
          required: true,
        },
        horses: {
          type: Array,
          required: true,
        },
        onChange: {
          type: Function,
          required: true,
        },
        memoChange: {
          type: Function,
          required: true,
        },
        dispCategory: {
          type: Number,
          required: true,
        },
        category: {
          type: Array,
          required: true,
        },
      },
      data() {
        return {
          mobileDialogVisible: false,
          mobileQueryInput: "",
          mobileQuery: "",
          mobileSearchCompositionActive: false,
          mobileQuerySyncTimer: null,
        };
      },
      beforeDestroy() {
        this.clearMobileQuerySyncTimer();
      },
      // 注意: 以前ここに getStableViewportHeight / applyMobileViewportLayout /
      // captureMobileScreenshot 等（root app 側と同名の重複コード、約369行）があったが、
      // このコンポーネントのテンプレート・他メソッドのどこからも呼ばれていない
      // 到達不能コードだったため削除した（実際に使われているのは root app 側のみ）。
      methods: {
        normalizeSearchText(text) {
          return window.Dabimas.logic.horses.normalizeSearchText(text);
        },
        getHorseKey(horse) {
          return window.Dabimas.logic.horses.getHorseKey(horse);
        },
        // v-forの:key専用。馬オブジェクトのinstance単位で一意かつ安定なキーを返す。
        // （内容一致の重複馬でもkeyが衝突しないようにし、keyed diffの破綻を防ぐ）
        getHorseListKey(horse) {
          if (!horse || typeof horse !== "object") {
            return "empty";
          }
          let key = horseListKeyCache.get(horse);
          if (key === undefined) {
            key = "h" + ++horseListKeySeq;
            horseListKeyCache.set(horse, key);
          }
          return key;
        },
        getHorseBaseText(horse) {
          return window.Dabimas.logic.horses.getHorseBaseText(horse);
        },
        getHorseSelectedText(horse) {
          return this.getHorseBaseText(horse);
        },
        getHorseSearchIndexText(horse) {
          return window.Dabimas.logic.horses.getHorseSearchIndexText(horse);
        },
        getHorseFactorBadges(horse) {
          return window.Dabimas.logic.horses.getHorseFactorBadges(horse);
        },
        // getWidth は vue/components/pedigree/memo-cell.js に外部化済み。
        // filterHorse / getHorse / getFactor は
        // vue/components/pedigree/desktop-horse-autocomplete.js に外部化済み。
        clearMobileQuerySyncTimer() {
          if (this.mobileQuerySyncTimer) {
            clearTimeout(this.mobileQuerySyncTimer);
            this.mobileQuerySyncTimer = null;
          }
        },
        resetMobileQuery() {
          this.clearMobileQuerySyncTimer();
          this.mobileQueryInput = "";
          this.mobileQuery = "";
          this.mobileSearchCompositionActive = false;
        },
        getMobileInputValue(event) {
          return event &&
            event.target &&
            typeof event.target.value === "string"
            ? event.target.value
            : "";
        },
        // DOMの実値を基準に検索クエリを同期する。compositionイベントの発火に
        // 依存しないため、iOS標準IMEでもサードパーティIME(flick等)でも確実に反映される。
        syncMobileQueryFromDom() {
          const input = this.$refs.mobileSearchInput;
          const value =
            input && typeof input.value === "string"
              ? input.value
              : this.mobileQueryInput;
          this.mobileQueryInput = value;
          this.mobileQuery = value;
        },
        scheduleMobileQuerySync(delay = 120) {
          this.clearMobileQuerySyncTimer();
          if (delay <= 0) {
            this.syncMobileQueryFromDom();
            return;
          }
          this.mobileQuerySyncTimer = setTimeout(() => {
            this.mobileQuerySyncTimer = null;
            this.syncMobileQueryFromDom();
          }, delay);
        },
        runAfterMobileDialogClose(callback) {
          const invoke = () => {
            if (typeof callback === "function") {
              callback();
            }
          };
          this.$nextTick(() => {
            if (
              typeof window !== "undefined" &&
              typeof window.requestAnimationFrame === "function"
            ) {
              window.requestAnimationFrame(invoke);
              return;
            }
            setTimeout(invoke, 0);
          });
        },
        openMobileEditor() {
          this.mobileDialogVisible = true;
          this.resetMobileQuery();
          this.$nextTick(() => {
            const input = this.$refs.mobileSearchInput;
            if (input && typeof input.focus === "function") {
              input.focus();
            }
          });
        },
        closeMobileEditor() {
          this.mobileDialogVisible = false;
          this.resetMobileQuery();
        },
        clearMobileHorse() {
          this.resetMobileQuery();
          this.mobileDialogVisible = false;
          this.runAfterMobileDialogClose(() => {
            this.onChange(this.sex, this.index - this.sex * 16, null);
          });
        },
        selectMobileHorse(horse) {
          if (!horse || horse.disabled) {
            return;
          }
          this.resetMobileQuery();
          this.mobileDialogVisible = false;
          this.runAfterMobileDialogClose(() => {
            this.onChange(this.sex, this.index - this.sex * 16, horse);
          });
        },
        onMobileSearchInput(event) {
          // iOSサードパーティIME(flick等)対策:
          // compositionendが発火しない/isComposing=false のinputが来た場合は、
          // 合成は終了したものとみなしてフラグを補正する（合成状態のまま固まるのを防ぐ）。
          if (
            event &&
            event.isComposing === false &&
            this.mobileSearchCompositionActive
          ) {
            this.mobileSearchCompositionActive = false;
            if (event.target) {
              event.target.composing = false;
            }
            // 非合成状態に補正した直後の再描画でvalueが古い値に書き戻されるのを防ぐため、
            // モデルをDOM実値に合わせておく。
            this.mobileQueryInput = this.getMobileInputValue(event);
          }
          // クエリ同期はcompositionイベントに依存せずdebounceで行う。
          // 変換中は確定待ちで長めの保険のみ（標準IMEはcompositionendで即時反映される）。
          // compositionendが来ない端末でも、この保険で最終的に必ず反映される。
          this.scheduleMobileQuerySync(
            this.mobileSearchCompositionActive ? 700 : 120
          );
        },
        onMobileSearchEnter(event) {
          // IME変換確定中はEnterのデフォルト動作（変換確定）を妨げない。
          // event.isComposing を優先し、無い場合のみ自前フラグで判定する。
          const composing = event
            ? event.isComposing === true
            : this.mobileSearchCompositionActive;
          if (composing) {
            return;
          }
          if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
          }
          this.selectFirstMobileHorse();
        },
        onMobileCompositionStart(event) {
          this.mobileSearchCompositionActive = true;
          // IME変換中はVueによるvalue書き戻しを抑止する（v-modelと同等のガード）
          if (event && event.target) {
            event.target.composing = true;
          }
        },
        onMobileCompositionEnd(event) {
          this.mobileSearchCompositionActive = false;
          // 変換確定後はvalue書き戻しを再開する
          if (event && event.target) {
            event.target.composing = false;
          }
          // DOM実値から即時同期する
          this.scheduleMobileQuerySync(0);
        },
        clearMobileQuery() {
          this.resetMobileQuery();
          this.$nextTick(() => {
            const input = this.$refs.mobileSearchInput;
            if (input && typeof input.focus === "function") {
              input.focus();
            }
          });
        },
        selectFirstMobileHorse() {
          // 変換中の判定は呼び出し元(onMobileSearchEnter)で済んでいるため、ここでは
          // 合成フラグに依存しない（flick等でフラグが残っても選択できるようにする）。
          if (this.filteredMobileLists.length > 0) {
            this.selectMobileHorse(this.filteredMobileLists[0]);
          }
        },
        isSelectedHorse(horse) {
          const current = this.selected[this.index];
          return this.getHorseKey(current) !== "" &&
            this.getHorseKey(current) === this.getHorseKey(horse);
        },
      },
      computed: {
        computedStyle(newValue) {
          return {
            maxWidth: `calc(50% + ${this.getOffset(newValue.index)}px)`
          };
        },
        placeholderText(newValue) {
          if (
            Math.floor(newValue.index / 16) === 1 &&
            newValue.index % 16 === 0
          ) {
            return "繫殖牝馬を選んでください";
          } else {
            switch (newValue.index % 16) {
              case 3:
              case 5:
              case 7:
              case 9:
              case 11:
              case 13:
              case 15:
                return "種牡馬 or 繫殖牝馬を選んでください";
                break;
              default:
                return "種牡馬を選んでください";
                break;
            }
          }
        },
        sex(newValue) {
          // index>=16が牝馬
          return Math.floor(newValue.index / 16);
        },
        isMobileLayout() {
          return this.$vuetify.breakpoint.smAndDown;
        },
        placeholderText() {
          const currentIndex = Number(this.index) || 0;
          const rowNumber = INDEX_TO_ROW_NUMBER[currentIndex] || "";
          let baseText;
          if (Math.floor(currentIndex / 16) === 1 && currentIndex % 16 === 0) {
            baseText = "繁殖牝馬を選んでください";
          } else if ([3, 5, 7, 9, 11, 13, 15].includes(currentIndex % 16)) {
            baseText = "種牡馬または繁殖牝馬を選んでください";
          } else {
            baseText = "種牡馬を選んでください";
          }
          return rowNumber ? `${rowNumber}${baseText}` : baseText;
        },
        mobilePlaceholderText() {
          const currentIndex = Number(this.index) || 0;
          const rowNumber = INDEX_TO_ROW_NUMBER[currentIndex] || "";
          let baseText;
          if (Math.floor(currentIndex / 16) === 1 && currentIndex % 16 === 0) {
            baseText = "繁殖牝馬を選択";
          } else if ([3, 5, 7, 9, 11, 13, 15].includes(currentIndex % 16)) {
            baseText = "種牡馬/牝馬を選択";
          } else {
            baseText = "種牡馬を選択";
          }
          return rowNumber ? `${rowNumber}${baseText}` : baseText;
        },
        mobileDialogTitle() {
          if (this.sex === 1 && this.index % 16 === 0) {
            return "繁殖牝馬を選択";
          }
          if ([3, 5, 7, 9, 11, 13, 15].includes(this.index % 16)) {
            return "種牡馬 / 繁殖牝馬を選択";
          }
          return "種牡馬を選択";
        },
        mobileDialogContextLabel() {
          const sideLabel = this.sex === 0 ? "種牡馬検索" : "繁殖牝馬検索";
          const rowNumber = INDEX_TO_ROW_NUMBER[Number(this.index) || 0] || "";
          return rowNumber ? `${sideLabel} ${rowNumber}` : sideLabel;
        },
        mobileTriggerLabel() {
          const horse = this.selected[this.index];
          if (!horse) {
            return this.mobilePlaceholderText;
          }
          return this.getHorseSelectedText(horse) || this.placeholderText;
        },
        mobileCurrentSelectionLabel() {
          const horse = this.selected[this.index];
          if (!horse) {
            return "未選択";
          }
          return this.getHorseSelectedText(horse) || "未選択";
        },
        mobileInputId() {
          return `exp-mobile-search-${this.index}`;
        },
        filteredMobileLists() {
          const source = Array.isArray(this.lists) ? this.lists : [];
          const normalizedQuery = this.normalizeSearchText(this.mobileQuery);
          const limit = normalizedQuery ? 80 : 60;
          const filtered = [];

          for (let i = 0; i < source.length; i++) {
            const horse = source[i];
            if (!horse || horse.disabled) {
              continue;
            }
            if (
              normalizedQuery &&
              !this.getHorseSearchIndexText(horse).includes(normalizedQuery)
            ) {
              continue;
            }
            filtered.push(horse);
            if (filtered.length >= limit) {
              break;
            }
          }

          return filtered;
        },
        sex() {
          return Math.floor((Number(this.index) || 0) / 16);
        },
        // 馬のリスト
        lists(newValue) {
          let retList;

          if (this.sex === 1 && this.index % 16 === 0) {
            //繫殖牝馬をセット
            retList = this.horses[2];
          } else {
            switch (this.index % 16) {
              case 3:
              case 5:
              case 7:
              case 9:
              case 11:
              case 13:
              case 15:
                // 種牡馬と繫殖牝馬をセット
                retList = this.horses[0];
                break;
              default:
                // 種牡馬のみをセット
                retList = this.horses[1];
                break;
            }
          }
          return retList;
        },
      },
    });
})(window, window.Vue);
