import { Calc } from '../logic.js';
import { Store } from '../store.js';
import { StateManager } from './state.js';
import { DOM } from './dom.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

export function renderWeeklyAndHeatUp(logs, checks) {
    const profile = Store.getProfile();
    const streak = Calc.getCurrentStreak(logs, checks, profile);
    const multiplier = Calc.getStreakMultiplier(streak);
    
    // ストリーク数とバッジの更新
    const streakEl = DOM.elements['streak-count'];
    if(streakEl) streakEl.textContent = streak;
    
    const badge = DOM.elements['streak-badge'];
    if (badge) {
        if (multiplier > 1.0) {
            badge.textContent = `x${multiplier.toFixed(1)} Bonus`;
            badge.className = "text-[10px] px-2 py-0.5 rounded-full bg-accent text-black font-bold animate-pulse";
        } else {
            badge.textContent = "Streak";
            badge.className = "text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400";
        }
    }

    // ID変更: weekly-stamps -> weekly-calendar
    const container = DOM.elements['weekly-calendar'];
    if (!container) return;
    
    const fragment = document.createDocumentFragment();
    const today = dayjs();
    
    // 過去6日 + 今日
    for (let i = 6; i >= 0; i--) {
        const d = today.subtract(i, 'day');
        const status = Calc.getDayStatus(d, logs, checks, profile);
        const isToday = i === 0;

        // v4 Design: 丸型スタンプ (Glassmorphism friendly)
        let elClass = "aspect-square rounded-full flex items-center justify-center text-xs shadow-sm transition-all ";
        let content = "";
        
        // 今日の枠線強調
        if (isToday) {
            elClass += "ring-2 ring-white ring-offset-2 ring-offset-slate-900 font-bold ";
        }

        if (status === 'rest' || status === 'rest_exercise') {
            // 休肝日 (Recovery Color)
            elClass += "bg-recovery/20 text-recovery border border-recovery/50";
            content = "🍵";
        } 
        else if (status === 'drink_exercise_success') {
            // 飲んで完済 (Blue/Cyan)
            elClass += "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50";
            content = "🏃";
        }
        else if (status === 'drink' || status === 'drink_exercise') {
            // 飲んだ (Accent/Red)
            elClass += "bg-red-500/20 text-red-400 border border-red-500/50";
            content = "🍺";
        } 
        else {
            // 未記録/その他 (Slate)
            elClass += "bg-slate-700/50 text-slate-500 border border-slate-600/50";
            content = "-";
        }

        const div = document.createElement('div');
        div.className = elClass;
        div.textContent = content;
        div.title = d.format('MM/DD'); 
        div.dataset.date = d.format('YYYY-MM-DD');
        
        fragment.appendChild(div);
    }

    container.innerHTML = '';
    container.appendChild(fragment);
}

// ヒートマップ描画 (月間カレンダー)
export function renderHeatmap(checks, logs) {
    const grid = DOM.elements['heatmap-grid'];
    const label = DOM.elements['heatmap-period-label'];
    const prevBtn = DOM.elements['heatmap-prev'];
    const nextBtn = DOM.elements['heatmap-next'];
    
    if (!grid) return;

    // ページネーション制御
    const offset = StateManager.heatmapOffset;
    if (nextBtn) {
        if (offset <= 0) {
            nextBtn.setAttribute('disabled', 'true');
            nextBtn.classList.add('opacity-30', 'cursor-not-allowed');
        } else {
            nextBtn.removeAttribute('disabled');
            nextBtn.classList.remove('opacity-30', 'cursor-not-allowed');
        }
    }

    const profile = Store.getProfile();
    const offsetMonth = StateManager.heatmapOffset; 
    const baseDate = dayjs().subtract(offsetMonth, 'month');
    const startOfMonth = baseDate.startOf('month');
    const daysInMonth = baseDate.daysInMonth();
    
    if (label) label.textContent = baseDate.format('YYYY年 M月');

    // 曜日ヘッダー
    const weeks = ['日','月','火','水','木','金','土'];
    let html = '';
    weeks.forEach(w => {
        html += `<div class="text-center text-[10px] text-slate-500 font-bold py-1">${w}</div>`;
    });

    // 空白セル
    const startDay = startOfMonth.day();
    for (let i = 0; i < startDay; i++) {
        html += `<div></div>`;
    }

    // 日付セル
    for (let d = 1; d <= daysInMonth; d++) {
        const currentDay = baseDate.date(d);
        const dateStr = currentDay.format('YYYY-MM-DD');
        const isToday = currentDay.isSame(dayjs(), 'day');
        
        const status = Calc.getDayStatus(currentDay, logs, checks, profile);

        // v4 Dark Mode Styles
        let bgClass = 'bg-slate-800/50';
        let textClass = 'text-slate-500';
        let ringClass = '';

        switch (status) {
            case 'rest_exercise': 
                bgClass = 'bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.4)]'; 
                textClass = 'text-white font-bold'; 
                break;
            case 'rest': 
                bgClass = 'bg-emerald-600/40 border border-emerald-500/30'; 
                textClass = 'text-emerald-200'; 
                break;
            case 'drink_exercise_success':
                bgClass = 'bg-blue-500/80 shadow-[0_0_8px_rgba(59,130,246,0.4)]';
                textClass = 'text-white font-bold';
                break;
            case 'drink_exercise': 
                bgClass = 'bg-blue-600/40 border border-blue-500/30'; 
                textClass = 'text-blue-200'; 
                break;
            case 'drink': 
                bgClass = 'bg-red-500/30 border border-red-500/30'; 
                textClass = 'text-red-300'; 
                break;
            case 'exercise': 
                bgClass = 'bg-cyan-600/40 border border-cyan-500/30'; 
                textClass = 'text-cyan-200'; 
                break;
        }
        
        if (isToday) {
            ringClass = 'ring-1 ring-white ring-inset z-10';
        }

        html += `
            <div class="heatmap-cell aspect-square rounded-md flex items-center justify-center cursor-pointer transition hover:bg-white/10 ${bgClass} ${ringClass}" data-date="${dateStr}">
                <span class="text-[10px] ${textClass}">${d}</span>
            </div>
        `;
    }

    grid.innerHTML = html;
}