import { Calc } from '../logic.js';
import { DOM, escapeHtml } from './dom.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

export function renderCheckStatus(checks, logs) {
    const status = DOM.elements['check-status'] || document.getElementById('check-status');
    if(!status) return;

    const today = dayjs();
    const yest = today.subtract(1, 'day');
    let targetCheck = null; let type = 'none';

    if (checks.length > 0) {
        for(let i=checks.length-1; i>=0; i--) {
            const c = checks[i];
            const checkDay = dayjs(c.timestamp);
            if (checkDay.isSame(today, 'day')) { targetCheck = c; type = 'today'; break; }
            if (checkDay.isSame(yest, 'day')) { targetCheck = c; type = 'yesterday'; break; }
        }
    }

    // クラス定義 (LiverRankと高さを合わせるため h-full flex flex-col を使用)
    let bgClass = "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300";
    
    if (type === 'today') {
        bgClass = "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300";
    } else if (type === 'yesterday') {
        bgClass = "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200";
    }

    // コンテナ自体のスタイルを上書き
    status.className = `p-4 rounded-2xl border shadow-sm transition-colors cursor-pointer relative overflow-hidden flex flex-col justify-between h-full min-h-[140px] ${bgClass}`;

    if (type !== 'none') {
        const msg = getCheckMessage(targetCheck, logs);
        const title = type === 'today' ? "Today's Check" : "Yesterday";
        
        let weightHtml = '';
        if(targetCheck.weight) {
            weightHtml = `<div class="mt-auto text-right"><span class="text-[10px] font-bold bg-black/5 dark:bg-white/10 px-2 py-1 rounded-lg">${escapeHtml(targetCheck.weight)}kg</span></div>`;
        }

        // 内部HTML (二重divを廃止)
        status.innerHTML = `
            <div class="flex justify-between items-start w-full">
                <div class="flex flex-col">
                    <span class="text-[10px] opacity-70 font-bold uppercase tracking-wider mb-1">${title}</span>
                    <div class="flex items-center gap-2">
                        <span class="text-2xl">${type==='today'?'😎':'✅'}</span>
                        <span class="text-sm font-bold leading-tight">${msg}</span>
                    </div>
                </div>
                <button id="btn-edit-check" class="text-[10px] font-bold bg-black/5 dark:bg-white/10 hover:bg-black/10 px-2 py-1 rounded transition">
                    Edit
                </button>
            </div>
            ${weightHtml}
        `;
    } else {
        // 未記録時
        status.innerHTML = `
            <div class="flex flex-col h-full justify-between">
                <div>
                    <span class="text-[10px] opacity-70 font-bold uppercase tracking-wider block mb-1">Daily Check</span>
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-2xl">👋</span>
                        <span class="text-sm font-bold">How are you?</span>
                    </div>
                </div>
                <button class="w-full bg-white/60 dark:bg-black/20 py-2 rounded-xl text-xs font-bold hover:bg-white/80 transition text-center shadow-sm">
                    Record Now
                </button>
            </div>
        `;
    }
}

export function getCheckMessage(check, logs) {
    const drank = Calc.hasAlcoholLog(logs, check.timestamp);
    if (drank || !check.isDryDay) {
        let s = 0; 
        if (check.waistEase) s++; 
        if (check.footLightness) s++; 
        if (check.fiberOk) s++; 
        if (check.waterOk) s++;
        
        if (s >= 3) return '調子ヨシ！😆';
        if (s >= 1) return 'まずまず 🙂'; 
        return '不調気味... 😰';
    } else { 
        return (check.waistEase && check.footLightness) ? '休肝日✨' : '休肝日🍵'; 
    }
}