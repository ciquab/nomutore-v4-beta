import { APP } from './constants.js';
import { Service } from './service.js'; // 循環参照注意: ServiceがStoreを使うが、ここでは定数計算にServiceメソッドが必要なため動的importか、Service側の計算ロジックを分離すべきだが、今回は簡易的にServiceのメソッドを借りる前提で進める。
// ※実際にはServiceがStoreをimportしているため、ここでのimportは循環参照になるリスクが高い。
// 安全策として、Service.calculatePeriodStart のロジック（dayjs依存）をここでも使えるよう、dayjsを直接使うか、ロジックを分離するのが正解。
// ここでは dayjs を直接使用して計算する形に修正します。
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

// DexieはHTMLで読み込んでいるため window.Dexie として存在します
export const db = new Dexie("NomutoreDB");

// Version 2: カロリー基準へ移行 (History)
db.version(2).stores({
    logs: '++id, timestamp, type, name, kcal',
    checks: '++id, timestamp'
});

// Version 3: v4対応 (Period Mode & Enhanced Logs)
db.version(3).stores({
    logs: '++id, timestamp, type, name, kcal, memo, untappd_query',
    checks: '++id, timestamp',
    period_archives: '++id, startDate, endDate, mode'
});

export const Store = {
    getProfile: () => ({
        weight: parseFloat(localStorage.getItem(APP.STORAGE_KEYS.WEIGHT)) || APP.DEFAULTS.WEIGHT,
        height: parseFloat(localStorage.getItem(APP.STORAGE_KEYS.HEIGHT)) || APP.DEFAULTS.HEIGHT,
        age: parseInt(localStorage.getItem(APP.STORAGE_KEYS.AGE)) || APP.DEFAULTS.AGE,
        gender: localStorage.getItem(APP.STORAGE_KEYS.GENDER) || APP.DEFAULTS.GENDER
    }),
    getModes: () => ({
        mode1: localStorage.getItem(APP.STORAGE_KEYS.MODE1) || APP.DEFAULTS.MODE1,
        mode2: localStorage.getItem(APP.STORAGE_KEYS.MODE2) || APP.DEFAULTS.MODE2
    }),
    getBaseExercise: () => localStorage.getItem(APP.STORAGE_KEYS.BASE_EXERCISE) || APP.DEFAULTS.BASE_EXERCISE,
    getTheme: () => localStorage.getItem(APP.STORAGE_KEYS.THEME) || APP.DEFAULTS.THEME,
    getDefaultRecordExercise: () => localStorage.getItem(APP.STORAGE_KEYS.DEFAULT_RECORD_EXERCISE) || APP.DEFAULTS.DEFAULT_RECORD_EXERCISE,

    /**
     * 【新規実装】v3 -> v4 データマイグレーション
     * 既存のデータは一切削除せず、新機能に必要な初期設定値のみを補完する。
     */
    migrateV3ToV4: async () => {
        // 既に移行済みならスキップ
        if (localStorage.getItem('v4_migration_complete')) {
            return;
        }

        console.log('[Migration] Starting v3 to v4 migration...');

        // 1. 期間モードの初期化 (Default: Weekly)
        if (!localStorage.getItem(APP.STORAGE_KEYS.PERIOD_MODE)) {
            localStorage.setItem(APP.STORAGE_KEYS.PERIOD_MODE, APP.DEFAULTS.PERIOD_MODE);
        }

        // 2. 期間開始日の初期化
        // Service.calculatePeriodStart のロジックを再現 (Weekly想定)
        if (!localStorage.getItem(APP.STORAGE_KEYS.PERIOD_START)) {
            const now = dayjs();
            const startOfWeek = now.startOf('week').valueOf();
            localStorage.setItem(APP.STORAGE_KEYS.PERIOD_START, startOfWeek);
            console.log(`[Migration] Set initial period start to ${dayjs(startOfWeek).format('YYYY-MM-DD')}`);
        }

        // 3. 表示単位モード (kcal)
        if (!localStorage.getItem(APP.STORAGE_KEYS.UNIT_MODE)) {
            localStorage.setItem(APP.STORAGE_KEYS.UNIT_MODE, APP.DEFAULTS.UNIT_MODE);
        }

        // 4. オーブスタイル
        if (!localStorage.getItem(APP.STORAGE_KEYS.ORB_STYLE)) {
            localStorage.setItem(APP.STORAGE_KEYS.ORB_STYLE, APP.DEFAULTS.ORB_STYLE);
        }

        // 完了フラグの設定
        localStorage.setItem('v4_migration_complete', 'true');
        console.log('[Migration] v4 migration completed successfully.');
    }
};

export const ExternalApp = {
    searchUntappd: (term) => {
        const query = encodeURIComponent(term);
        const webUrl = `https://untappd.com/search?q=${query}`;
        window.open(webUrl, '_blank');
    }
};