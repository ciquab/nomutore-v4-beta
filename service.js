import { db, Store } from './store.js';
import { Calc } from './logic.js';
import { APP, EXERCISE, STYLE_SPECS } from './constants.js';
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
     * 【v4】期間のロールオーバーをチェックする
     * アプリ起動時などに呼び出され、期間終了日を過ぎていればアーカイブ処理を行う
     */
    checkPeriodRollover: async () => {
        const mode = Store.getPeriodMode();
        let periodStart = Store.getPeriodStart();

        // 1. 初回起動など、期間開始日が未設定の場合は今日から開始
        if (!periodStart || periodStart === 0) {
            const now = dayjs().startOf('day').valueOf();
            localStorage.setItem(APP.STORAGE_KEYS.PERIOD_START, now);
            console.log('[Rollover] Initialized period start:', dayjs(now).format('YYYY-MM-DD'));
            return;
        }

        // Endlessモードは何もしない
        if (mode === 'permanent') return;

        // 2. 期間終了日の計算
        const startD = dayjs(periodStart);
        let endD;

        if (mode === 'weekly') {
            // 6日後 (合計7日間)
            endD = startD.add(6, 'day').endOf('day');
        } else if (mode === 'monthly') {
            // その月の月末
            endD = startD.endOf('month');
        } else {
            // Fallback (Weekly)
            endD = startD.add(6, 'day').endOf('day');
        }

        const now = dayjs();

        // 3. ロールオーバー判定 (現在時刻が終了日を過ぎているか)
        if (now.isAfter(endD)) {
            console.log(`[Rollover] Period ended (${startD.format('MM/DD')} - ${endD.format('MM/DD')}). Processing...`);
            
            try {
                const profile = Store.getProfile();
                
                // --- A. アーカイブ作成 ---
                // 期間内のデータを取得
                const logs = await db.logs.where('timestamp').between(startD.valueOf(), endD.valueOf(), true, true).toArray();
                const checks = await db.checks.where('timestamp').between(startD.valueOf(), endD.valueOf(), true, true).toArray();
                
                // 結果集計
                const result = Calc.getPeriodResult(logs, checks, startD.valueOf(), endD.valueOf(), profile);
                
                // DB保存
                await db.period_archives.add({
                    startDate: startD.valueOf(),
                    endDate: endD.valueOf(),
                    mode: mode,
                    result: result
                });
                
                // --- B. 新期間の設定 ---
                // 次の開始日は、旧終了日の翌日00:00
                const nextStartD = endD.add(1, 'day').startOf('day');
                localStorage.setItem(APP.STORAGE_KEYS.PERIOD_START, nextStartD.valueOf());
                
                // --- C. 借金繰越 (Carryover) ---
                // 収支がマイナスの場合は、新しい期間の初めに繰越ログを作成
                if (result.balance < 0) {
                    await db.logs.add({
                        timestamp: nextStartD.add(1, 'minute').valueOf(), // 開始直後
                        type: 'rollover',
                        name: '前期間からの繰越',
                        kcal: result.balance, // 負の値
                        minutes: 0,
                        memo: `From: ${startD.format('MM/DD')}-${endD.format('MM/DD')}`,
                        isSystem: true
                    });
                    
                    UI.showMessage(`🔄 期間が更新されました。\n借金 ${Math.abs(Math.round(result.balance))}kcal が繰り越されます😱`, 'error');
                } else {
                    UI.showMessage(`🎉 期間更新！\n前期間は完済達成です！素晴らしい！`, 'success');
                    UI.showConfetti();
                }
                
                console.log('[Rollover] Complete. New period starts:', nextStartD.format('YYYY-MM-DD'));
                
                // UIリフレッシュ (アーカイブ追加等を反映)
                await refreshUI();

            } catch (e) {
                console.error('[Rollover] Failed to process rollover:', e);
                UI.showMessage('期間更新処理に失敗しました', 'error');
            }
        }
    },

    /**
     * 【改修】履歴変更時の影響範囲再計算 (カスケード更新)
     * 1. 過去の確定済みアーカイブ期間に含まれる場合、そのアーカイブを再計算して更新 (v4 A案)
     * 2. 変更日以降の全期間のストリークとボーナスを再計算 (v3既存ロジック)
     * @param {number} changedTimestamp - 変更があったログの日付(ms)
     */
    recalcImpactedHistory: async (changedTimestamp) => {
        console.log('[Service] Recalculating history from:', dayjs(changedTimestamp).format('YYYY-MM-DD'));
        
        const profile = Store.getProfile();

        // --- A. アーカイブデータの遡及更新 (v4) ---
        // 変更された日付が、過去のアーカイブ期間に含まれているかチェック
        try {
            // changedTimestamp を含む期間アーカイブを検索
            const impactedArchive = await db.period_archives
                .where('startDate').belowOrEqual(changedTimestamp)
                .and(record => record.endDate >= changedTimestamp)
                .first();

            if (impactedArchive) {
                console.log(`[Service] Updating impacted archive: ID ${impactedArchive.id} (${dayjs(impactedArchive.startDate).format('MM/DD')} - ${dayjs(impactedArchive.endDate).format('MM/DD')})`);
                
                // その期間の全データを取得して再集計
                const periodLogs = await db.logs.where('timestamp').between(impactedArchive.startDate, impactedArchive.endDate, true, true).toArray();
                const periodChecks = await db.checks.where('timestamp').between(impactedArchive.startDate, impactedArchive.endDate, true, true).toArray();
                
                // 結果オブジェクトを再生成 (Logic層に委譲)
                const newResult = Calc.getPeriodResult(periodLogs, periodChecks, impactedArchive.startDate, impactedArchive.endDate, profile);
                
                // DB更新
                await db.period_archives.update(impactedArchive.id, {
                    result: newResult
                });
            }
        } catch (e) {
            console.error('[Service] Failed to update period archive:', e);
        }

        // --- B. ストリークとボーナスの再計算 (v3既存ロジック) ---
        // ここからは「現在進行形」の影響を計算するため、全データをロードする必要がある
        // (ストリークは期間を跨いで継続するため)
        const allLogs = await db.logs.toArray();
        const allChecks = await db.checks.toArray();
        
        // 変更日当日を含めて、今日までループ
        const startDate = dayjs(changedTimestamp).startOf('day');
        const today = dayjs().endOf('day');
        
        let currentDate = startDate;
        let updateCount = 0;

        // 念のため無限ループ防止 (最大365日分)
        let safeGuard = 0;
        
        while (currentDate.isBefore(today) || currentDate.isSame(today, 'day')) {
            if (safeGuard++ > 365) break;

            const dayStart = currentDate.startOf('day').valueOf();
            const dayEnd = currentDate.endOf('day').valueOf();

            // 1. その日時点でのストリークを計算
            const streak = Calc.getCurrentStreak(allLogs, allChecks, profile, currentDate);
            
            // 2. その日の「運動ログ」かつ「ボーナス適用あり(と推測される)」ものを探して更新
            const daysExerciseLogs = allLogs.filter(l => 
                l.type === 'exercise' && 
                l.timestamp >= dayStart && 
                l.timestamp <= dayEnd
            );

            for (const log of daysExerciseLogs) {
                // 基礎カロリー再計算
                const mets = EXERCISE[log.exerciseKey] ? EXERCISE[log.exerciseKey].mets : 3.0;
                const baseBurn = Calc.calculateExerciseBurn(mets, log.minutes, profile);
                
                // ボーナス適用
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
                    
                    // allLogs側のデータも更新しておかないと、次ループ以降のストリーク計算に影響が出る可能性がある
                    // (今回はストリーク判定にkcalを使っていないので大丈夫だが、念のため)
                    log.kcal = creditInfo.kcal;
                    log.memo = newMemo;
                    
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
     * 飲酒ログの追加・更新
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

        // ★追加: 過去データの変更によるストリーク再計算
        await Service.recalcImpactedHistory(data.timestamp);

        await refreshUI();
    },

    /**
     * 運動ログの追加・更新
     */
    saveExerciseLog: async (exerciseKey, minutes, dateVal, applyBonus, id = null) => {
        const profile = Store.getProfile();
        const mets = EXERCISE[exerciseKey] ? EXERCISE[exerciseKey].mets : 3.0;
        
        const baseBurnKcal = Calc.calculateExerciseBurn(mets, minutes, profile);
        let finalKcal = baseBurnKcal;
        let memo = '';
        
        // タイムスタンプ生成
        const ts = dayjs(dateVal).startOf('day').add(12, 'hour').valueOf();

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

        // ★追加: 運動ログの変更も、その後の整合性に影響する可能性があるため再計算
        await Service.recalcImpactedHistory(ts);

        await refreshUI();
    },

    /**
     * ログの削除
     */
    deleteLog: async (id) => {
        if (!confirm('この記録を削除しますか？')) return;
        try {
            const log = await db.logs.get(parseInt(id));
            const ts = log ? log.timestamp : Date.now();

            await db.logs.delete(parseInt(id));
            UI.showMessage('削除しました', 'success');
            
            // ★追加: 削除による影響再計算
            await Service.recalcImpactedHistory(ts);

            await refreshUI();
        } catch (e) {
            console.error(e);
            UI.showMessage('削除に失敗しました', 'error');
        }
    },

    /**
     * ログの一括削除
     */
    bulkDeleteLogs: async (ids) => {
        if (!confirm(`${ids.length}件のデータを削除しますか？`)) return;
        try {
            // 最も古いログの日付を探す（再計算の起点にするため）
            let oldestTs = Date.now();
            for (const id of ids) {
                const log = await db.logs.get(id);
                if (log && log.timestamp < oldestTs) oldestTs = log.timestamp;
            }

            await db.logs.bulkDelete(ids);
            UI.showMessage(`${ids.length}件削除しました`, 'success');
            
            // ★追加: 一括削除による影響再計算
            await Service.recalcImpactedHistory(oldestTs);

            await refreshUI();
            UI.toggleSelectAll(); 
        } catch (e) {
            console.error(e);
            UI.showMessage('一括削除に失敗しました', 'error');
        }
    },

    /**
     * デイリーチェックの保存
     */
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

        // ★追加: 休肝日情報の変更はストリークに直結するため再計算
        await Service.recalcImpactedHistory(ts);

        await refreshUI();
    },

    /**
     * 【改修】UI表示用のデータ取得
     * v4: 全件ではなく「現在の期間」の logs のみを取得する。
     * checks は Liver Rank (28日間) 計算用に必要な分を取得する。
     */
    getAllDataForUI: async () => {
        // 1. 現在の期間開始日を取得
        const periodStart = parseInt(localStorage.getItem(APP.STORAGE_KEYS.PERIOD_START)) || 0;
        
        // 2. ログデータの取得 (期間フィルタリング)
        // DexieのQuery機能を使用して高速化
        const logs = await db.logs.where('timestamp').aboveOrEqual(periodStart).toArray();
        
        // 3. チェックデータの取得 (ランク計算用は直近28日分が必要)
        // 期間モードに関わらず、Liver Rank計算のために過去28日分のデータは必須
        const rankStart = dayjs().subtract(28, 'day').startOf('day').valueOf();
        const checks = await db.checks.where('timestamp').aboveOrEqual(rankStart).toArray();
        
        return { logs, checks };
    },

    /**
     * ログリスト用データ取得 (ページネーション)
     * ※Cellar機能ではこのメソッドではなく、getAllDataForUIの結果やアーカイブデータを使用する可能性があるが
     * 既存のLogList互換性のために残す（期間フィルタは考慮すべきだが、一旦既存のまま）
     */
    getLogsWithPagination: async (offset, limit) => {
        // NOTE: v4では期間モードがあるため、このメソッドの扱いには注意が必要だが
        // Phase 1 では「現在の期間のログ」を表示するUIが主となる。
        // ここで期間フィルタを入れるかどうかはUI側の実装によるが、
        // 今回は「期間データの取得」が目的の getAllDataForUI がメインになるため、
        // こちらは既存動作を維持する（全件からのページネーション）。
        const totalCount = await db.logs.count();
        const logs = await db.logs
            .orderBy('timestamp')
            .reverse()
            .offset(offset)
            .limit(limit)
            .toArray();
        return { logs, totalCount };
    }
};