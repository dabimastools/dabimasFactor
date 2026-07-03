/**
 * このファイルの役割:
 * - JSON分割ロード（summary + detail chunk）に関わるメソッド一式。
 *   summary（軽量な一覧用データ）の正規化・候補リスト構築、選択時の
 *   detail chunk 取得・水和（hydrate）、自家製馬（IndexedDB）の読み込み、
 *   選択状態の localStorage への永続化（persistSelectedToStorage）まで。
 *
 * このファイルに置かない処理:
 * - 血統計算、インブリード判定。
 * - 配合保存ダイアログ・手動クロス永続化（vue/app/methods/combination.js の仕事）。
 *
 * 分けている理由:
 * - index.html の new Vue({...}) に全部書くと変更箇所が広がるため、
 *   馬データのロード・永続化まわりだけをまとめて見えるようにする
 *   （docs/index-split-completion-plan.md Phase 4-3）。
 */
(function (window, Vue) {
  window.Dabimas = window.Dabimas || {};
  window.Dabimas.app = window.Dabimas.app || {};
  window.Dabimas.app.methods = window.Dabimas.app.methods || {};

  Object.assign(window.Dabimas.app.methods, {
        // ===== JSON 分割ロード（summary + detail chunk）=====
        // summary 1 件を候補リスト用の馬オブジェクトへ整える（descendants は持たない）。
        normalizeHorseSummary(horse) {
          return {
            id: horse.id,
            detailChunk:
              typeof horse.detailChunk === "number" ? horse.detailChunk : 0,
            name: horse.name || "",
            ruby: horse.ruby || "",
            subName: horse.subName || "",
            nature: horse.nature || "",
            sex: horse.sex,
            parentLine: horse.parentLine || "",
            son: horse.son || "",
            factors: Array.isArray(horse.factors) ? horse.factors : ["", "", ""],
            source: "base",
          };
        },
        // 馬リスト（horsesBase / horses / stallions / broodmares 等）を作る共通処理。
        buildHorseLists(horsesList) {
          horsesList.forEach((horse) => Object.freeze(horse));
          this.horsesBase = Object.freeze(horsesList);
          this.horses = this.horsesBase.filter(
            (horse) => horse.sex === "0" || horse.sex === "1"
          );
          this.stallionsBase = Object.freeze(
            this.horses.filter((horse) => horse.sex === "0")
          );
          this.stallions = [...this.stallionsBase];
          this.broodmaresBase = Object.freeze(
            this.horses.filter((horse) => horse.sex === "1")
          );
          this.broodmares = [...this.broodmaresBase];
          this.horseDataLists = [this.horses, this.stallions, this.broodmares];
        },
        // detail chunk を取得して Map<id, detail> を返す。Promise / 結果を cache する。
        fetchHorseDetailChunk(chunkIndex) {
          const idx = Number(chunkIndex);
          if (!Number.isInteger(idx) || idx < 0) {
            return Promise.reject(
              new Error("Invalid detail chunk index: " + chunkIndex)
            );
          }
          if (this.horseDetailChunks[idx]) {
            return Promise.resolve(this.horseDetailChunks[idx]);
          }
          if (this.horseDetailChunkPromises[idx]) {
            return this.horseDetailChunkPromises[idx];
          }
          const padded = ("000" + idx).slice(-3);
          const url = `./json/dabimasFactor-details/dabimasFactor.details.${padded}.json`;
          const promise = fetch(url)
            .then((response) => {
              if (!response.ok) {
                throw new Error("detail chunk fetch failed: " + response.status);
              }
              return response.json();
            })
            .then((json) => {
              const map = new Map();
              (json.horseDetails || []).forEach((detail) => {
                map.set(detail.id, detail);
              });
              this.$set(this.horseDetailChunks, idx, map);
              return map;
            })
            .catch((error) => {
              // 失敗した promise は握り続けない（再試行可能にする）
              this.$delete(this.horseDetailChunkPromises, idx);
              throw error;
            });
          this.$set(this.horseDetailChunkPromises, idx, promise);
          return promise;
        },
        // freeze 済み summary を mutate せず、descendants を載せた新オブジェクトを返す（指摘 G）。
        hydrateHorseWithDetail(horse, descendants) {
          return { ...horse, descendants };
        },
        // 名前等から summary 側の馬を探す（旧データ・id 欠落時のフォールバック / 指摘 G）。
        findSummaryHorse(horse) {
          if (!horse || !Array.isArray(this.horsesBase)) {
            return null;
          }
          if (horse.id) {
            const byId = this.horsesBase.find((h) => h.id === horse.id);
            if (byId) {
              return byId;
            }
          }
          const name = horse.name || "";
          const subName = horse.subName || "";
          const sex = horse.sex;
          const matches = this.horsesBase.filter(
            (h) =>
              h.name === name && (h.subName || "") === subName && h.sex === sex
          );
          if (matches.length <= 1) {
            return matches[0] || null;
          }
          const factorsKey = JSON.stringify(horse.factors || []);
          const refined = matches.filter(
            (h) => JSON.stringify(h.factors || []) === factorsKey
          );
          return refined.length === 1 ? refined[0] : matches[0];
        },
        // 選択時に detail（descendants 15 件）を確定させる。state を壊さない純粋関数。
        ensureHorseDetail(horse) {
          if (!horse) {
            return Promise.resolve(horse);
          }
          // 1) 旧 snapshot 互換: 既に descendants を持つならそのまま使う（指摘 E）
          if (Array.isArray(horse.descendants) && horse.descendants.length === 15) {
            return Promise.resolve(horse);
          }
          // 2) 自家製馬: IndexedDB の customHorses から detail を解決（指摘 H）
          if (horse.source === "custom" || horse.customHorseId) {
            const customId = horse.customHorseId || horse.id;
            return this.getCustomHorseDetail(customId).then((detail) => {
              if (
                detail &&
                Array.isArray(detail.descendants) &&
                detail.descendants.length === 15
              ) {
                return this.hydrateHorseWithDetail(horse, detail.descendants);
              }
              return Promise.reject(
                new Error("Custom horse detail not found: " + customId)
              );
            });
          }
          // 3) 通常馬: summary 由来の detailChunk + id で chunk から（指摘 B）。
          let chunkIndex = horse.detailChunk;
          let lookupId = horse.id;
          if (chunkIndex === undefined || chunkIndex === null || !lookupId) {
            const matched = this.findSummaryHorse(horse);
            if (
              !matched ||
              matched.detailChunk === undefined ||
              matched.detailChunk === null
            ) {
              return Promise.reject(new Error("Horse detail metadata missing"));
            }
            chunkIndex = matched.detailChunk;
            lookupId = matched.id;
          }
          return this.fetchHorseDetailChunk(chunkIndex).then((detailMap) => {
            const detail = detailMap.get(lookupId);
            if (detail && Array.isArray(detail.descendants)) {
              return this.hydrateHorseWithDetail(horse, detail.descendants);
            }
            // id が chunk に無い → 名前等で 1 回だけ再解決を試す（指摘 G）
            const matched = this.findSummaryHorse(horse);
            if (
              matched &&
              matched.id !== lookupId &&
              matched.detailChunk !== undefined &&
              matched.detailChunk !== null
            ) {
              return this.fetchHorseDetailChunk(matched.detailChunk).then(
                (retryMap) => {
                  const retryDetail = retryMap.get(matched.id);
                  if (retryDetail && Array.isArray(retryDetail.descendants)) {
                    return this.hydrateHorseWithDetail(
                      horse,
                      retryDetail.descendants
                    );
                  }
                  return Promise.reject(
                    new Error(
                      "Horse detail not found: " + (horse.id || horse.name)
                    )
                  );
                }
              );
            }
            return Promise.reject(
              new Error("Horse detail not found: " + (horse.id || horse.name))
            );
          });
        },
        // idle 中に detail chunk を順次先読みする（全 chunk を一気に読まない / 案 B）。
        prefetchHorseDetails() {
          if (this.horseDetailPreloadStarted || !this.horseSummaryLoaded) {
            return;
          }
          const total = this.horseDetailTotalChunks;
          if (!total) {
            return;
          }
          this.horseDetailPreloadStarted = true;
          let next = 0;
          const pump = () => {
            while (next < total && this.horseDetailChunks[next]) {
              next++;
            }
            if (next >= total) {
              return;
            }
            const chunkIndex = next;
            next++;
            this.fetchHorseDetailChunk(chunkIndex)
              .catch(() => {})
              .then(() => {
                schedule();
              });
          };
          const schedule = () => {
            if (next >= total) {
              return;
            }
            if (typeof window.requestIdleCallback === "function") {
              window.requestIdleCallback(() => pump(), { timeout: 2000 });
            } else {
              setTimeout(pump, 300);
            }
          };
          if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(() => pump(), { timeout: 2000 });
          } else {
            setTimeout(pump, 1000);
          }
        },
        // ===== 自家製馬 detail（IndexedDB customHorses）=====
        // DB open処理は vue/logic/storage/combination-storage.js に集約済み。
        // 接続はこのプロパティで使い回す。
        ensureCustomHorseDb() {
          if (this.customHorseDb) {
            return Promise.resolve(this.customHorseDb);
          }
          return window.Dabimas.logic.storage.combinationStorage
            .openDB()
            .then((db) => {
              this.customHorseDb = db;
              return db;
            });
        },
        // customHorses store から 1 件取得（再選択時の detail 解決）。
        getCustomHorseDetail(customHorseId) {
          if (!customHorseId) {
            return Promise.resolve(null);
          }
          if (this.customHorseDetails[customHorseId]) {
            return Promise.resolve(this.customHorseDetails[customHorseId]);
          }
          return this.ensureCustomHorseDb().then(
            (db) =>
              new Promise((resolve, reject) => {
                const tx = db.transaction(["customHorses"], "readonly");
                const store = tx.objectStore("customHorses");
                const request = store.get(customHorseId);
                request.onsuccess = () => {
                  if (request.result) {
                    this.$set(
                      this.customHorseDetails,
                      customHorseId,
                      request.result
                    );
                  }
                  resolve(request.result || null);
                };
                request.onerror = () => reject(request.error);
              })
          );
        },
        // customHorses store を全件読み込んで customHorseDetails に載せる（候補再利用用）。
        loadCustomHorseDetails() {
          return this.ensureCustomHorseDb()
            .then(
              (db) =>
                new Promise((resolve, reject) => {
                  const tx = db.transaction(["customHorses"], "readonly");
                  const store = tx.objectStore("customHorses");
                  const request = store.getAll();
                  request.onsuccess = () => {
                    (request.result || []).forEach((record) => {
                      this.$set(this.customHorseDetails, record.id, record);
                    });
                    resolve(request.result || []);
                  };
                  request.onerror = () => reject(request.error);
                })
            )
            .catch(() => []);
        },
        // ===== localStorage 軽量化 =====
        // descendants / searchText / displayName を落とした保存用 snapshot を作る。
        stripHorseForStorage(horse) {
          if (!horse) {
            return horse;
          }
          const { descendants, searchText, displayName, ...rest } = horse;
          return rest;
        },
        serializeSelectedForStorage(selected) {
          if (!Array.isArray(selected)) {
            return selected;
          }
          return selected.map((horse) =>
            horse ? this.stripHorseForStorage(horse) : null
          );
        },
        // dabimasFactor / Category をまとめて軽量保存する。
        persistSelectedToStorage() {
          if (typeof window === "undefined" || !window.localStorage) {
            return;
          }
          window.localStorage.setItem(
            "dabimasFactor",
            JSON.stringify(this.serializeSelectedForStorage(this.selected))
          );
          window.localStorage.setItem(
            "dabimasFactorCategory",
            JSON.stringify(this.category)
          );
        },
        // detail 取得失敗時の再試行可能メッセージ（既存セルは保持済み・指摘 F）。
        notifyHorseDetailError(message) {
          this.horseDetailError = {
            show: true,
            message:
              message ||
              "血統データの取得に失敗しました。通信状況を確認して、もう一度選択してください。",
          };
        },
        dbinitializer() {
          // 旧 full JSON を読み込む退避経路（summary 取得失敗時のフォールバック）。
          const loadFullJsonFallback = () =>
            fetch("./json/dabimasFactor.json")
              .then((response) => {
                if (!response.ok) {
                  throw new Error("full json fetch failed: " + response.status);
                }
                return response.json();
              })
              .then((json) => {
                this.horseSummaryLoaded = false;
                this.buildHorseLists(json.horseLists);
                this.c4();
              });

          // 通常経路: 軽量 summary を読み込む。descendants はここでは持たない。
          fetch("./json/dabimasFactor.summary.json")
            .then((response) => {
              if (!response.ok) {
                throw new Error("summary fetch failed: " + response.status);
              }
              return response.json();
            })
            .then((json) => {
              this.horseSummaryChunkSize = json.chunkSize || 128;
              const horsesList = (json.horseLists || []).map((horse) =>
                this.normalizeHorseSummary(horse)
              );
              this.horseDetailTotalChunks = horsesList.reduce(
                (max, horse) =>
                  Math.max(max, (Number(horse.detailChunk) || 0) + 1),
                0
              );
              this.horseSummaryLoaded = true;
              this.buildHorseLists(horsesList);
              // 保存されていた場合はリストア処理を行う
              this.c4();
              // 初期表示を邪魔しない idle のタイミングで detail を先読みする
              this.prefetchHorseDetails();
            })
            .catch((error) => {
              // summary が無い・壊れている場合は従来の full JSON へ退避する（指摘 G）
              console.warn(
                "summary load failed, falling back to full json",
                error
              );
              return loadFullJsonFallback();
            })
            .catch((error) => {
              console.error("dbinitializer failed", error);
            });

            // 全兄弟データを読み込む
            fetch("./json/brosData.json")
            .then((response) => {
              return response.json();
            })
            .then((json) => {
              // jsonから取得 - フリーズして変更不可にする
              const brosDataList = json.brosData;
              brosDataList.forEach(bros => Object.freeze(bros));
              this.brosData = Object.freeze(brosDataList);
            });
        },
  });
})(window, window.Vue);
