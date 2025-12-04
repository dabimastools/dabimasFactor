// IndexedDB操作用モジュール

const DB_NAME = 'DabifacCombinationDB';
const DB_VERSION = 1;
const STORE_NAME = 'configs';

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
      
      // オブジェクトストアが存在しない場合のみ作成
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true
        });
        
        // インデックスを作成（保存日時でソート可能にする）
        objectStore.createIndex('savedAt', 'savedAt', { unique: false });
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
