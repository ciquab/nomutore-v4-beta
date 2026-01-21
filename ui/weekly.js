import { Calc } from '../logic.js';
import { Store, db } from '../store.js';
import { StateManager } from './state.js';
import { DOM } from './dom.js';

import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

export async function renderWeeklyAndHeatUp(logs, checks) {
    const profile = Store.getProfile();

    // アーカイブデータを含めた全ログの取得（v4仕様）
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

    // ストリーク計算とバッジ表示
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

    // ----------------------------------------------------
    // 1. Weekly Calendar (上部の1週間カレンダー)
    // ----------------------------------------------------
    const container = DOM.elements['weekly-calendar'] || document.getElementById('weekly-calendar');
    if (container) {
        // 月曜始まりロジック
        const today = dayjs();
        const currentDay = today.day() || 7; // Sun(0) -> 7
        const startOfWeek = today.subtract(currentDay - 1, 'day');
        
        let html = '';
        
        for (let i = 0; i < 7; i++) {
            const d = startOfWeek.add(i, 'day');
            const isToday = d.isSame(today, 'day');
            const status = Calc.getDayStatus(d, allLogsForDisplay, checks, profile);
            
            let bgClass = "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700";
            let textClass = "text-gray-400";
            let borderClass = "border";
            let iconHtml = '';

            // スマホ対応: アイコンを2つ並べるためのラッパー
            const dualIconWrapper = (icon1, icon2) => `
                <div class="flex items-center justify-center gap-[1px] transform scale-90">
                    ${icon1}
                    ${icon2}
                </div>
            `;

            switch (status) {
                case 'rest_exercise': // 休肝日 + 運動
                    bgClass = "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700";
                    textClass = "text-emerald-600 dark:text-emerald-400";
                    iconHtml = dualIconWrapper(
                        `<i class="ph-fill ph-coffee text-xs"></i>`,
                        `<i class="ph-fill ph-person-simple-run text-xs"></i>`
                    );
                    break;
                case 'rest': // 休肝日のみ
                    bgClass = "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800";
                    textClass = "text-emerald-500 dark:text-emerald-500";
                    iconHtml = `<i class="ph-fill ph-coffee text-lg"></i>`;
                    break;
                case 'drink_exercise_success': // 完済
                    bgClass = "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700";
                    textClass = "text-indigo-600 dark:text-indigo-400";
                    iconHtml = dualIconWrapper(
                        `<i class="ph-fill ph-beer-bottle text-xs"></i>`,
                        `<i class="ph-bold ph-check text-xs"></i>`
                    );
                    break;
                case 'drink_exercise': // 未完済 (ビール + ラン)
                    bgClass = "bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700";
                    textClass = "text-orange-600 dark:text-orange-400";
                    iconHtml = dualIconWrapper(
                        `<i class="ph-fill ph-beer-bottle text-xs"></i>`,
                        `<i class="ph-fill ph-person-simple-run text-xs"></i>`
                    );
                    break;
                case 'drink': // 飲酒のみ
                    bgClass = "bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800";
                    textClass = "text-orange-500 dark:text-orange-500";
                    iconHtml = `<i class="ph-fill ph-beer-bottle text-lg"></i>`;
                    break;
                case 'exercise': // 運動のみ
                    bgClass = "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
                    textClass = "text-blue-600 dark:text-blue-400";
                    iconHtml = `<i class="ph-fill ph-person-simple-run text-lg"></i>`;
                    break;
                default:
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
        
        // ラベル更新
        const label = document.getElementById('weekly-range-label');
        if (label) {
            const endOfWeek = startOfWeek.add(6, 'day');
            label.textContent = `${startOfWeek.format('M/D')} - ${endOfWeek.format('M/D')}`;
        }
    }

    // ----------------------------------------------------
    // 2. Heatmap (下部のヒートマップ) - v3ロジック適用
    // ----------------------------------------------------
    renderHeatmap(checks, allLogsForDisplay, profile);
}

export function renderHeatmap(checks, logs, profile) {
    const container = DOM.elements['heatmap-grid'] || document.getElementById('heatmap-grid');
    if (!container) return;

    const offsetWeeks = StateManager.heatmapOffset || 0;
    
    // 月曜始まり計算
    const today = dayjs();
    const dayOfWeek = today.day() === 0 ? 7 : today.day(); 
    const thisMonday = today.subtract(dayOfWeek - 1, 'day');

    const daysToShow = 28; 
    const startOfCurrentBlock = thisMonday.subtract(offsetWeeks * 7, 'day');
    const startDate = startOfCurrentBlock.subtract(3, 'week'); 

    let html = '';

    for (let i = 0; i < daysToShow; i++) {
        const d = startDate.add(i, 'day');
        const status = Calc.getDayStatus(d, logs, checks, profile);
        const isToday = d.isSame(dayjs(), 'day');
        
        // --- v3 Logic Restoration (絵文字スタイル) ---
        let bgClass = 'bg-gray-100 dark:bg-gray-800';
        let textClass = 'text-gray-300';
        let icon = '';
        
        switch(status) {
            case 'rest_exercise': // 休肝日+運動 (Green)
            case 'rest':          // 休肝日 (Green)
                bgClass = 'bg-emerald-400 border border-emerald-500 shadow-sm';
                textClass = 'text-white font-bold';
                icon = '☕';
                break;
                
            case 'drink_exercise_success': // 完済 (Blue + Yellow Border)
                bgClass = 'bg-blue-500 border-2 border-yellow-400 shadow-md ring-2 ring-yellow-200 dark:ring-yellow-900'; 
                textClass = 'text-white font-bold';
                icon = '🏅';
                break;
                
            case 'drink_exercise': // 飲酒+運動 (Blue) - ★ご質問の箇所
                bgClass = 'bg-blue-400 border border-blue-500 shadow-sm';
                textClass = 'text-white font-bold';
                icon = '💦';
                break;
                
            case 'drink': // 飲酒のみ (Red)
                bgClass = 'bg-red-400 border border-red-500 shadow-sm';
                textClass = 'text-white font-bold';
                icon = '🍺';
                break;
                
            case 'exercise': // 運動のみ (Cyan)
                bgClass = 'bg-cyan-400 border border-cyan-500 shadow-sm';
                textClass = 'text-white font-bold';
                icon = '👟';
                break;
                
            default: // データなし
                if (d.isAfter(dayjs())) {
                    // 未来
                    bgClass = 'bg-transparent border border-dashed border-gray-200 dark:border-gray-700 opacity-50';
                }
                break;
        }
        
        if (isToday) {
            bgClass += ' ring-2 ring-indigo-500 dark:ring-indigo-400 z-10';
        }

        // 日付表示（アイコンがない場合）
        const content = icon ? icon : `<span class="text-[10px] opacity-40 font-mono">${d.format('D')}</span>`;

        html += `
            <div class="heatmap-cell aspect-square rounded-lg flex flex-col items-center justify-center cursor-pointer transition hover:scale-110 active:scale-95 ${bgClass} ${textClass} relative"
                 title="${d.format('YYYY-MM-DD')}: ${status}"
                 onclick="UI.openCheckModal('${d.format('YYYY-MM-DD')}')">
                <span class="text-sm leading-none select-none filter drop-shadow-sm">${content}</span>
            </div>
        `;
    }

    container.innerHTML = html;
    
    // ヒートマップ期間ラベル更新
    const label = DOM.elements['heatmap-period-label'] || document.getElementById('heatmap-period-label');
    if (label) {
        const endDate = startDate.add(daysToShow - 1, 'day');
        label.textContent = `${startDate.format('M/D')} - ${endDate.format('M/D')}`;
    }
}