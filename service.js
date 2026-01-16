import { db, Store } from './store.js';
import { Calc } from './logic.js';
import { APP, EXERCISE, STYLE_SPECS } from './constants.js';
import { UI, refreshUI, toggleModal } from './ui/index.js';
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
                // アーカイブに保存されているスナップショットデータ（現在はlogsテーブルに残っている前提だが、
                // 将来的にlogsを消す実装にするならここで復元処理が必要）
                // 現状の仕様では「logsをクリア」して「period_archives」にのみ残す形になるため、
                // period_archives から logs への復元ロジックが必要だが、
                // 今回のStep 3.3の実装では「logsをクリアする」処理が入るため、
                // 復元ロジックは「期間ロールオーバー時にlogsを消去している場合」に必須となる。
                
                // ※重要: 今回のStep 3.3の実装では、ロールオーバー時にlogsを削除する仕様になっているため、
                // ここで「period_archives内のデータ」ではなく「logsテーブル」に戻す必要があるが、
                // Dexieのperiod_archivesスキーマには 'logs' そのものは含まれていない（summaryのみ）。
                // ★ Plan補正: Step 3.3の実装では、logsを削除せず timestamp フィルタで制御するか、
                // period_archives に full_logs を持たせる必要がある。
                // Dexieは容量制限が厳しくないため、period_archives に `logs: [...]` を持たせるのが安全。
                // ここでは、ロールオーバー時に logs を period_archives.logs に退避させ、
                // Permanent変更時にそれを logs テーブルに書き戻すロジックとする。
                
                let restoredCount = 0;
                for (const arch of archives) {
                    if (arch.logs && arch.logs.length > 0) {
                        // IDの衝突を避けるため、IDを除外して追加
                        const logsToRestore = arch.logs.map(({id, ...rest}) => rest);
                        await db.logs.bulkAdd(logsToRestore);
                        restoredCount += logsToRestore.length;
                    }
                }
                
                // アーカイブを空にする
                await db.period_archives.clear();
                
                // PERIOD_START をリセット (全期間表示)
                localStorage.setItem(APP.STORAGE_KEYS.PERIOD_START, 0);
                
                UI.showMessage(`${restoredCount}件の過去ログを復元しました`, 'success');
            }
        } 
        // --- Weekly/Monthlyへの変更 ---
        else {
            // 現在の期間を設定
            const start = Service.calculatePeriodStart(newMode);
            localStorage.setItem(APP.STORAGE_KEYS.PERIOD_START, start);
            
            // 注: 既存のlogsは消さない。
            // 次回のロールオーバー時に、新しい期間設定に基づいてアーカイブされる。
        }
    },

    /**
     * 期間開始日の計算
     */
    calculatePeriodStart: (mode) => {
        const now = dayjs();
        if (mode === 'weekly') {
            return now.startOf('week').valueOf(); // Sunday start? or Monday? dayjs defaults Sunday
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
        
        // 初回起動時などで設定がない場合は初期化して終了
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
            // 週の開始が変わっているか (現在時刻の週開始 != 保存された週開始)
            const currentWeekStart = now.startOf('week');
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
            // UI側で確認モーダルを出すためにイベント発火、またはここで処理
            // 自動処理する場合:
            console.log(`[Service] Rollover detected. Mode: ${mode}`);
            
            // 1. アーカイブ対象データの取得 (古い期間のログ)
            // 次の期間の開始(=今の期間の終了) より前のログ
            const logsToArchive = await db.logs.where('timestamp').below(nextStart).toArray();
            
            if (logsToArchive.length > 0) {
                // 2. period_archives に保存
                // 復元用に生ログも保存する (重要)
                const totalBalance = logsToArchive.reduce((sum, l) => sum + (l.kcal || 0), 0);
                
                await db.period_archives.add({
                    startDate: storedStart,
                    endDate: nextStart - 1,
                    mode: mode,
                    totalBalance: totalBalance,
                    logs: logsToArchive, // 全データ退避
                    createdAt: Date.now()
                });

                // 3. logs テーブルから削除
                const idsToDelete = logsToArchive.map(l => l.id);
                await db.logs.bulkDelete(idsToDelete);
                
                console.log(`[Service] Archived ${logsToArchive.length} logs.`);
            }

            // 4. 新しい期間開始日を保存
            localStorage.setItem(APP.STORAGE_KEYS.PERIOD_START, nextStart);
            
            return true; // ロールオーバーが発生したことを通知
        }

        return false;
    },

    // --- 既存メソッド (変更なし) ---
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
        await Service.recalcImpactedHistory(data.timestamp);
        await refreshUI();
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

    deleteLog: async (id) => {
        if (!confirm('この記録を削除しますか？')) return;
        try {
            const log = await db.logs.get(parseInt(id));
            const ts = log ? log.timestamp : Date.now();
            await db.logs.delete(parseInt(id));
            UI.showMessage('削除しました', 'success');
            await Service.recalcImpactedHistory(ts);
            await refreshUI();
        } catch (e) {
            console.error(e);
            UI.showMessage('削除に失敗しました', 'error');
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
            UI.showMessage(`${ids.length}件削除しました`, 'success');
            await Service.recalcImpactedHistory(oldestTs);
            await refreshUI();
            UI.toggleSelectAll(); 
        } catch (e) {
            console.error(e);
            UI.showMessage('一括削除に失敗しました', 'error');
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
            UI.showMessage('✅ デイリーチェックを更新しました', 'success');
        } else {
            await db.checks.add(data);
            UI.showMessage('✅ デイリーチェックを記録しました', 'success');
            UI.showConfetti();
        }
        if (formData.weight) {
            localStorage.setItem(APP.STORAGE_KEYS.WEIGHT, formData.weight);
        }
        await Service.recalcImpactedHistory(ts);
        await refreshUI();
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