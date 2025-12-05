// 配合保存ダイアログコンポーネント

Vue.component('combination-dialog', {
  props: {
    value: {
      type: Boolean,
      default: false
    },
    allHorsesSet: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      db: null,
      savedConfigs: [],
      selectedId: null,
      newTitle: '',
      saving: false,
      restoring: false,
      deleting: false,
      toast: {
        show: false,
        message: '',
        type: 'success'
      }
    };
  },
  computed: {
    isOpen: {
      get() {
        return this.value;
      },
      set(val) {
        this.$emit('input', val);
      }
    }
  },
  watch: {
    async value(newVal) {
      console.log('CombinationDialog watch triggered, value:', newVal);
      if (newVal) {
        console.log('Initializing dialog...');
        await this.init();
      }
    }
  },
  created() {
    console.log('CombinationDialog created');
    console.log('Initial value prop:', this.value);
  },
  mounted() {
    console.log('CombinationDialog mounted');
    console.log('isOpen computed:', this.isOpen);
  },
  methods: {
    async init() {
      console.log('CombinationDialog init called');
      try {
        this.db = await this.openDB();
        console.log('DB opened successfully');
        await this.loadSavedConfigs();
        console.log('Configs loaded, count:', this.savedConfigs.length);
      } catch (error) {
        console.error('初期化エラー:', error);
        this.showToast('データベースの初期化に失敗しました', 'error');
      }
    },

    openDB() {
      return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
          reject(new Error('IndexedDBに対応していません'));
          return;
        }

        const request = indexedDB.open('DabifacCombinationDB', 1);

        request.onerror = () => {
          reject(request.error);
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          if (!db.objectStoreNames.contains('configs')) {
            const objectStore = db.createObjectStore('configs', {
              keyPath: 'id',
              autoIncrement: true
            });
            
            objectStore.createIndex('savedAt', 'savedAt', { unique: false });
          }
        };
      });
    },

    close() {
      this.isOpen = false;
      this.selectedId = null;
      this.newTitle = '';
    },

    async loadSavedConfigs() {
      try {
        const transaction = this.db.transaction(['configs'], 'readonly');
        const objectStore = transaction.objectStore('configs');
        const index = objectStore.index('savedAt');
        
        const request = index.openCursor(null, 'prev');
        const configs = [];

        return new Promise((resolve, reject) => {
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor && configs.length < 15) {
              configs.push(cursor.value);
              cursor.continue();
            } else {
              this.savedConfigs = configs;
              resolve();
            }
          };

          request.onerror = () => {
            reject(request.error);
          };
        });
      } catch (error) {
        console.error('読み込みエラー:', error);
        this.showToast('配合リストの読み込みに失敗しました', 'error');
      }
    },

    selectItem(id) {
      this.selectedId = id;
    },

    async saveConfig() {
      if (!this.newTitle.trim()) {
        this.showToast('タイトルを入力してください', 'error');
        return;
      }

      this.saving = true;

      try {
        const configData = {
          dabimasFactor: localStorage.getItem('dabimasFactor'),
          dabimasFactorCategory: localStorage.getItem('dabimasFactorCategory'),
          dabimasMemo: localStorage.getItem('dabimasMemo'),
          dabimasMemoStallion: localStorage.getItem('dabimasMemoStallion'),
          dabimasMemoBroodmare: localStorage.getItem('dabimasMemoBroodmare'),
          dabimasManualInbreed: localStorage.getItem('dabimasManualInbreed')
        };

        const configDataCopy = JSON.parse(JSON.stringify(configData));

        const config = {
          title: this.newTitle.trim(),
          savedAt: new Date().toISOString(),
          configData: configDataCopy
        };

        const transaction = this.db.transaction(['configs'], 'readwrite');
        const objectStore = transaction.objectStore('configs');
        const request = objectStore.add(config);

        request.onsuccess = () => {
          this.showToast(`「${this.newTitle}」を保存しました`, 'success');
          this.newTitle = '';
          this.loadSavedConfigs();
          this.saving = false;
        };

        request.onerror = () => {
          this.showToast('保存に失敗しました', 'error');
          this.saving = false;
        };
      } catch (error) {
        console.error('保存エラー:', error);
        this.showToast('保存に失敗しました', 'error');
        this.saving = false;
      }
    },

    async restoreConfig() {
      if (!this.selectedId) return;

      this.restoring = true;

      try {
        const transaction = this.db.transaction(['configs'], 'readonly');
        const objectStore = transaction.objectStore('configs');
        const request = objectStore.get(this.selectedId);

        request.onsuccess = () => {
          const config = request.result;
          
          if (config.configData.dabimasFactor) {
            localStorage.setItem('dabimasFactor', config.configData.dabimasFactor);
          }
          if (config.configData.dabimasFactorCategory) {
            localStorage.setItem('dabimasFactorCategory', config.configData.dabimasFactorCategory);
          }
          if (config.configData.dabimasMemo) {
            localStorage.setItem('dabimasMemo', config.configData.dabimasMemo);
          }
          if (config.configData.dabimasMemoStallion) {
            localStorage.setItem('dabimasMemoStallion', config.configData.dabimasMemoStallion);
          }
          if (config.configData.dabimasMemoBroodmare) {
            localStorage.setItem('dabimasMemoBroodmare', config.configData.dabimasMemoBroodmare);
          }
          if (config.configData.dabimasManualInbreed) {
            localStorage.setItem('dabimasManualInbreed', config.configData.dabimasManualInbreed);
          }

          this.$emit('restore', config.configData);
          
          this.showToast(`「${config.title}」を復元しました`, 'success');
          this.restoring = false;
          this.close();
        };

        request.onerror = () => {
          this.showToast('復元に失敗しました', 'error');
          this.restoring = false;
        };
      } catch (error) {
        console.error('復元エラー:', error);
        this.showToast('復元に失敗しました', 'error');
        this.restoring = false;
      }
    },

    async deleteConfig() {
      if (!this.selectedId) return;

      this.deleting = true;

      try {
        const transaction = this.db.transaction(['configs'], 'readwrite');
        const objectStore = transaction.objectStore('configs');
        const deleteRequest = objectStore.delete(this.selectedId);

        deleteRequest.onsuccess = () => {
          this.showToast('配合を削除しました', 'success');
          this.selectedId = null;
          this.loadSavedConfigs();
          this.deleting = false;
        };

        deleteRequest.onerror = () => {
          this.showToast('削除に失敗しました', 'error');
          this.deleting = false;
        };
      } catch (error) {
        console.error('削除エラー:', error);
        this.showToast('削除に失敗しました', 'error');
        this.deleting = false;
      }
    },

    showToast(message, type = 'success') {
      this.toast.message = message;
      this.toast.type = type;
      this.toast.show = true;
    },

    formatDate(isoString) {
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}/${month}/${day} ${hours}:${minutes}`;
    }
  },
  template: `
    <v-dialog
      v-model="isOpen"
      max-width="900px"
      persistent
      @keydown.esc="close"
    >
      <v-card>
        <v-card-title class="combination-dialog-header">
          <span class="combination-dialog-title">配合の保存・復元</span>
          <v-spacer></v-spacer>
          <v-btn icon @click="close" class="combination-dialog-close">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-card-text class="combination-dialog-body">
          <v-container fluid>
            <v-row :class="{ 'flex-column': $vuetify.breakpoint.smAndDown }">
              <v-col
                :cols="$vuetify.breakpoint.smAndDown ? 12 : 4"
                class="combination-input-area"
              >
                <h3 class="combination-section-title">
                  <v-icon small class="mr-1">mdi-content-save</v-icon>
                  新規保存
                </h3>

                <v-alert
                  v-if="!allHorsesSet"
                  type="warning"
                  dense
                  outlined
                  class="combination-warning-alert"
                >
                  すべての馬を入力してください
                </v-alert>

                <v-text-field
                  v-model="newTitle"
                  label="　配合タイトル（10文字まで）"
                  placeholder="例：クジラジャック配合"
                  outlined
                  dense
                  counter="10"
                  maxlength="10"
                  hide-details
                  :disabled="!allHorsesSet"
                  @keyup.enter="saveConfig"
                  class="combination-title-input"
                ></v-text-field>

                <div :style="$vuetify.breakpoint.smAndDown ? 'height: 12px;' : 'height: 14px;'"></div>

                <v-btn
                  color="primary"
                  block
                  @click="saveConfig"
                  :disabled="!allHorsesSet"
                  :loading="saving"
                  class="combination-save-btn"
                >
                  <v-icon left small>mdi-content-save</v-icon>
                  配合を保存
                </v-btn>
              </v-col>

              <v-col
                :cols="$vuetify.breakpoint.smAndDown ? 12 : 8"
                class="combination-list-area"
              >
                <h3 class="combination-section-title">
                  <v-icon small class="mr-1">mdi-format-list-bulleted</v-icon>
                  保存済み配合（最新15件）
                </h3>

                <div class="combination-saved-list">
                  <div
                    v-if="savedConfigs.length === 0"
                    class="combination-empty-message"
                  >
                    保存された配合がありません
                  </div>

                  <div
                    v-for="config in savedConfigs"
                    :key="config.id"
                    class="combination-list-item"
                    :class="{ selected: selectedId === config.id }"
                    @click="selectItem(config.id)"
                  >
                    <div class="combination-list-item-content">
                      <div class="combination-list-item-title">
                        {{ config.title }}
                      </div>
                      <div class="combination-list-item-date">
                        {{ formatDate(config.savedAt) }}
                      </div>
                    </div>
                    <v-icon
                      v-if="selectedId === config.id"
                      color="primary"
                      small
                    >
                      mdi-check-circle
                    </v-icon>
                  </div>
                </div>
              </v-col>
            </v-row>

            <v-row class="combination-button-area">
              <v-col
                :cols="$vuetify.breakpoint.smAndDown ? 12 : 6"
                class="py-1"
              >
                <v-btn
                  color="primary"
                  block
                  :disabled="!selectedId"
                  @click="restoreConfig"
                  :loading="restoring"
                >
                  <v-icon left small>mdi-reload</v-icon>
                  復元する
                </v-btn>
              </v-col>
              <v-col
                :cols="$vuetify.breakpoint.smAndDown ? 12 : 6"
                class="py-1"
              >
                <v-btn
                  color="error"
                  block
                  :disabled="!selectedId"
                  @click="deleteConfig"
                  :loading="deleting"
                >
                  <v-icon left small>mdi-delete</v-icon>
                  削除する
                </v-btn>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>
      </v-card>

      <v-snackbar
        v-model="toast.show"
        :color="toast.type"
        :timeout="3000"
        top
        :class="{ 'mobile-toast': $vuetify.breakpoint.smAndDown }"
      >
        {{ toast.message }}
      </v-snackbar>
    </v-dialog>
  `
});

console.log('CombinationDialog component registered successfully');
