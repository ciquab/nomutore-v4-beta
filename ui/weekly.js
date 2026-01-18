import { Calc } from '../logic.js';
import { Store, db } from '../store.js';
import { StateManager } from './state.js';
import { DOM } from './dom.js';

import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

export async function renderWeeklyAndHeatUp(logs, checks) {
    const profile = Store.getProfile();

    // --- ★追加: アーカイブデータの結合処理 ---
    let allLogsForDisplay = [...logs]; // 現在のログをコピー
    try {
        // period_archivesテーブルが存在すれば読み込む
        if (db.period_archives) {
            const archives = await db.period_archives.toArray();
            archives.forEach(arch => {
                if (arch.logs && Array.isArray(arch.logs)) {
                    // 過去のログを結合
                    allLogsForDisplay = allLogsForDisplay.concat(arch.logs);
                }
            });
        }
    } catch (e) {
        console.error("Failed to load archives for calendar:", e);
    }
    // ---------------------------------------

    // ★修正3: logs の代わりに allLogsForDisplay を使う
    const streak = Calc.getCurrentStreak(allLogsForDisplay, checks, profile);
    const multiplier = Calc.getStreakMultiplier ? Calc.getStreakMultiplier(streak) : 1.0;
    
    // Streak表示更新
    const streakEl = DOM.elements['streak-count'] || document.getElementById('streak-count');
    if(streakEl) streakEl.textContent = streak;
    
    // Badge更新
    const badge = DOM.elements['streak-badge'] || document.getElementById('streak-badge');
    if (badge) {
        if (multiplier > 1.0) {
            badge.innerHTML = `<i class="ph-fill ph-fire-simple mr-1"></i>x${multiplier.toFixed(1)} Bonus`;
            badge.className = "inline-flex items-center px-2 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full shadow-sm animate-pulse";
        } else {
            badge.innerHTML = `<i class="ph-bold ph-trend-flat mr-1"></i>x1.0 Normal`;
            badge.className = "inline-flex items-center px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-bold rounded-full border border-gray-200 dark:border-gray-600";
        }
    }

    // ★修正4: logs の代わりに allLogsForDisplay を渡す
    // (引数の順番は変えずに checks, logs, profile の順)
    renderHeatmap(checks, allLogsForDisplay, profile);
}

export function renderHeatmap(checks, logs, profile) {
    const container = DOM.elements['heatmap-grid'] || document.getElementById('heatmap-grid');
    if (!container) return;

    const offsetWeeks = StateManager.heatmapOffset || 0;
    const today = dayjs();
    const daysToShow = 28; // 4週間
    const endDate = today.subtract(offsetWeeks * 7, 'day');
    
    let html = '';

    // 開始日計算
    const startDate = endDate.subtract(daysToShow - 1, 'day');

    for (let i = 0; i < daysToShow; i++) {
        const d = startDate.add(i, 'day');
        const status = Calc.getDayStatus(d, logs, checks, profile);
        const isToday = d.isSame(dayjs(), 'day');
        
        let bgClass = "bg-gray-100 dark:bg-gray-800/50";
        let iconHtml = "";
        let borderClass = "border border-gray-200 dark:border-gray-700";
        let textClass = "text-gray-300 dark:text-gray-600";

        // アイコン定義
        switch (status) {
            case 'rest': // 休肝日 (Green)
            case 'rest_exercise':
                bgClass = "bg-emerald-100 dark:bg-emerald-900/30";
                borderClass = "border border-emerald-200 dark:border-emerald-800";
                textClass = "text-emerald-600 dark:text-emerald-400";
                // ★修正: ph-tea は存在しないことが多いため ph-coffee に変更
                iconHtml = `<i class="ph-fill ph-coffee text-lg"></i>`;
                break;
                
            case 'drink_exercise_success': // 完済 (Cyan)
                bgClass = "bg-cyan-100 dark:bg-cyan-900/30";
                borderClass = "border border-cyan-200 dark:border-cyan-800";
                textClass = "text-cyan-600 dark:text-cyan-400";
                iconHtml = `<i class="ph-fill ph-person-simple-run text-lg"></i>`;
                break;

            case 'drink_exercise': // 飲んだけど運動不足 (Orange)
                bgClass = "bg-orange-100 dark:bg-orange-900/30";
                borderClass = "border border-orange-200 dark:border-orange-800";
                textClass = "text-orange-600 dark:text-orange-400";
                iconHtml = `<i class="ph-fill ph-beer-bottle text-lg"></i>`;
                break;

            case 'drink': // 飲酒のみ (Red/Amber)
                bgClass = "bg-amber-100 dark:bg-amber-900/30";
                borderClass = "border border-amber-200 dark:border-amber-800";
                textClass = "text-amber-600 dark:text-amber-400";
                iconHtml = `<i class="ph-fill ph-beer-bottle text-lg"></i>`;
                break;
            
            case 'exercise': // 運動のみ (Indigo)
                bgClass = "bg-indigo-100 dark:bg-indigo-900/30";
                borderClass = "border border-indigo-200 dark:border-indigo-800";
                textClass = "text-indigo-600 dark:text-indigo-400";
                iconHtml = `<i class="ph-fill ph-person-simple-run text-lg"></i>`;
                break;
                
            default: // データなし
                iconHtml = `<span class="text-[10px] font-bold opacity-30">${d.format('D')}</span>`;
                break;
        }

        if (isToday) {
            borderClass = "border-2 border-indigo-500 dark:border-indigo-400 shadow-md shadow-indigo-500/20";
        }

        // ★修正: クリックで UI.openCheckModal を呼ぶ
        html += `
            <div class="aspect-square rounded-xl ${bgClass} ${borderClass} flex items-center justify-center ${textClass} transition-all hover:scale-105 active:scale-95 cursor-pointer relative group"
                 onclick="UI.openCheckModal('${d.format('YYYY-MM-DD')}')">
                ${iconHtml}
                ${isToday ? '<span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-white dark:border-gray-900"></span>' : ''}
            </div>
        `;
    }

    container.innerHTML = html;
    
    const label = DOM.elements['heatmap-period-label'] || document.getElementById('heatmap-period-label');
    if (label) {
        label.textContent = `${startDate.format('M/D')} - ${endDate.format('M/D')}`;
    }
}