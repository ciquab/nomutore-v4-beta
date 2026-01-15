import { APP } from './constants.js';

// DexieはHTMLで読み込んでいるため window.Dexie として存在します
export const db = new Dexie("NomutoreDB");

// Version 2: カロリー基準へ移行 (History)
db.version(2).stores({
    logs: '++id, timestamp, type, name, kcal',
    checks: '++id, timestamp'
});

// Version 3: v4 Update - 期間モードとアーカイブ機能の追加
// period_archives: 期間ごとの成績とヒートマップ用データを保存
db.version(3).stores({
    logs: '++id, timestamp, type, name, kcal',
    checks: '++id, timestamp',
    period_archives: '++id, startDate, endDate, mode'
});

export const Store = {
    getProfile: () => {
        // v4: プロフィールオブジェクトとして取得を試みる (移行過渡期用)
        const profileJson = localStorage.getItem(APP.STORAGE_KEYS.PROFILE);
        if (profileJson) {
            return JSON.parse(profileJson);
        }
        // Fallback: v3の個別のキーから取得して構成する
        return {
            weight: parseFloat(localStorage.getItem(APP.STORAGE_KEYS.WEIGHT)) || APP.DEFAULTS.WEIGHT,
            height: parseFloat(localStorage.getItem(APP.STORAGE_KEYS.HEIGHT)) || APP.DEFAULTS.HEIGHT,
            age: parseInt(localStorage.getItem(APP.STORAGE_KEYS.AGE)) || APP.DEFAULTS.AGE,
            gender: localStorage.getItem(APP.STORAGE_KEYS.GENDER) || APP.DEFAULTS.GENDER
        };
    },
    getModes: () => ({
        mode1: localStorage.getItem(APP.STORAGE_KEYS.MODE1) || APP.DEFAULTS.MODE1,
        mode2: localStorage.getItem(APP.STORAGE_KEYS.MODE2) || APP.DEFAULTS.MODE2
    }),
    getBaseExercise: () => localStorage.getItem(APP.STORAGE_KEYS.BASE_EXERCISE) || APP.DEFAULTS.BASE_EXERCISE,
    getTheme: () => localStorage.getItem(APP.STORAGE_KEYS.THEME) || APP.DEFAULTS.THEME,
    getDefaultRecordExercise: () => localStorage.getItem(APP.STORAGE_KEYS.DEFAULT_RECORD_EXERCISE) || APP.DEFAULTS.DEFAULT_RECORD_EXERCISE,
    
    // v4 New Getters
    getPeriodMode: () => localStorage.getItem(APP.STORAGE_KEYS.PERIOD_MODE) || APP.DEFAULTS.PERIOD_MODE,
    getPeriodStart: () => parseInt(localStorage.getItem(APP.STORAGE_KEYS.PERIOD_START)) || APP.DEFAULTS.PERIOD_START,
    getOrbStyle: () => localStorage.getItem(APP.STORAGE_KEYS.ORB_STYLE) || APP.DEFAULTS.ORB_STYLE,
    getUnitMode: () => localStorage.getItem(APP.STORAGE_KEYS.UNIT_MODE) || APP.DEFAULTS.UNIT_MODE,
    getCheckSchema: () => {
        const schema = localStorage.getItem(APP.STORAGE_KEYS.CHECK_SCHEMA);
        return schema ? JSON.parse(schema) : null; // デフォルトは初期化処理で設定
    }
};

export const ExternalApp = {
    searchUntappd: (term) => {
        const query = encodeURIComponent(term);
        const webUrl = `https://untappd.com/search?q=${query}`;
        window.open(webUrl, '_blank');
    }
};