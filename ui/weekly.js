import { Calc } from '../logic.js';
import { Store } from '../store.js';
import { DOM } from './dom.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

// v4 Design: Phosphor Icons & Glassmorphism
export function renderWeeklyAndHeatUp(logs, checks) {
    const profile = Store.getProfile();
    const streak = Calc.getCurrentStreak(logs, checks, profile);
    const multiplier = Calc.getStreakMultiplier(streak);
    
    // --- Streak更新 ---
    const streakEl = document.getElementById('streak-value');
    if(streakEl) streakEl.textContent = streak;
    
    const badgeText = document.getElementById('streak-bonus-text');
    if (badgeText) {
        badgeText.textContent = `x${multiplier.toFixed(1)} Bonus`;
    }

    // --- Weekly Rhythm更新 ---
    const container = document.getElementById('weekly-rhythm-container');
    if (!container) return;
    
    const today = dayjs();
    const daysHtml = [];

    // 過去6日 + 今日 = 7日間
    for (let i = 6; i >= 0; i--) {
        const d = today.subtract(i, 'day');
        const status = Calc.getDayStatus(d, logs, checks, profile);
        const isToday = i === 0;
        const dayLabel = d.format('ddd'); // Mon, Tue...

        let icon = '';
        let iconClass = '';
        let containerClass = 'flex flex-col items-center gap-2 group cursor-pointer';
        let circleClass = 'w-8 h-8 rounded-full flex items-center justify-center text-sm transition group-hover:scale-110';

        // ステータスに応じたアイコンと色定義
        switch (status) {
            case 'rest': // 休肝日
            case 'rest_exercise':
                icon = 'ph-coffee';
                iconClass = 'ph-fill';
                circleClass += ' bg-base-200 dark:bg-base-700 border border-base-300 dark:border-base-600 text-green-600 dark:text-green-400';
                break;
            case 'drink': // 飲酒
                icon = 'ph-beer-bottle';
                iconClass = 'ph-fill';
                circleClass += ' bg-accent/10 text-accent border border-accent/20';
                break;
            case 'drink_exercise': // 飲んで動いた
            case 'drink_exercise_success':
                icon = 'ph-beer-stein'; // または ph-fire
                iconClass = 'ph-fill';
                circleClass += ' bg-accent text-black shadow-[0_0_10px_rgba(245,158,11,0.5)]';
                break;
            case 'exercise': // 運動のみ
                icon = 'ph-sneaker-move';
                iconClass = 'ph-fill';
                circleClass += ' bg-recovery/10 text-recovery border border-recovery/20';
                break;
            default: // 何もなし
                icon = '';
                circleClass += ' bg-transparent border border-dashed border-base-300 dark:border-base-600 opacity-50';
                break;
        }

        if (isToday) {
            // 今日の強調表示
            containerClass += ' relative';
            // circleClass += ' ring-2 ring-offset-1 ring-accent'; 
        }

        const dateStr = d.format('YYYY-MM-DD');

        daysHtml.push(`
            <div class="${containerClass}" data-date="${dateStr}" onclick="openBeerModal(null, '${dateStr}')">
                <span class="text-[10px] ${isToday ? 'text-accent font-bold' : 'text-text-mutedDark dark:text-text-muted'} transition-colors">${dayLabel}</span>
                <div class="${circleClass}">
                    ${icon ? `<i class="${iconClass} ${icon}"></i>` : ''}
                </div>
            </div>
        `);
    }

    container.innerHTML = daysHtml.join('');
}

// ヒートマップ (Cellar詳細などで使用。今回はPhase 2なのでWeeklyメイン)
export function renderHeatmap(checks, logs) {
    // Phase 3で実装予定のCellar内コンポーネントのため、現段階では空実装または簡易実装
}