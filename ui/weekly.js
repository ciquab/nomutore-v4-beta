import { Calc } from '../logic.js';
import { Store, db } from '../store.js';
import { StateManager } from './state.js';
import { DOM } from './dom.js';

import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

export async function renderWeeklyAndHeatUp(logs, checks) {
    const profile = Store.getProfile();

    let allLogsForDisplay = await db.logs.toArray();
    try {
        if (db.period_archives) {
            const archives = await db.period_archives.toArray();
            archives.forEach(arch => {
                if (arch.logs && Array.isArray(arch.logs)) {
                    allLogsForDisplay = allLogsForDisplay.concat(arch.logs);
                }
            });
        }
    } catch (e) {
        console.error("Failed to load archives for calendar:", e);
    }

    const streak = Calc.getCurrentStreak(allLogsForDisplay, checks, profile);
    const multiplier = Calc.getStreakMultiplier ? Calc.getStreakMultiplier(streak) : 1.0;
    
    const streakEl = DOM.elements['streak-count'] || document.getElementById('streak-count');
    if(streakEl) streakEl.textContent = streak;
    
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

    renderHeatmap(checks, allLogsForDisplay, profile);
}

export function renderHeatmap(checks, logs, profile) {
    const container = DOM.elements['heatmap-grid'] || document.getElementById('heatmap-grid');
    if (!container) return;

    const offsetWeeks = StateManager.heatmapOffset || 0;
    
    // --- 【修正】月曜始まりにするロジック ---
    const today = dayjs();
    
    // 今日の曜日を取得 (0:Sun, 1:Mon ... 6:Sat)
    // dayjsの .day() は日曜始まり(0)なので、月曜始まり(1)基準に補正
    const dayOfWeek = today.day() === 0 ? 7 : today.day(); 
    
    // 「今週の月曜日」を取得
    const thisMonday = today.subtract(dayOfWeek - 1, 'day');

    // 表示する日数（4週間 = 28日）
    const daysToShow = 28; 

    // オフセット（過去へ遡るボタン用）を適用した「終了週の日曜日」
    // offsetWeeks=0 なら「今週末(または来週頭)」、1なら「先週末」...
    // ここではシンプルに「表示開始日」から計算する
    
    // 表示開始日 = (今週の月曜) - (オフセット週 * 7日) - (3週間前)
    // つまり、「今週を含む過去4週間」を表示したい
    const startOfCurrentBlock = thisMonday.subtract(offsetWeeks * 7, 'day');
    const startDate = startOfCurrentBlock.subtract(3, 'week'); // 3週間前から開始

    let html = '';

    // ヘッダー（曜日）を追加する場合（オプション）
    // const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    // ...

    for (let i = 0; i < daysToShow; i++) {
        const d = startDate.add(i, 'day');
        const status = Calc.getDayStatus(d, logs, checks, profile);
        const isToday = d.isSame(dayjs(), 'day');
        
        let bgClass = "bg-gray-100 dark:bg-gray-800/50";
        let iconHtml = "";
        let borderClass = "border border-gray-200 dark:border-gray-700";
        let textClass = "text-gray-300 dark:text-gray-600";

        switch (status) {
            case 'rest': 
            case 'rest_exercise':
                bgClass = "bg-emerald-100 dark:bg-emerald-900/30";
                borderClass = "border border-emerald-200 dark:border-emerald-800";
                textClass = "text-emerald-600 dark:text-emerald-400";
                iconHtml = `<i class="ph-fill ph-coffee text-lg"></i>`;
                break;
                
            case 'drink_exercise_success':
                bgClass = "bg-cyan-100 dark:bg-cyan-900/30";
                borderClass = "border border-cyan-200 dark:border-cyan-800";
                textClass = "text-cyan-600 dark:text-cyan-400";
                iconHtml = `<i class="ph-fill ph-person-simple-run text-lg"></i>`;
                break;

            case 'drink_exercise':
                bgClass = "bg-orange-100 dark:bg-orange-900/30";
                borderClass = "border border-orange-200 dark:border-orange-800";
                textClass = "text-orange-600 dark:text-orange-400";
                iconHtml = `<i class="ph-fill ph-beer-bottle text-lg"></i>`;
                break;

            case 'drink':
                bgClass = "bg-amber-100 dark:bg-amber-900/30";
                borderClass = "border border-amber-200 dark:border-amber-800";
                textClass = "text-amber-600 dark:text-amber-400";
                iconHtml = `<i class="ph-fill ph-beer-bottle text-lg"></i>`;
                break;
            
            case 'exercise':
                bgClass = "bg-indigo-100 dark:bg-indigo-900/30";
                borderClass = "border border-indigo-200 dark:border-indigo-800";
                textClass = "text-indigo-600 dark:text-indigo-400";
                iconHtml = `<i class="ph-fill ph-person-simple-run text-lg"></i>`;
                break;
                
            default:
                // 日付（数字）を表示
                iconHtml = `<span class="text-[10px] font-bold opacity-30 font-mono">${d.format('D')}</span>`;
                break;
        }

        if (isToday) {
            borderClass = "border-2 border-indigo-500 dark:border-indigo-400 shadow-md shadow-indigo-500/20";
        }

        html += `
            <div class="aspect-square rounded-xl ${bgClass} ${borderClass} flex items-center justify-center ${textClass} transition-all hover:scale-105 active:scale-95 cursor-pointer relative group"
                 onclick="UI.openCheckModal('${d.format('YYYY-MM-DD')}')">
                ${iconHtml}
                ${isToday ? '<span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-white dark:border-gray-900"></span>' : ''}
            </div>
        `;
    }

    container.innerHTML = html;
    
    // ラベル更新: 月/日 - 月/日
    const label = DOM.elements['heatmap-period-label'] || document.getElementById('heatmap-period-label');
    if (label) {
        // 終了日は startDate + 27日
        const endDate = startDate.add(daysToShow - 1, 'day');
        label.textContent = `${startDate.format('M/D')} - ${endDate.format('M/D')}`;
    }
}