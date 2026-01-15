import { EXERCISE, CALORIES, APP, BEER_COLORS, STYLE_COLOR_MAP, ALCOHOL_CONSTANTS } from './constants.js'; 
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

export const Calc = {
    /**
     * 【v4】プロフィールベースBMR計算 (ハリス・ベネディクト方程式)
     * 計画書 3.2.2 準拠
     */
    calculateBMR: (profile) => {
        const weight = (profile && profile.weight) ? profile.weight : APP.DEFAULTS.WEIGHT;
        const height = (profile && profile.height) ? profile.height : APP.DEFAULTS.HEIGHT;
        const age = (profile && profile.age) ? profile.age : APP.DEFAULTS.AGE;
        const gender = (profile && profile.gender) ? profile.gender : APP.DEFAULTS.GENDER;

        // ハリス・ベネディクト方程式 (kcal/day)
        if (gender === 'male') {
            return 66.47 + (13.75 * weight) + (5.003 * height) - (6.755 * age);
        } else {
            return 655.1 + (9.563 * weight) + (1.850 * height) - (4.676 * age);
        }
    },

    /**
     * 基礎代謝計算 (旧ロジック・互換性維持)
     * ※可能な限り calculateBMR を使用すること
     */
    getBMR: (profile) => {
        // 既存ロジックは残すが、新しい計算メソッドへ誘導
        return Calc.calculateBMR(profile);
    },
    
    /**
     * 消費カロリーレート計算
     * v4: calculateBMR を使用するように変更
     */
    burnRate: (mets, profile) => {
        // 分単位のBMRに変換し、METs倍率を掛ける
        const bmr = Calc.calculateBMR(profile);
        const netMets = Math.max(0, mets - 1);
        const rate = (bmr / 1440) * netMets; // 計画書 3.2 準拠: BMR / 1440 * (METs - 1)
        return (rate && rate > 0.1) ? rate : 0.1;
    },

    // ----------------------------------------------------------------------
    // 集約された計算ロジック
    // ----------------------------------------------------------------------

    calculateAlcoholCalories: (ml, abv, carbPer100ml) => {
        const _ml = ml || 0;
        const _abv = abv || 0;
        const _carb = carbPer100ml || 0;

        const alcoholG = _ml * (_abv / 100) * ALCOHOL_CONSTANTS.ETHANOL_DENSITY;
        const alcoholKcal = alcoholG * 7.0;
        const carbKcal = (_ml / 100) * _carb * ALCOHOL_CONSTANTS.CARB_CALORIES;

        return alcoholKcal + carbKcal;
    },

    calculateBeerDebit: (ml, abv, carbPer100ml, count = 1) => {
        const unitKcal = Calc.calculateAlcoholCalories(ml, abv, carbPer100ml);
        const totalKcal = unitKcal * (count || 1);
        return -Math.abs(totalKcal);
    },

    calculateExerciseBurn: (mets, minutes, profile) => {
        const rate = Calc.burnRate(mets, profile);
        return (minutes || 0) * rate;
    },

    calculateExerciseCredit: (baseKcal, streak) => {
        const multiplier = Calc.getStreakMultiplier(streak);
        return {
            kcal: Math.abs(baseKcal * multiplier),
            bonusMultiplier: multiplier
        };
    },
    
    // ----------------------------------------------------------------------

    /**
     * 【v4】ビール帳集計 (計画書 3.2.1)
     * 全ログデータからビールコレクション情報を生成する
     * @param {Array} allLogs - 全期間のログ (フィルタリングされていないこと)
     */
    getBeerStats: (allLogs) => {
        const statsMap = new Map(); // Key: "Brewery|Name"
        const styleCount = {}; // For Chart

        allLogs.filter(l => l.type === 'beer').forEach(log => {
            // breweryとnameでユニークキーを作成
            const brewery = log.brewery || 'Unknown';
            const name = log.name || 'Unknown Beer';
            const key = `${brewery}|${name}`;
            
            if (!statsMap.has(key)) {
                statsMap.set(key, {
                    brewery: log.brewery,
                    name: log.name, // 記録時の名前を使用
                    style: log.style,
                    totalMl: 0,
                    count: 0,
                    ratings: [],
                    lastDrank: 0,
                    timestamps: [],
                    abv: log.abv
                });
            }
            
            const entry = statsMap.get(key);
            
            // サイズ情報の解析 (sizeキーがあればそれを使用、なければ推測)
            let ml = 350;
            if (log.rawAmount) {
                ml = log.rawAmount;
            } else if (log.size) {
                // SIZE_DATA定数がimportされていない場合は簡易判定
                ml = parseInt(log.size) || 350;
            }
            
            entry.totalMl += ml * (log.count || 1);
            entry.count += 1;
            
            if (log.rating) entry.ratings.push(log.rating);
            entry.lastDrank = Math.max(entry.lastDrank, log.timestamp);
            entry.timestamps.push(log.timestamp);
            
            // Style集計
            const style = log.style || 'Other';
            styleCount[style] = (styleCount[style] || 0) + 1;
        });

        // 配列化とソート (飲んだ回数順)
        const beerStats = Array.from(statsMap.values()).map(item => ({
            ...item,
            averageRating: item.ratings.length ? (item.ratings.reduce((a,b)=>a+b,0) / item.ratings.length) : 0
        })).sort((a, b) => b.count - a.count);

        return { beerStats, styleCount };
    },

    getTankDisplayData: (currentKcal, currentMode, settings, profile) => {
        const modes = settings.modes || { mode1: APP.DEFAULTS.MODE1, mode2: APP.DEFAULTS.MODE2 };
        const baseEx = settings.baseExercise || APP.DEFAULTS.BASE_EXERCISE;

        const targetStyle = currentMode === 'mode1' ? modes.mode1 : modes.mode2;
        
        const unitKcal = CALORIES.STYLES[targetStyle] || 140; 
        const safeUnitKcal = unitKcal > 0 ? unitKcal : 140;
        
        const canCount = currentKcal / safeUnitKcal;
        const displayMinutes = Calc.convertKcalToMinutes(Math.abs(currentKcal), baseEx, profile);
        const baseExData = EXERCISE[baseEx] || EXERCISE['stepper'];
        
        const colorKey = STYLE_COLOR_MAP[targetStyle] || 'gold';
        const liquidColor = (currentMode === 'mode2' && BEER_COLORS[colorKey]) 
            ? BEER_COLORS[colorKey] 
            : BEER_COLORS['gold']; 
            
        const isHazy = colorKey === 'hazy';

        return {
            canCount,
            displayMinutes,
            baseExData,
            unitKcal: safeUnitKcal,
            targetStyle,
            liquidColor,
            isHazy
        };
    },

    convertKcalToMinutes: (kcal, exerciseKey, profile) => {
        const ex = EXERCISE[exerciseKey] || EXERCISE['stepper'];
        const mets = ex.mets;
        const rate = Calc.burnRate(mets, profile);
        return Math.round(kcal / rate);
    },

    convertKcalToBeerCount: (kcal, styleName) => {
        const unit = CALORIES.STYLES[styleName] || 140;
        const safeUnit = unit > 0 ? unit : 140;
        return (kcal / safeUnit).toFixed(1);
    },

    /**
     * ストリーク計算 (v3完全版)
     * @param {Array} logs - ログ配列
     * @param {Array} checks - チェック配列
     * @param {Object} profile - プロフィール
     * @param {string|number|Date} referenceDate - 基準日 (省略時は今日)
     */
    getCurrentStreak: (logs, checks, profile, referenceDate = null) => {
        const safeLogs = Array.isArray(logs) ? logs : [];
        const safeChecks = Array.isArray(checks) ? checks : [];

        // 【修正1】データが全くない場合は即座に0を返す
        if (safeLogs.length === 0 && safeChecks.length === 0) {
            return 0;
        }

        // 【修正2】最古の記録日を探す (これ以前はストリークに含めない)
        let minTs = Number.MAX_SAFE_INTEGER;
        let found = false;

        safeLogs.forEach(l => {
            if (l.timestamp < minTs) { minTs = l.timestamp; found = true; }
        });
        safeChecks.forEach(c => {
            if (c.timestamp < minTs) { minTs = c.timestamp; found = true; }
        });

        // データがある場合、その日を「開始日」とする
        const firstDate = found ? dayjs(minTs).startOf('day') : dayjs();

        const targetDate = referenceDate ? dayjs(referenceDate) : dayjs();
        
        // 基準日「そのもの」に活動があるかチェック
        const hasLogOnTarget = safeLogs.some(l => {
            return dayjs(l.timestamp).isSame(targetDate, 'day');
        });
        const hasCheckOnTarget = safeChecks.some(c => {
            return dayjs(c.timestamp).isSame(targetDate, 'day');
        });

        // 基準日に活動があればそこからスタート、なければ前日からスタート
        let checkDate = (hasLogOnTarget || hasCheckOnTarget) ? targetDate : targetDate.subtract(1, 'day');
        
        let streak = 0;

        // 高速化のためMap化
        const logMap = new Map();
        const checkMap = new Map();
        const checkDateEndLimit = checkDate.endOf('day').valueOf();

        safeLogs.forEach(l => {
            if (l.timestamp <= checkDateEndLimit) {
                const d = dayjs(l.timestamp).format('YYYY-MM-DD');
                if (!logMap.has(d)) logMap.set(d, { hasBeer: false, hasExercise: false });
                if (l.type === 'beer') logMap.get(d).hasBeer = true;
                if (l.type === 'exercise') logMap.get(d).hasExercise = true;
            }
        });
        safeChecks.forEach(c => {
            if (c.timestamp <= checkDateEndLimit) {
                const d = dayjs(c.timestamp).format('YYYY-MM-DD');
                checkMap.set(d, c.isDryDay);
            }
        });

        while (true) {
            // 【修正3】チェック日が「最古の記録日」より前になったら終了
            if (checkDate.isBefore(firstDate, 'day')) {
                break;
            }

            const dateStr = checkDate.format('YYYY-MM-DD');
            const dayLogs = logMap.get(dateStr) || { hasBeer: false, hasExercise: false };
            const isDryCheck = checkMap.get(dateStr) || false;

            // ★修正ポイント: 
            // 「今日」の場合は、「記録がない＝休肝日」という見なしルールを適用しない。
            // (まだ一日が終わっておらず、記録していないだけかもしれないため)
            const isToday = checkDate.isSame(dayjs(), 'day');
            
            // 過去の日付なら「ビール記録なし」でOK。今日なら「明示的な休肝チェック」が必要。
            const isPassiveDryAllowed = !isToday; 
            
            const isDry = isDryCheck || (isPassiveDryAllowed && !dayLogs.hasBeer);
            const workedOut = dayLogs.hasExercise;

            if (isDry || workedOut) {
                streak++;
                checkDate = checkDate.subtract(1, 'day');
            } else {
                break; // 飲んだ、または今日で記録がない
            }
            if (streak > 3650) break; 
        }

        return streak;
    },

    getStreakMultiplier: (streak) => {
        if (streak >= 14) return 1.3;
        if (streak >= 7) return 1.2;
        if (streak >= 3) return 1.1;
        return 1.0;
    },

    /**
     * ランク判定ロジック
     */
    getRecentGrade: (checks, logs, profile) => {
        const safeLogs = Array.isArray(logs) ? logs : [];
        const safeChecks = Array.isArray(checks) ? checks : [];

        const now = dayjs();
        let firstDate = now;
        if (safeLogs.length > 0) {
            safeLogs.forEach(l => { if (dayjs(l.timestamp).isBefore(firstDate)) firstDate = dayjs(l.timestamp); });
        }
        if (safeChecks.length > 0) {
            safeChecks.forEach(c => { if (dayjs(c.timestamp).isBefore(firstDate)) firstDate = dayjs(c.timestamp); });
        }
        
        const daysSinceStart = now.diff(firstDate, 'day') + 1;
        const isRookie = daysSinceStart <= 14;
        
        const recentSuccessDays = Calc.getCurrentStreak(safeLogs, safeChecks, profile);

        // --- ルーキー判定 ---
        if (isRookie) {
            const rate = daysSinceStart > 0 ? (recentSuccessDays / daysSinceStart) : 0;
            
            if (rate >= 0.7) return { rank: 'Rookie S', label: '新星 🌟', color: 'text-orange-500', bg: 'bg-orange-100', next: 1, current: recentSuccessDays, isRookie: true, rawRate: rate, targetRate: 1.0 };
            if (rate >= 0.4) return { rank: 'Rookie A', label: '期待の星 🔥', color: 'text-indigo-500', bg: 'bg-indigo-100', next: 1, current: recentSuccessDays, isRookie: true, rawRate: rate, targetRate: 0.7 };
            if (rate >= 0.25) return { rank: 'Rookie B', label: '駆け出し 🐣', color: 'text-green-500', bg: 'bg-green-100', next: 1, current: recentSuccessDays, isRookie: true, rawRate: rate, targetRate: 0.4 };
            return { rank: 'Beginner', label: 'たまご 🥚', color: 'text-gray-500', bg: 'bg-gray-100', next: 1, current: recentSuccessDays, isRookie: true, rawRate: rate, targetRate: 0.25 };
        }

        // --- 通常ユーザー判定 ---
        if (recentSuccessDays >= 20) return { rank: 'S', label: '神の肝臓 👼', color: 'text-purple-600', bg: 'bg-purple-100', next: null, current: recentSuccessDays };
        if (recentSuccessDays >= 12) return { rank: 'A', label: '鉄の肝臓 🛡️', color: 'text-indigo-600', bg: 'bg-indigo-100', next: 20, current: recentSuccessDays };
        if (recentSuccessDays >= 8)  return { rank: 'B', label: '健康志向 🌿', color: 'text-green-600', bg: 'bg-green-100', next: 12, current: recentSuccessDays };
        
        return { rank: 'C', label: '要注意 ⚠️', color: 'text-red-500', bg: 'bg-red-50', next: 8, current: recentSuccessDays };
    },

    getRedemptionSuggestion: (debtKcal, profile) => {
        const debt = Math.abs(debtKcal || 0);
        if (debt < 50) return null; 

        const exercises = ['hiit', 'running', 'stepper', 'walking'];
        const candidates = exercises.map(key => {
            const ex = EXERCISE[key];
            const rate = Calc.burnRate(ex.mets, profile);
            const mins = Math.ceil(debt / rate);
            return { key, label: ex.label, mins, icon: ex.icon };
        });

        const best = candidates.find(c => c.mins <= 30) || candidates.find(c => c.mins <= 60) || candidates[0];
        
        return best;
    },

    // ----------------------------------------------------------------
    // 【追加】 不足していたメソッド
    // ----------------------------------------------------------------

    /**
     * 指定日に飲酒ログがあるか (checkStatus.jsで使用)
     */
    hasAlcoholLog: (logs, timestamp) => {
        const target = dayjs(timestamp);
        return logs.some(l => l.type === 'beer' && dayjs(l.timestamp).isSame(target, 'day'));
    },

    /**
     * 日付ごとのステータス判定 (weekly.js/heatmapで使用)
     */
    getDayStatus: (date, logs, checks, profile) => {
        const d = dayjs(date);
        const dayStart = d.startOf('day').valueOf();
        const dayEnd = d.endOf('day').valueOf();

        const dayLogs = logs.filter(l => l.timestamp >= dayStart && l.timestamp <= dayEnd);
        const dayCheck = checks.find(c => c.timestamp >= dayStart && c.timestamp <= dayEnd);

        const hasBeer = dayLogs.some(l => l.type === 'beer');
        const hasExercise = dayLogs.some(l => l.type === 'exercise');
        const isDryDay = dayCheck ? dayCheck.isDryDay : false;

        // 収支計算
        let balance = 0;
        dayLogs.forEach(l => {
            const val = l.kcal !== undefined ? l.kcal : (l.type === 'exercise' ? (l.minutes * Calc.burnRate(6.0, profile)) : -150);
            balance += val;
        });

        if (isDryDay) return hasExercise ? 'rest_exercise' : 'rest';
        if (hasBeer) {
            if (hasExercise) {
                return balance >= 0 ? 'drink_exercise_success' : 'drink_exercise';
            }
            return 'drink';
        }
        if (hasExercise) return 'exercise';
        return 'none';
    },
    
    /**
     * 【v4】アーカイブ作成用: 期間データの集計 (Service.recalcImpactedHistory等で使用)
     * period_archives.result オブジェクトを生成する
     */
    getPeriodResult: (periodLogs, periodChecks, startDate, endDate, profile) => {
        // 1. 収支合計 (balance)
        let balance = 0;
        periodLogs.forEach(l => {
            balance += (l.kcal || 0);
        });
        
        // 2. 日数集計
        let drinkDays = 0;
        let exerciseDays = 0;
        const days = [];
        
        let currentDate = dayjs(startDate);
        const endD = dayjs(endDate);
        
        // 合計集計用
        let totalBeerMl = 0;
        let totalExerciseMin = 0;
        
        // 期間内の日次ループ
        while(currentDate.isBefore(endD) || currentDate.isSame(endD, 'day')) {
            const dayTs = currentDate.valueOf();
            
            // その日のステータス判定
            const status = Calc.getDayStatus(dayTs, periodLogs, periodChecks, profile);
            days.push(status); // 'drink' | 'rest' | 'both' | ...
            
            // カウント
            if (status.includes('drink')) drinkDays++;
            if (status.includes('exercise')) exerciseDays++;
            
            currentDate = currentDate.add(1, 'day');
        }
        
        // 詳細集計
        periodLogs.forEach(l => {
            if (l.type === 'beer') {
                // サイズ情報の解析
                let ml = 350;
                if (l.rawAmount) ml = l.rawAmount;
                else if (l.size) ml = parseInt(l.size) || 350;
                totalBeerMl += ml * (l.count || 1);
            }
            if (l.type === 'exercise') {
                totalExerciseMin += (l.minutes || 0);
            }
        });

        // 3. ランク判定 (期間終了時点でのグレードを使用するのが適切だが、
        // アーカイブとしては「その期間の成果」よりも「その人の状態」を記録するため、
        // ここでは単純に getRecentGrade を呼ぶ。ただし logs/checks は期間内データのみ渡すため、
        // 厳密な「過去28日」ではない可能性がある点に注意。
        // ※仕様上、rankは直近28日データが必要だが、アーカイブ再計算時は期間内データしか渡せないケースがある。
        // ここでは期間内データだけで判定する制約を受け入れる。
        const grade = Calc.getRecentGrade(periodChecks, periodLogs, profile);

        return {
            balance: balance,
            rank: grade.rank,
            drinkDays: drinkDays,
            exerciseDays: exerciseDays,
            days: days,
            summary: {
                totalBeerMl: totalBeerMl,
                totalExerciseMin: totalExerciseMin
            }
        };
    }
};