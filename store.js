import { APP } from './constants.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

// DexieはHTMLで読み込んでいるため window.Dexie として存在します
export const db = new Dexie("NomutoreDB");

db.version(2).stores({
    logs: '++id, timestamp, type, name, kcal',
    checks: '++id, timestamp'
});

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

    migrateV3ToV4: async () => {
        // すでに移行済み（v4起動済み）なら何もしない
        if (localStorage.getItem('v4_migration_complete')) {
            return false; // ★修正: 初回ではないので false を返す
        }

        console.log('[Migration] Starting v3 to v4 migration...');

        if (!localStorage.getItem(APP.STORAGE_KEYS.PERIOD_MODE)) {
            localStorage.setItem(APP.STORAGE_KEYS.PERIOD_MODE, APP.DEFAULTS.PERIOD_MODE);
        }

        // 月曜始まりロジックで初期期間を設定
        if (!localStorage.getItem(APP.STORAGE_KEYS.PERIOD_START)) {
            const now = dayjs();
            const day = now.day() || 7; // Sun(0) -> 7, Mon(1) -> 1
            const startOfWeek = now.subtract(day - 1, 'day').startOf('day').valueOf();
            
            localStorage.setItem(APP.STORAGE_KEYS.PERIOD_START, startOfWeek);
            console.log(`[Migration] Set initial period start to ${dayjs(startOfWeek).format('YYYY-MM-DD')} (Monday Start)`);
        }

        if (!localStorage.getItem(APP.STORAGE_KEYS.UNIT_MODE)) {
            localStorage.setItem(APP.STORAGE_KEYS.UNIT_MODE, APP.DEFAULTS.UNIT_MODE);
        }

        if (!localStorage.getItem(APP.STORAGE_KEYS.ORB_STYLE)) {
            localStorage.setItem(APP.STORAGE_KEYS.ORB_STYLE, APP.DEFAULTS.ORB_STYLE);
        }

        localStorage.setItem('v4_migration_complete', 'true');
        console.log('[Migration] v4 migration completed successfully.');
        
        return true; // ★修正: 初回起動なので true を返す
    }
};

export const ExternalApp = {
    searchUntappd: (term) => {
        const query = encodeURIComponent(term);
        const webUrl = `https://untappd.com/search?q=${query}`;
        window.open(webUrl, '_blank');
    }
};