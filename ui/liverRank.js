import { Calc } from '../logic.js';
import { Store } from '../store.js';

export function renderLiverRank(checks, logs) {
    const profile = Store.getProfile();
    const gradeData = Calc.getRecentGrade(checks, logs, profile);
    
    // v4 IDs
    const els = {
        value: document.getElementById('rank-value'),
        label: document.getElementById('rank-label'),
        bar: document.getElementById('rank-progress-bar'),
        next: document.getElementById('rank-next-text')
    };

    if (!els.value || !els.label) return;

    // Rank Value & Label
    els.value.textContent = gradeData.rank;
    els.value.className = `text-2xl font-black ${gradeData.color.replace('text-', 'text-')}`; // Tailwind class reuse or direct mapping
    // Note: gradeData.color は v3 定義 (e.g. text-purple-600) なので、v4でも概ね使えるが微調整が必要かも
    
    els.label.textContent = gradeData.label;

    // Progress Bar
    let percent = 0;
    let nextMsg = "";

    if (gradeData.next) {
        if (gradeData.isRookie) {
             percent = (gradeData.rawRate / gradeData.targetRate) * 100;
             nextMsg = `Next: Rate ${Math.round(gradeData.targetRate * 100)}%`;
        } else {
            const prevTarget = gradeData.rank === 'A' ? 12 : (gradeData.rank === 'B' ? 8 : 0);
            const range = gradeData.next - prevTarget;
            const currentInRank = gradeData.current - prevTarget;
            percent = (currentInRank / range) * 100;
            nextMsg = `Next: ${gradeData.next - gradeData.current} days`;
        }
    } else {
        percent = 100;
        nextMsg = "Max Rank Reached";
    }

    if (els.bar) {
        els.bar.style.width = `${Math.min(100, Math.max(5, percent))}%`;
        // バーの色もランク色に合わせる
        els.bar.className = `h-full ${gradeData.color.replace('text-', 'bg-')}`;
    }

    if (els.next) {
        els.next.textContent = nextMsg;
    }
}