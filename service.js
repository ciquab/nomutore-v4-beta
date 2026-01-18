import { db, Store } from './store.js';
import { Calc } from './logic.js';
import { APP, EXERCISE, STYLE_SPECS } from './constants.js';
// UIオブジェクトではなく、機能を直接インポート
import { showMessage, showConfetti } from './ui/dom.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

// ロケールファイルはエラーの原因になるため削除し、手動計算で対応します

// ヘルパー: 月曜始まりの週頭を取得
const getStartOfWeek = (date = undefined) => {
    const d = dayjs(date);
    const day = d.day() || 7; // Sun(0)を7に変換 (Mon=1 ... Sun=7)
    return d.subtract(day - 1, 'day').startOf('day');
};

export const Service = {
    /**
     * 起動時に今日の空チェックインレコードが存在するか確認し、なければ作成する
     */
    ensureTodayCheckRecord: async () => {
        const todayStr = dayjs().format('YYYY-MM-DD');
        const startOfDay = dayjs().startOf('day').valueOf();
        const endOfDay = dayjs().endOf('day').valueOf();

        try {
            const existing = await db.checks.where('timestamp')
                .between(startOfDay, endOfDay)
                .first();

            if (!existing) {
                await db.checks.add({
                    timestamp: dayjs().valueOf(),
                    isDryDay: false,
                    waistEase: false,
                    footLightness: false,
                    waterOk: false,
                    fiberOk: false,
                    weight: null
                });
                console.log(`[Service] Created empty daily check for ${todayStr}`);
            }
        } catch (e) {
            console.error('[Service] Failed to ensure today check record:', e);
        }
    },

    /**
     * 履歴変更時の影響範囲再計算
     */
    recalcImpactedHistory: async (changedTimestamp) => {
        console.log('[Service] Recalculating history & archives from:', dayjs(changedTimestamp).format('YYYY-MM-DD'));
        
        const allLogs = await db.logs.toArray();
        const allChecks = await db.checks.toArray();
        const profile = Store.getProfile();

        const startDate = dayjs(changedTimestamp).startOf('day');
        const today = dayjs().endOf('day');
        
        let currentDate = startDate;
        let updateCount = 0;
        let safeGuard = 0;
        
        while (currentDate.isBefore(today) || currentDate.isSame(today, 'day')) {
            if (safeGuard++ > 365) break;

            const dayStart = currentDate.startOf('day').valueOf();
            const dayEnd = currentDate.endOf('day').valueOf();

            const streak = Calc.getCurrentStreak(allLogs, allChecks, profile, currentDate);
            const creditInfo = Calc.calculateExerciseCredit(100, streak); 
            const bonusMultiplier = creditInfo.bonusMultiplier;

            const daysExerciseLogs = allLogs.filter(l => 
                l.type === 'exercise' && 
                l.timestamp >= dayStart && 
                l.timestamp <= dayEnd
            );

            for (const log of daysExerciseLogs) {
                const mets = EXERCISE[log.exerciseKey] ? EXERCISE[log.exerciseKey].mets : 3.0;
                const baseBurn = Calc.calculateExerciseBurn(mets, log.minutes, profile);
                const updatedCredit = Calc.calculateExerciseCredit(baseBurn, streak);
                
                let newMemo = log.memo || '';
                newMemo = newMemo.replace(/Streak Bonus x[0-9.]+/g, '').trim();
                if (bonusMultiplier > 1.0) {
                    const bonusTag = `Streak Bonus x${bonusMultiplier.toFixed(1)}`;
                    newMemo = newMemo ? `${newMemo} ${bonusTag}` : bonusTag;
                }

                if (Math.abs(log.kcal - updatedCredit.kcal) > 0.1 || log.memo !== newMemo) {
                    await db.logs.update(log.id, {
                        kcal: updatedCredit.kcal,
                        memo: newMemo
                    });
                    updateCount++;
                }
            }
            currentDate = currentDate.add(1, 'day');
        }

        if (updateCount > 0) console.log(`[Service] Updated ${updateCount} logs.`);

        // アーカイブのサマリー更新
        try {
            const affectedArchives = await db.period_archives
                .where('endDate')
                .aboveOrEqual(changedTimestamp)
                .toArray();

            for (const archive of affectedArchives) {
                if (archive.startDate <= changedTimestamp) {
                    const periodLogs = await db.logs
                        .where('timestamp')
                        .between(archive.startDate, archive.endDate, true, true)
                        .toArray();

                    const totalBalance = periodLogs.reduce((sum, log) => sum + (log.kcal || 0), 0);
                    
                    await db.period_archives.update(archive.id, {
                        totalBalance: totalBalance,
                        updatedAt: Date.now()
                    });
                    console.log(`[Service] Updated archive #${archive.id} summary.`);
                }
            }
        } catch (e) {
            console.error('[Service] Failed to update archives:', e);
        }
    },

    /**
     * 【新規実装】期間設定の更新
     * - モード変更時の初期化や、過去データのUnarchiveを行う
     * @param {string} newMode - 'weekly' | 'monthly' | 'permanent'
     */
    updatePeriodSettings: async (newMode) => {
        const currentMode = localStorage.getItem(APP.STORAGE_KEYS.PERIOD_MODE);
        if (currentMode === newMode) return;

        localStorage.setItem(APP.STORAGE_KEYS.PERIOD_MODE, newMode);

        // --- Permanentへの変更: 全ログ復元 ---
        if (newMode === 'permanent') {
            const archives = await db.period_archives.toArray();
            if (archives.length > 0) {
                console.log(`[Service] Unarchiving ${archives.length} periods for Permanent mode...`);
                
                let restoredCount = 0;
                for (const arch of archives) {
                    if (arch.logs && arch.logs.length > 0) {
                        const logsToRestore = arch.logs.map(({id, ...rest}) => rest);
                        await db.logs.bulkAdd(logsToRestore);
                        restoredCount += logsToRestore.length;
                    }
                }
                
                await db.period_archives.clear();
                localStorage.setItem(APP.STORAGE_KEYS.PERIOD_START, 0);
                
                showMessage(`${restoredCount}件の過去ログを復元しました`, 'success');
            }
        } 
        // --- Weekly/Monthlyへの変更 ---
        else {
            const start = Service.calculatePeriodStart(newMode);
            localStorage.setItem(APP.STORAGE_KEYS.PERIOD_START, start);
        }
    },

    /**
     * 期間開始日の計算 (月曜始まり対応)
     */
    calculatePeriodStart: (mode) => {
        const now = dayjs();
        if (mode === 'weekly') {
            return getStartOfWeek(now).valueOf(); // 月曜始まり
        } else if (mode === 'monthly') {
            return now.startOf('month').valueOf();
        }
        return 0; // Permanent
    },

    /**
     * 【新規実装】期間ロールオーバーのチェックと実行
     */
    checkPeriodRollover: async () => {
        const mode = localStorage.getItem(APP.STORAGE_KEYS.PERIOD_MODE) || APP.DEFAULTS.PERIOD_MODE;
        
        // Permanentなら何もしない
        if (mode === 'permanent') return false;

        const storedStart = parseInt(localStorage.getItem(APP.STORAGE_KEYS.PERIOD_START));
        
        if (!storedStart) {
            const newStart = Service.calculatePeriodStart(mode);
            localStorage.setItem(APP.STORAGE_KEYS.PERIOD_START, newStart);
            return false;
        }

        const startDate = dayjs(storedStart);
        const now = dayjs();
        let shouldRollover = false;
        let nextStart = null;

        if (mode === 'weekly') {
            const currentWeekStart = getStartOfWeek(now); // 月曜始まりで計算
            if (!currentWeekStart.isSame(startDate, 'day')) {
                shouldRollover = true;
                nextStart = currentWeekStart.valueOf();
            }
        } else if (mode === 'monthly') {
            const currentMonthStart = now.startOf('month');
            if (!currentMonthStart.isSame(startDate, 'day')) {
                shouldRollover = true;
                nextStart = currentMonthStart.valueOf();
            }
        }

        if (shouldRollover) {
    console.log(`[Service] Rollover detected. Mode: ${mode}`);
    
    // トランザクションで囲む
    await db.transaction('rw', db.logs, db.period_archives, async () => {
        // 1. ログ取得
        const logsToArchive = await db.logs.where('timestamp').below(nextStart).toArray();
        
        if (logsToArchive.length > 0) {
            const totalBalance = logsToArchive.reduce((sum, l) => sum + (l.kcal || 0), 0);
            
            // 2. アーカイブ追加
            await db.period_archives.add({
                startDate: storedStart,
                    endDate: nextStart - 1,
                    mode: mode,
                    totalBalance: totalBalance,
                    logs: logsToArchive, 
                    createdAt: Date.now()
                });

                const idsToDelete = logsToArchive.map(l => l.id);
                await db.logs.bulkDelete(idsToDelete);
                
                console.log(`[Service] Archived ${logsToArchive.length} logs.`);
            }

            localStorage.setItem(APP.STORAGE_KEYS.PERIOD_START, nextStart);
    });
    return true; 
        }

        return false;
    },

    saveBeerLog: async (data, id = null) => {
        let name, kcal, abv, carb;
        if (data.isCustom) {
            name = data.type === 'dry' ? '蒸留酒 (糖質ゼロ)' : '醸造酒/カクテル';
            abv = data.abv;
            const ml = data.ml;
            carb = data.type === 'dry' ? 0.0 : 3.0;
            kcal = Calc.calculateBeerDebit(ml, abv, carb, 1);
        } else {
            const spec = STYLE_SPECS[data.style] || STYLE_SPECS['Custom'];
            abv = (data.userAbv !== undefined && !isNaN(data.userAbv)) ? data.userAbv : spec.abv;
            carb = spec.carb;
            const sizeMl = parseInt(data.size); 
            kcal = Calc.calculateBeerDebit(sizeMl, abv, carb, data.count);
            name = `${data.style}`;
            if (data.count !== 1) name += ` x${data.count}`;
        }
        const logData = {
            timestamp: data.timestamp,
            type: 'beer',
            name: name,
            kcal: kcal, 
            style: data.isCustom ? 'Custom' : data.style,
            size: data.isCustom ? data.ml : data.size,
            count: data.isCustom ? 1 : data.count,
            abv: abv,
            brewery: data.brewery,
            brand: data.brand,
            rating: data.rating,
            memo: data.memo,
            isCustom: data.isCustom,
            customType: data.isCustom ? data.type : null,
            rawAmount: data.isCustom ? data.ml : null
        };
        if (id) {
            await db.logs.update(parseInt(id), logData);
            showMessage('📝 記録を更新しました', 'success');
        } else {
            await db.logs.add(logData);
            if (Math.abs(kcal) > 500) {
                showMessage(`🍺 記録完了！ ${Math.round(Math.abs(kcal))}kcalの借金です😱`, 'error');
            } else {
                showMessage('🍺 記録しました！', 'success');
            }
            if (data.useUntappd && data.brewery && data.brand) {
                const query = encodeURIComponent(`${data.brewery} ${data.brand}`);
                window.open(`https://untappd.com/search?q=${query}`, '_blank');
            }
        }
        await Service.recalcImpactedHistory(data.timestamp);
        document.dispatchEvent(new CustomEvent('refresh-ui'));
    },

    saveExerciseLog: async (exerciseKey, minutes, dateVal, applyBonus, id = null) => {
        const profile = Store.getProfile();
        const mets = EXERCISE[exerciseKey] ? EXERCISE[exerciseKey].mets : 3.0;
        const baseBurnKcal = Calc.calculateExerciseBurn(mets, minutes, profile);
        let finalKcal = baseBurnKcal;
        let memo = '';
        const ts = dayjs(dateVal).startOf('day').add(12, 'hour').valueOf();
        if (applyBonus) {
            const logs = await db.logs.toArray();
            const checks = await db.checks.toArray();
            const streak = Calc.getCurrentStreak(logs, checks, profile, dayjs(ts));
            const creditInfo = Calc.calculateExerciseCredit(baseBurnKcal, streak);
            finalKcal = creditInfo.kcal;
            if (creditInfo.bonusMultiplier > 1.0) {
                memo = `Streak Bonus x${creditInfo.bonusMultiplier.toFixed(1)}`;
            }
        }
        const label = EXERCISE[exerciseKey] ? EXERCISE[exerciseKey].label : '運動';
        const logData = {
            timestamp: ts,
            type: 'exercise',
            name: label,
            kcal: finalKcal,
            minutes: minutes,
            exerciseKey: exerciseKey,
            rawMinutes: minutes,
            memo: memo
        };
        if (id) {
            await db.logs.update(parseInt(id), logData);
            showMessage('📝 運動記録を更新しました', 'success');
        } else {
            await db.logs.add(logData);
            const savedMin = Math.round(minutes);
            showMessage(`🏃‍♀️ ${savedMin}分の運動を記録しました！`, 'success');
            showConfetti();
        }
        await Service.recalcImpactedHistory(ts);
        document.dispatchEvent(new CustomEvent('refresh-ui'));
    },

    deleteLog: async (id) => {
        if (!confirm('この記録を削除しますか？')) return;
        try {
            const log = await db.logs.get(parseInt(id));
            const ts = log ? log.timestamp : Date.now();
            await db.logs.delete(parseInt(id));
            showMessage('削除しました', 'success');
            await Service.recalcImpactedHistory(ts);
            document.dispatchEvent(new CustomEvent('refresh-ui'));
        } catch (e) {
            console.error(e);
            showMessage('削除に失敗しました', 'error');
        }
    },

    bulkDeleteLogs: async (ids) => {
        if (!confirm(`${ids.length}件のデータを削除しますか？`)) return;
        try {
            let oldestTs = Date.now();
            for (const id of ids) {
                const log = await db.logs.get(id);
                if (log && log.timestamp < oldestTs) oldestTs = log.timestamp;
            }
            await db.logs.bulkDelete(ids);
            showMessage(`${ids.length}件削除しました`, 'success');
            await Service.recalcImpactedHistory(oldestTs);
            document.dispatchEvent(new CustomEvent('refresh-ui'));
        } catch (e) {
            console.error(e);
            showMessage('一括削除に失敗しました', 'error');
        }
    },

    saveDailyCheck: async (formData) => {
        const ts = dayjs(formData.date).startOf('day').add(12, 'hour').valueOf();
        const existing = await db.checks.where('timestamp')
            .between(dayjs(ts).startOf('day').valueOf(), dayjs(ts).endOf('day').valueOf())
            .first();
        const data = {
            timestamp: ts,
            isDryDay: formData.isDryDay,
            waistEase: formData.waistEase,
            footLightness: formData.footLightness,
            waterOk: formData.waterOk,
            fiberOk: formData.fiberOk,
            weight: formData.weight
        };
        if (existing) {
            await db.checks.update(existing.id, data);
            showMessage('✅ デイリーチェックを更新しました', 'success');
        } else {
            await db.checks.add(data);
            showMessage('✅ デイリーチェックを記録しました', 'success');
            showConfetti();
        }
        if (formData.weight) {
            localStorage.setItem(APP.STORAGE_KEYS.WEIGHT, formData.weight);
        }
        await Service.recalcImpactedHistory(ts);
        document.dispatchEvent(new CustomEvent('refresh-ui'));
    },

    getAllDataForUI: async () => {
        const periodStart = parseInt(localStorage.getItem(APP.STORAGE_KEYS.PERIOD_START)) || 0;
        const logs = await db.logs.where('timestamp').aboveOrEqual(periodStart).toArray();
        const checks = await db.checks.toArray();
        return { logs, checks };
    },

    getLogsWithPagination: async (offset, limit) => {
        const periodStart = parseInt(localStorage.getItem(APP.STORAGE_KEYS.PERIOD_START)) || 0;
        const totalCount = await db.logs.where('timestamp').aboveOrEqual(periodStart).count();
        const logs = await db.logs
            .where('timestamp').aboveOrEqual(periodStart)
            .reverse()
            .offset(offset)
            .limit(limit)
            .toArray();
        return { logs, totalCount };
    }
};