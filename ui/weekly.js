import { Calc } from '../logic.js';
import { Store } from '../store.js';
import { StateManager } from './state.js';
import { DOM } from './dom.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

export function renderWeeklyAndHeatUp(logs, checks) {
    const profile = Store.getProfile();
    const streak = Calc.getCurrentStreak(logs, checks, profile);
    const multiplier = Calc.getStreakMultiplier(streak);
    
    // Streak Count Update
    const streakEl = DOM.elements['streak-count'] || document.getElementById('streak-count');
    if(streakEl) streakEl.textContent = streak;
    
    // Badge Update
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

    // Heatmap Grid Rendering (v4 Style)
    // 過去28日分 (4週間) を表示
    renderHeatmap(checks, logs, profile);
}

export function renderHeatmap(checks, logs, profile) {
    const container = DOM.elements['heatmap-grid'] || document.getElementById('heatmap-grid');
    if (!container) return;

    // 現在の期間オフセット (ページネーション対応)
    const offsetWeeks = StateManager.heatmapOffset || 0;
    
    const today = dayjs();
    // 表示開始日: 今週の終わりから offsetWeeks 週前
    // グリッドは7列(1週間) x N行
    // ここではシンプルに「直近28日分」を7列4行で表示する
    
    const daysToShow = 28; // 4週間
    const endDate = today.subtract(offsetWeeks * 7, 'day');
    
    let html = '';

    // 過去から未来へ描画するため、startDateを計算
    // endDate - 27日 = startDate
    const startDate = endDate.subtract(daysToShow - 1, 'day');

    for (let i = 0; i < daysToShow; i++) {
        const d = startDate.add(i, 'day');
        const status = Calc.getDayStatus(d, logs, checks, profile);
        const isToday = d.isSame(dayjs(), 'day');
        
        let bgClass = "bg-gray-100 dark:bg-gray-800/50";
        let iconHtml = "";
        let borderClass = "border border-gray-200 dark:border-gray-700";
        let textClass = "text-gray-300 dark:text-gray-600";

        // Status Styling (Phosphor Icons)
        switch (status) {
            case 'rest': // 休肝日 (Green)
            case 'rest_exercise':
                bgClass = "bg-emerald-100 dark:bg-emerald-900/30";
                borderClass = "border border-emerald-200 dark:border-emerald-800";
                textClass = "text-emerald-500 dark:text-emerald-400";
                iconHtml = `<i class="ph-fill ph-tea text-lg"></i>`;
                break;
                
            case 'drink_exercise_success': // 完済 (Blue)
                bgClass = "bg-cyan-100 dark:bg-cyan-900/30";
                borderClass = "border border-cyan-200 dark:border-cyan-800";
                textClass = "text-cyan-500 dark:text-cyan-400";
                iconHtml = `<i class="ph-fill ph-sneaker-move text-lg"></i>`;
                break;

            case 'drink_exercise': // 飲んだけど運動不足 (Yellow/Orange)
                bgClass = "bg-orange-100 dark:bg-orange-900/30";
                borderClass = "border border-orange-200 dark:border-orange-800";
                textClass = "text-orange-500 dark:text-orange-400";
                iconHtml = `<i class="ph-fill ph-beer-bottle text-lg"></i>`; // 運動アイコン小をつける手もある
                break;

            case 'drink': // 飲酒のみ (Red)
                bgClass = "bg-red-100 dark:bg-red-900/30";
                borderClass = "border border-red-200 dark:border-red-800";
                textClass = "text-red-500 dark:text-red-400";
                iconHtml = `<i class="ph-fill ph-beer-stein text-lg"></i>`;
                break;
            
            case 'exercise': // 運動のみ (Blue)
                bgClass = "bg-blue-100 dark:bg-blue-900/30";
                borderClass = "border border-blue-200 dark:border-blue-800";
                textClass = "text-blue-500 dark:text-blue-400";
                iconHtml = `<i class="ph-fill ph-person-simple-run text-lg"></i>`;
                break;
                
            default: // データなし
                iconHtml = `<span class="text-[10px] font-bold opacity-30">${d.format('D')}</span>`;
                break;
        }

        if (isToday) {
            borderClass = "border-2 border-indigo-500 dark:border-indigo-400 shadow-md shadow-indigo-500/20";
            // 今日だけ少し大きく見せる等の演出も可能
        }

        html += `
            <div class="aspect-square rounded-xl ${bgClass} ${borderClass} flex items-center justify-center ${textClass} transition-all hover:scale-105 active:scale-95 cursor-pointer relative group"
                 data-date="${d.format('YYYY-MM-DD')}"
                 onclick="UI.openBeerModal(null, '${d.format('YYYY-MM-DD')}')">
                ${iconHtml}
                ${isToday ? '<span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-white dark:border-gray-900"></span>' : ''}
            </div>
        `;
    }

    container.innerHTML = html;
    
    // 期間ラベルの更新
    const label = DOM.elements['heatmap-period-label'] || document.getElementById('heatmap-period-label');
    if (label) {
        label.textContent = `${startDate.format('M/D')} - ${endDate.format('M/D')}`;
    }
}