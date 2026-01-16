import { APP } from './constants.js';

// DexieはHTMLで読み込んでいるため window.Dexie として存在します
export const db = new Dexie("NomutoreDB");

// Version 2: カロリー基準へ移行 (History)
db.version(2).stores({
    logs: '++id, timestamp, type, name, kcal',
    checks: '++id, timestamp'
});

// Version 3: v4対応 (Period Mode & Enhanced Logs)
// - logs: memo, untappd_query を検索可能にするためインデックスに追加
// - period_archives: 期間ごとの成績を保存する新テーブル
// - checks: 変更なし (全期間保持のため)
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
    getDefaultRecordExercise: () => localStorage.getItem(APP.STORAGE_KEYS.DEFAULT_RECORD_EXERCISE) || APP.DEFAULTS.DEFAULT_RECORD_EXERCISE
};

export const ExternalApp = {
    searchUntappd: (term) => {
        const query = encodeURIComponent(term);
        const webUrl = `https://untappd.com/search?q=${query}`;
        window.open(webUrl, '_blank');
    }
};