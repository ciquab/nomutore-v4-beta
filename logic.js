import { EXERCISE, CALORIES, APP, BEER_COLORS, STYLE_COLOR_MAP, ALCOHOL_CONSTANTS } from './constants.js'; 
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

export const Calc = {
    /**
     * 基礎代謝計算
     */
    getBMR: (profile) => {
        const weight = (profile && profile.weight) ? profile.weight : APP.DEFAULTS.WEIGHT;
        const height = (profile && profile.height) ? profile.height : APP.DEFAULTS.HEIGHT;
        const age = (profile && profile.age) ? profile.age : APP.DEFAULTS.AGE;
        const gender = (profile && profile.gender) ? profile.gender : APP.DEFAULTS.GENDER;

        const k = 1000 / 4.186; // kJ -> kcal conversion roughly
        
        if(gender === 'male') {
            return ((0.0481 * weight) + (0.0234 * height) - (0.0138 * age) - 0.4235) * k;
        } else {
            return ((0.0481 * weight) + (0.0234 * height) - (0.0138 * age) - 0.9708) * k;
        }
    },

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
        const _mets = mets || 6.0;
        const rate = Calc.burnRate(_mets, profile);
        return (minutes || 0) * rate;
    },

    calculateExerciseCredit: (baseKcal, streak) => {
        const multiplier = Calc.getStreakMultiplier(streak);
        return {
            kcal: Math.abs(baseKcal * multiplier),
            bonusMultiplier: multiplier
        };
    },
    
    burnRate: (mets, profile) => {
        const bmr = Calc.getBMR(profile);
        const netMets = Math.max(0, mets - 1);
        // (BMR / 24時間) * METs = 時給カロリー -> /60 で分給
        const rate = (bmr / 24 * netMets) / 60;
        return (rate && rate > 0.1) ? rate : 0.1;
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
        const liquidColor = BEER_COLORS[colorKey] || BEER_COLORS['gold']; 
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

    getCurrentStreak: (logs, checks, profile, referenceDate = null) => {
        const safeLogs = Array.isArray(logs) ? logs : [];
        const safeChecks = Array.isArray(checks) ? checks : [];

        if (safeLogs.length === 0 && safeChecks.length === 0) {
            return 0;
        }

        let minTs = Number.MAX_SAFE_INTEGER;
        let found = false;

        if (safeLogs.length > 0) {
            safeLogs.forEach(l => { if (l.timestamp < minTs) minTs = l.timestamp; });
            found = true;
        }
        if (safeChecks.length > 0) {
            safeChecks.forEach(c => { if (c.timestamp < minTs) minTs = c.timestamp; });
            found = true;
        }

        const firstDate = found ? dayjs(minTs).startOf('day') : dayjs();
        const targetDate = referenceDate ? dayjs(referenceDate) : dayjs();
        
        const hasLogOnTarget = safeLogs.some(l => dayjs(l.timestamp).isSame(targetDate, 'day'));
        const hasCheckOnTarget = safeChecks.some(c => dayjs(c.timestamp).isSame(targetDate, 'day'));

        let checkDate = (hasLogOnTarget || hasCheckOnTarget) ? targetDate : targetDate.subtract(1, 'day');
        
        let streak = 0;

        const logMap = new Map();
        const checkMap = new Map();
        
        safeLogs.forEach(l => {
            const d = dayjs(l.timestamp).format('YYYY-MM-DD');
            if (!logMap.has(d)) logMap.set(d, { hasBeer: false, hasExercise: false });
            if (l.type === 'beer') logMap.get(d).hasBeer = true;
            if (l.type === 'exercise') logMap.get(d).hasExercise = true;
        });
        
        safeChecks.forEach(c => {
            const d = dayjs(c.timestamp).format('YYYY-MM-DD');
            checkMap.set(d, c.isDryDay);
        });

        while (true) {
            if (checkDate.isBefore(firstDate, 'day')) {
                break;
            }

            const dateStr = checkDate.format('YYYY-MM-DD');
            const dayLogs = logMap.get(dateStr) || { hasBeer: false, hasExercise: false };
            
            const hasCheck = checkMap.has(dateStr);
            const isDryCheckValue = checkMap.get(dateStr); 

            // ビールを飲んだらストップ
            if (dayLogs.hasBeer) {
                break;
            }

            // チェック済みで、かつ休肝日でない（飲んでないけど休肝日チェックもしてない、はOKとするか？
            // ここでは「休肝日チェックがFalse（飲んだ）」ならストップとする
            if (hasCheck && isDryCheckValue === false) {
                break;
            }

            // ここまで来たらセーフ
            streak++;
            checkDate = checkDate.subtract(1, 'day');
            
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

        if (isRookie) {
            const rate = daysSinceStart > 0 ? (recentSuccessDays / daysSinceStart) : 0;
            
            if (rate >= 0.7) return { rank: 'Rookie S', label: '新星 🌟', color: 'text-orange-500', bg: 'bg-orange-100', next: 1, current: recentSuccessDays, isRookie: true, rawRate: rate, targetRate: 1.0 };
            if (rate >= 0.4) return { rank: 'Rookie A', label: '期待の星 🔥', color: 'text-indigo-500', bg: 'bg-indigo-100', next: 1, current: recentSuccessDays, isRookie: true, rawRate: rate, targetRate: 0.7 };
            if (rate >= 0.25) return { rank: 'Rookie B', label: '駆け出し 🐣', color: 'text-green-500', bg: 'bg-green-100', next: 1, current: recentSuccessDays, isRookie: true, rawRate: rate, targetRate: 0.4 };
            return { rank: 'Beginner', label: 'たまご 🥚', color: 'text-gray-500', bg: 'bg-gray-100', next: 1, current: recentSuccessDays, isRookie: true, rawRate: rate, targetRate: 0.25 };
        }

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

    hasAlcoholLog: (logs, timestamp) => {
        const target = dayjs(timestamp);
        return logs.some(l => l.type === 'beer' && dayjs(l.timestamp).isSame(target, 'day'));
    },

    getDayStatus: (date, logs, checks, profile) => {
        const d = dayjs(date);
        const dayStart = d.startOf('day').valueOf();
        const dayEnd = d.endOf('day').valueOf();

        const dayLogs = logs.filter(l => l.timestamp >= dayStart && l.timestamp <= dayEnd);
        const dayCheck = checks.find(c => c.timestamp >= dayStart && c.timestamp <= dayEnd);

        const hasBeer = dayLogs.some(l => l.type === 'beer');
        const hasExercise = dayLogs.some(l => l.type === 'exercise');
        const isDryDay = dayCheck ? dayCheck.isDryDay : false;

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

    getBeerStats: (allLogs) => {
        const beerLogs = allLogs.filter(l => l.type === 'beer');
        
        const totalCount = beerLogs.reduce((sum, l) => sum + (l.count || 1), 0);
        const totalMl = beerLogs.reduce((sum, l) => sum + (l.rawAmount || (l.size * (l.count || 1)) || 0), 0);
        const totalKcal = beerLogs.reduce((sum, l) => sum + Math.abs(l.kcal || 0), 0);

        const styleCounts = {};
        const statsMap = new Map(); 

        beerLogs.forEach(l => {
            const s = l.style || 'Unknown';
            styleCounts[s] = (styleCounts[s] || 0) + (l.count || 1);

            const brewery = l.brewery ? l.brewery.trim() : 'Unknown';
            const brand = l.brand ? l.brand.trim() : (l.name || 'Unknown Beer');
            const key = `${brewery}|${brand}`;

            if (!statsMap.has(key)) {
                statsMap.set(key, {
                    brewery: brewery === 'Unknown' ? '' : brewery,
                    name: brand,
                    count: 0,
                    totalMl: 0,
                    ratings: [],
                    lastDrank: 0,
                    style: s
                });
            }
            
            const entry = statsMap.get(key);
            entry.count += (l.count || 1);
            entry.totalMl += (l.rawAmount || (l.size * (l.count || 1)) || 0);
            if (l.rating > 0) entry.ratings.push(l.rating);
            if (l.timestamp > entry.lastDrank) entry.lastDrank = l.timestamp;
        });

        const uniqueBeers = statsMap.size;

        const topStyles = Object.entries(styleCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([style, count]) => ({ style, count }));

        const beerStats = Array.from(statsMap.values()).map(item => ({
            ...item,
            averageRating: item.ratings.length ? (item.ratings.reduce((a,b)=>a+b,0) / item.ratings.length) : 0
        })).sort((a, b) => b.count - a.count); 

        return {
            totalCount,
            totalMl,
            totalKcal,
            styleCounts,
            topStyles,
            uniqueBeersCount: uniqueBeers,
            logsCount: beerLogs.length,
            beerStats: beerStats 
        };
    },

    // --- Phase 1.5 Add: SNS Share Text Generator ---
    generateShareText: (log, balanceKcal = 0) => {
        const hashtags = APP.HASHTAGS;
        const balance = Math.round(balanceKcal);
        let text = '';

        if (log.type === 'beer') {
            const name = log.brand || log.name;
            const amount = log.rawAmount || log.size || 350;
            const count = log.count > 1 ? `x${log.count}` : '';
            const kcal = Math.abs(Math.round(log.kcal));
            
            // 飲酒報告
            text = `🍺 ${name} (${amount}ml${count}) を飲んで ${kcal}kcal の借金を背負いました...💸\n`;
            if (balance < 0) {
                text += `現在の借金総額: ${Math.abs(balance)}kcal 😱\n`;
            } else {
                text += `でも貯金があるから実質ゼロカロリー！✨ (+${balance}kcal)\n`;
            }

        } else if (log.type === 'exercise') {
            const name = log.name;
            const mins = log.minutes;
            const kcal = Math.round(log.kcal);
            
            // 運動報告
            text = `🏃‍♀️ ${name}を${mins}分やって、${kcal}kcal 返済しました！\n`;
            if (balance >= 0) {
                text += `ついに借金完済！今夜のビールが美味い！🍻\n`;
            } else {
                text += `完済まであと ${Math.abs(balance)}kcal... 頑張るぞ💪\n`;
            }
        } else if (log.isDryDay) {
            // 休肝日
            text = `🍵 今日は休肝日！肝臓をいたわっています。\n`;
        }

        return `${text} ${hashtags}`;
    }
};