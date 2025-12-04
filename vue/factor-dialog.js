/**
 * 因子選択ダイアログコンポーネント
 * 
 * 使い方:
 * <factor-dialog
 *   :visible.sync="factorDialogVisible"
 *   :selected-horse-name="selectedHorseName"
 *   :current-factors="currentFactors"
 *   @confirm="handleFactorConfirm"
 * ></factor-dialog>
 */

Vue.component('factor-dialog', {
  template: `
    <v-dialog
      :value="visible"
      @input="updateVisible"
      scrollable
      persistent
      max-width="480"
      content-class="refined-factor-dialog"
    >
      <v-card>
        <!-- 洗練されたヘッダー -->
        <div class="dialog-header">
          <div class="horse-name-display">
            <v-icon color="white" size="32">mdi-horse-variant</v-icon>
            <div>
              <div class="horse-name">{{ selectedHorseName }}</div>
              <div class="dialog-subtitle">因子を選択してください</div>
            </div>
          </div>
        </div>

        <v-card-text>
          <div class="factor-selection-label">
            <v-icon size="20">mdi-clipboard-list-outline</v-icon>
            <span>短速底長堅難から1〜2個選択</span>
          </div>

          <v-select
            v-model="manualFactorSelection"
            :items="factorOptions"
            multiple
            chips
            clearable
            class="manual-factor-select"
            :menu-props="{ contentClass: 'manual-factor-menu', offsetY: true }"
            outlined
            dense
            hide-details
            @change="handleManualFactorChange"
          >
            <template v-slot:item="{ item, on, attrs }">
              <v-list-item
                v-bind="attrs"
                v-on="on"
                :class="[
                  'manual-factor-option',
                  getManualFactorCssClass(item),
                  isManualFactorSelected(item) ? 'manual-factor-option--selected' : ''
                ]"
              >
                <v-list-item-content>
                  <v-list-item-title>{{ item }}</v-list-item-title>
                </v-list-item-content>
              </v-list-item>
            </template>
            <template v-slot:selection="{ attrs, item, selected }">
              <v-chip
                v-bind="attrs"
                :input-value="selected"
                close
                class="manual-factor-chip"
                :class="getManualFactorCssClass(item)"
                @click:close="handleManualChipClose(item, $event)"
              >
                {{ item }}
              </v-chip>
            </template>
          </v-select>

          <div class="selection-info">
            <v-icon size="18">mdi-information-outline</v-icon>
            <span>{{ selectionInfoText }}</span>
          </div>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            text
            class="action-button cancel-button"
            @click="cancelFactorSelection"
          >
            キャンセル
          </v-btn>
          <v-btn
            class="action-button confirm-button"
            @click="confirmFactorSelection"
          >
            <v-icon left size="20">mdi-check-circle-outline</v-icon>
            設定
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  `,
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    selectedHorseName: {
      type: String,
      default: ''
    },
    currentFactors: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      manualFactorSelection: [],
      factorOptions: ['短', '速', '底', '長', '堅', '難']
    };
  },
  computed: {
    selectionInfoText() {
      const count = this.manualFactorSelection.length;
      if (count === 0) {
        return '因子を選択してください';
      } else if (count === 1) {
        return '因子を1つ選択しています（もう1つ選択可能）';
      } else if (count === 2) {
        return '因子を2つ選択しています（最大数）';
      }
      return '';
    }
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        // ダイアログが開かれたときに現在の因子を設定
        this.manualFactorSelection = this.currentFactors.filter(
          factor => this.factorOptions.includes(factor)
        );
      }
    }
  },
  methods: {
    updateVisible(value) {
      this.$emit('update:visible', value);
    },
    cancelFactorSelection() {
      this.manualFactorSelection = [];
      this.$emit('update:visible', false);
    },
    confirmFactorSelection() {
      this.$emit('confirm', this.manualFactorSelection.slice(0, 2));
      this.$emit('update:visible', false);
      this.manualFactorSelection = [];
    },
    handleManualFactorChange(values) {
      const normalized = Array.isArray(values) ? values : [];
      const filtered = [];
      normalized.forEach((value) => {
        if (
          typeof value === 'string' &&
          this.factorOptions.includes(value) &&
          !filtered.includes(value)
        ) {
          filtered.push(value);
        }
      });
      if (filtered.length > 2) {
        filtered.splice(2);
      }
      this.manualFactorSelection = filtered;
    },
    normalizeManualFactorLabel(value) {
      if (typeof value === 'string') {
        return value.trim();
      }
      if (value && typeof value === 'object') {
        const label = value.value || value.text || value.key || '';
        return typeof label === 'string' ? label.trim() : '';
      }
      return '';
    },
    getManualFactorCssClass(value) {
      const label = this.normalizeManualFactorLabel(value);
      if (!label) {
        return '';
      }
      // factorMapはグローバルスコープにあると想定
      const code = factorMap.get(label) || '';
      return code && code !== '00' ? `f${code}` : '';
    },
    isManualFactorSelected(value) {
      const label = this.normalizeManualFactorLabel(value);
      if (!label) {
        return false;
      }
      return this.manualFactorSelection.includes(label);
    },
    handleManualChipClose(value, event) {
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
      const label = this.normalizeManualFactorLabel(value);
      if (!label) {
        return;
      }
      const updated = this.manualFactorSelection.filter(
        (factor) => factor !== label
      );
      this.handleManualFactorChange(updated);
    }
  }
});
