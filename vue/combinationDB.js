// IndexedDB操作用モジュール

const DB_NAME = 'DabifacCombinationDB';
// v2: 自家製馬ライブラリ（customHorses）ストアを追加。
// CombinationDialog.js のインライン openDB() も同じ version / 同じストア構成に
// 揃えること。揃っていないと、低い version で open した側が VersionError になる。
const DB_VERSION = 2;
const STORE_NAME = 'configs';
const CUSTOM_STORE_NAME = 'customHorses';

/**
 * IndexedDBを開く
 */
export function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDBに対応していません'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 配合保存ストア（既存）。存在しない場合のみ作成。
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true
        });

        // インデックスを作成（保存日時でソート可能にする）
        objectStore.createIndex('savedAt', 'savedAt', { unique: false });
      }

      // 自家製馬ライブラリストア（v2 で追加）。
      // keyPath は安定 id（"custom-..."）。autoIncrement は使わない。
      if (!db.objectStoreNames.contains(CUSTOM_STORE_NAME)) {
        const customStore = db.createObjectStore(CUSTOM_STORE_NAME, {
          keyPath: 'id'
        });

        // 作成日時で降順取得できるようにする。
        customStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * 配合を保存
 */
export function saveConfig(db, title, configData) {
  return new Promise((resolve, reject) => {
    try {
      // configDataをディープコピーして保存可能な形式にする
      const configDataCopy = JSON.parse(JSON.stringify(configData));

      const config = {
        title: title,
        savedAt: new Date().toISOString(),
        configData: configDataCopy
      };

      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.add(config);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 保存済み配合を読み込み（最新15件、降順）
 */
export function loadConfigs(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const index = objectStore.index('savedAt');
    
    const request = index.openCursor(null, 'prev'); // 降順
    const configs = [];

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor && configs.length < 15) {
        configs.push(cursor.value);
        cursor.continue();
      } else {
        resolve(configs);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * 配合を削除
 */
export function deleteConfig(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * 配合を取得
 */
export function getConfig(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.get(id);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// ===== 自家製馬ライブラリ（customHorses ストア）=====

/**
 * 自家製馬を保存（id をキーにした upsert）。
 * 既存 id を渡すと上書き更新される（手動因子の編集などを想定）。
 * customHorse は { id, source, name, ..., factors, descendants, createdAt } 形式。
 */
export function saveCustomHorse(db, customHorse) {
  return new Promise((resolve, reject) => {
    try {
      if (!customHorse || typeof customHorse.id !== 'string' || !customHorse.id) {
        reject(new Error('customHorse.id（安定キー）が必要です'));
        return;
      }

      // IndexedDB に入れられる素の値へディープコピー（Vue の reactive proxy 等を除去）。
      const record = JSON.parse(JSON.stringify(customHorse));
      if (!record.createdAt) {
        record.createdAt = new Date().toISOString();
      }
      record.updatedAt = new Date().toISOString();

      const transaction = db.transaction([CUSTOM_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(CUSTOM_STORE_NAME);
      const request = objectStore.put(record);

      request.onsuccess = () => {
        resolve(record);
      };

      request.onerror = () => {
        reject(request.error);
      };
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 自家製馬を全件読み込み（createdAt 降順）。
 */
export function loadCustomHorses(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CUSTOM_STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(CUSTOM_STORE_NAME);
    const index = objectStore.index('createdAt');

    const request = index.openCursor(null, 'prev'); // 新しい順
    const horses = [];

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        horses.push(cursor.value);
        cursor.continue();
      } else {
        resolve(horses);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * 自家製馬を 1 件取得。
 */
export function getCustomHorse(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CUSTOM_STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(CUSTOM_STORE_NAME);
    const request = objectStore.get(id);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * 自家製馬を削除。
 */
export function deleteCustomHorse(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CUSTOM_STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(CUSTOM_STORE_NAME);
    const request = objectStore.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// ===== ストレージ永続化 / 残量 =====

/**
 * 永続ストレージを要求する（eviction 対策）。
 * 長期再利用が目的の自家製馬ライブラリ初回利用時に呼ぶ。
 * 戻り値は true（永続化済み）/ false（拒否 or 非対応）。
 */
export async function ensurePersistentStorage() {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    typeof navigator.storage.persist !== 'function'
  ) {
    return false;
  }
  try {
    if (
      typeof navigator.storage.persisted === 'function' &&
      (await navigator.storage.persisted())
    ) {
      return true;
    }
    return await navigator.storage.persist();
  } catch (error) {
    return false;
  }
}

/**
 * ストレージ使用量/上限の概算を返す（{ usage, quota } バイト）。
 * 非対応環境では null。
 */
export async function estimateStorage() {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    typeof navigator.storage.estimate !== 'function'
  ) {
    return null;
  }
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return { usage, quota };
  } catch (error) {
    return null;
  }
}
