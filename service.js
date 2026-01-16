import { db, Store } from './store.js';
import { Calc } from './logic.js';
import { APP, EXERCISE, STYLE_METADATA, STYLE_SPECS } from './constants.js'; // STYLE_METADATAを追加
import { UI, refreshUI } from './ui/index.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

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
     * 【重要】履歴変更時の影響範囲再計算 (カスケード更新)
     * 過去のログを変更した際、その日以降のストリークボーナスを全て再計算してDBを更新する。
     * @param {number} changedTimestamp - 変更があったログの日付(ms)
     */
    recalcImpactedHistory: async (changedTimestamp) => {
        console.log('[Service] Recalculating history from:', dayjs(changedTimestamp).format('YYYY-MM-DD'));
        
        const allLogs = await db.logs.toArray();
        const allChecks = await db.checks.toArray();
        const profile = Store.getProfile();

        // 変更日当日を含めて、今日までループ
        const startDate = dayjs(changedTimestamp).startOf('day');
        const today = dayjs().endOf('day');
        
        let currentDate = startDate;
        let updateCount = 0;

        // 無限ループ防止 (最大365日分)
        let safeGuard = 0;
        
        while (currentDate.isBefore(today) || currentDate.isSame(today, 'day')) {
            if (safeGuard++ > 365) break;

            const dayStart = currentDate.startOf('day').valueOf();
            const dayEnd = currentDate.endOf('day').valueOf();

            // 1. その日時点でのストリークを計算
            const streak = Calc.getCurrentStreak(allLogs, allChecks, profile, currentDate);
            
            // 2. その日の「運動ログ」を再計算して更新
            const daysExerciseLogs = allLogs.filter(l => 
                l.type === 'exercise' && 
                l.timestamp >= dayStart && 
                l.timestamp <= dayEnd
            );

            for (const log of daysExerciseLogs) {
                // 基礎カロリー再計算
                const mets = EXERCISE[log.exerciseKey] ? EXERCISE[log.exerciseKey].mets : 3.0;
                const baseBurn = Calc.calculateExerciseBurn(mets, log.minutes, profile);
                
                // ボーナス適用再計算
                const creditInfo = Calc.calculateExerciseCredit(baseBurn, streak);
                let newMemo = log.memo || '';
                
                // メモ内の古いボーナス表記を削除して更新
                newMemo = newMemo.replace(/Streak Bonus x[0-9.]+/g, '').trim();
                if (creditInfo.bonusMultiplier > 1.0) {
                    newMemo = newMemo ? `${newMemo} Streak Bonus x${creditInfo.bonusMultiplier.toFixed(1)}` : `Streak Bonus x${creditInfo.bonusMultiplier.toFixed(1)}`;
                }

                // 値が変わる場合のみDB更新
                if (Math.abs(log.kcal - creditInfo.kcal) > 0.1 || log.memo !== newMemo) {
                    await db.logs.update(log.id, {
                        kcal: creditInfo.kcal,
                        memo: newMemo
                    });
                    updateCount++;
                }
            }

            currentDate = currentDate.add(1, 'day');
        }

        if (updateCount > 0) {
            console.log(`[Service] Updated ${updateCount} logs due to streak recalc.`);
        }
    },

    /**
     * 飲酒ログの保存 (追加/更新)
     */
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
            rawAmount: data.isCustom ? data.ml : null,
            isUntappd: data.useUntappd // 追加
        };

        if (id) {
            await db.logs.update(parseInt(id), logData);
            UI.showMessage('📝 記録を更新しました', 'success');
        } else {
            await db.logs.add(logData);
            if (Math.abs(kcal) > 500) {
                UI.showMessage(`🍺 記録完了！ ${Math.round(Math.abs(kcal))}kcalの借金です😱`, 'error');
            } else {
                UI.showMessage('🍺 記録しました！', 'success');
            }
            if (data.useUntappd && data.brewery && data.brand) {
                const query = encodeURIComponent(`${data.brewery} ${data.brand}`);
                window.open(`https://untappd.com/search?q=${query}`, '_blank');
            }
        }

        // 履歴への影響を再計算
        await Service.recalcImpactedHistory(data.timestamp);
        await refreshUI();
    },

    /**
     * 運動ログの保存 (追加/更新)
     */
    saveExerciseLog: async (exerciseKey, minutes, dateVal, applyBonus, id = null) => {
        const profile = Store.getProfile();
        const mets = EXERCISE[exerciseKey] ? EXERCISE[exerciseKey].mets : 3.0;
        
        const baseBurnKcal = Calc.calculateExerciseBurn(mets, minutes, profile);
        let finalKcal = baseBurnKcal;
        let memo = '';
        
        // 日付処理
        let ts;
        if (dateVal && dateVal.includes('T')) {
            ts = dayjs(dateVal).valueOf();
        } else {
            ts = dayjs(dateVal || new Date()).startOf('day').add(12, 'hour').valueOf();
        }

        // ボーナス適用計算
        if (applyBonus) {
            const logs = await db.logs.toArray();
            const checks = await db.checks.toArray();
            // 指定日時点でのストリークを計算
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
            UI.showMessage('📝 運動記録を更新しました', 'success');
        } else {
            await db.logs.add(logData);
            const savedMin = Math.round(minutes);
            UI.showMessage(`🏃‍♀️ ${savedMin}分の運動を記録しました！`, 'success');
            UI.showConfetti();
        }
        
        await Service.recalcImpactedHistory(ts);
        await refreshUI();
    },

    /**
     * デイリーチェックの保存 (追加/更新)
     */
    saveDailyCheck: async (formData, editingId = null) => {
        // 日付の正規化 (00:00:00 ではなく、以前の仕様に合わせて12:00にしておくか、あるいはstartOf('day')で統一)
        // ここではフォームから渡された日付を基準にする
        const ts = dayjs(formData.date).startOf('day').add(12, 'hour').valueOf();

        // ターゲットIDの決定: 指定があればそれ、なければ日付重複チェック
        let targetId = editingId;
        if (!targetId) {
            const startOfDay = dayjs(ts).startOf('day').valueOf();
            const endOfDay = dayjs(ts).endOf('day').valueOf();
            const existing = await db.checks.where('timestamp')
                .between(startOfDay, endOfDay)
                .first();
            if (existing) targetId = existing.id;
        }

        const data = {
            timestamp: ts,
            isDryDay: formData.isDryDay,
            waistEase: formData.waistEase,
            footLightness: formData.footLightness,
            waterOk: formData.waterOk,
            fiberOk: formData.fiberOk,
            weight: formData.weight
        };

        if (targetId) {
            await db.checks.update(parseInt(targetId), data);
            UI.showMessage('✅ デイリーチェックを更新しました', 'success');
        } else {
            await db.checks.add(data);
            UI.showMessage('✅ デイリーチェックを記録しました', 'success');
            UI.showConfetti();
        }

        if (formData.weight) {
            localStorage.setItem(APP.STORAGE_KEYS.WEIGHT, formData.weight);
        }

        // 影響再計算
        await Service.recalcImpactedHistory(ts);
        await refreshUI();
    },

    /**
     * ログ削除
     */
    deleteLog: async (id) => {
        if(!confirm('この記録を削除しますか？')) return;
        try {
            const log = await db.logs.get(parseInt(id));
            const ts = log ? log.timestamp : Date.now();

            await db.logs.delete(parseInt(id));
            UI.showMessage('🗑️ 削除しました', 'info');
            
            await Service.recalcImpactedHistory(ts);
            await refreshUI();
        } catch (e) {
            console.error(e);
            UI.showMessage('削除に失敗しました', 'error');
        }
    },

    /**
     * ログ一括削除
     */
    bulkDeleteLogs: async (ids) => {
        if(!confirm(`${ids.length}件の記録を削除しますか？`)) return;
        try {
            // 再計算起点のために最古の日付を取得
            let oldestTs = Date.now();
            for (const id of ids) {
                const log = await db.logs.get(id);
                if (log && log.timestamp < oldestTs) oldestTs = log.timestamp;
            }

            await db.logs.bulkDelete(ids);
            UI.showMessage('🗑️ 一括削除しました', 'info');
            
            await Service.recalcImpactedHistory(oldestTs);
            await refreshUI();
            UI.toggleSelectAll(); // 選択解除
        } catch (e) {
            console.error(e);
            UI.showMessage('一括削除に失敗しました', 'error');
        }
    },

    /**
     * UI表示用の全データ取得
     */
    getAllDataForUI: async () => {
        const logs = await db.logs.toArray();
        const checks = await db.checks.toArray();
        return { logs, checks };
    },

    /**
     * ログリスト用データ取得 (ページネーション)
     */
    getLogsWithPagination: async (offset, limit) => {
        const totalCount = await db.logs.count();
        const logs = await db.logs.orderBy('timestamp').reverse().offset(offset).limit(limit).toArray();
        return { logs, totalCount };
    }
};