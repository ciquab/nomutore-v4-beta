import { Calc } from '../logic.js';
import { DOM, escapeHtml } from './dom.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

export function renderCheckStatus(checks, logs) {
    const status = DOM.elements['check-status'] || document.getElementById('check-status');
    if(!status) return;

    const today = dayjs();
    const yest = today.subtract(1, 'day');
    
    // ★修正: 「isSaved フラグが立っている」レコードだけを有効なチェックとして探す
    const todayCheck = checks.find(c => dayjs(c.timestamp).isSame(today, 'day') && c.isSaved === true);
    const yestCheck = checks.find(c => dayjs(c.timestamp).isSame(yest, 'day') && c.isSaved === true);

    let targetCheck = null;
    let type = 'none';

    if (todayCheck) {
        targetCheck = todayCheck;
        type = 'today';
    } else if (yestCheck) {
        targetCheck = yestCheck;
        type = 'yesterday';
    }

    // テーマとテキストの決定
    let theme = {
        bg: "bg-gray-50", darkBg: "dark:bg-gray-800/50",
        text: "text-gray-800", darkText: "dark:text-white",
        icon: "text-gray-300", iconName: "ph-clipboard-text",
        accent: "bg-gray-200"
    };
    
    let label = "DAILY CHECK";
    let mainStatus = "No Record";
    let subStatus = "記録がありません";
    let bottomContent = `<span class="text-[10px] font-bold opacity-60">Tap to record</span>`;

    if (type !== 'none') {
        const { short, desc, score } = analyzeCondition(targetCheck, logs);
        
        if (type === 'today') {
            label = "TODAY'S COND.";
            // スコアに基づく色分け
            if (score >= 3) { // 好調
                theme = { 
                    bg: "bg-emerald-50", darkBg: "dark:bg-emerald-900/20",
                    text: "text-emerald-900", darkText: "dark:text-emerald-100",
                    icon: "text-emerald-500", iconName: "ph-smiley"
                };
            } else if (score >= 1) { // 普通
                theme = { 
                    bg: "bg-blue-50", darkBg: "dark:bg-blue-900/20",
                    text: "text-blue-900", darkText: "dark:text-blue-100",
                    icon: "text-blue-500", iconName: "ph-activity"
                };
            } else { // 不調
                theme = { 
                    bg: "bg-orange-50", darkBg: "dark:bg-orange-900/20",
                    text: "text-orange-900", darkText: "dark:text-orange-100",
                    icon: "text-orange-500", iconName: "ph-warning"
                };
            }
        } else {
            label = "YESTERDAY";
            theme = { 
                bg: "bg-white", darkBg: "dark:bg-gray-800",
                text: "text-gray-600", darkText: "dark:text-gray-300",
                icon: "text-gray-300", iconName: "ph-calendar-check"
            };
        }

        mainStatus = short;
        subStatus = desc;
        
        // フッター（体重表示 または Editバッジ）
        if (targetCheck.weight) {
            bottomContent = `<span class="text-[10px] font-bold font-mono bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded">${targetCheck.weight}kg</span>`;
        } else {
            bottomContent = `<span class="text-[10px] font-bold opacity-40">Edit</span>`;
        }
    }

    // HTML生成 (LiverRankと構造を完全一致させる)
    // ★修正: leading-tight と py-1 を追加して「g」の欠けを防止
    status.className = `glass-panel p-4 rounded-2xl relative overflow-hidden group cursor-pointer transition hover:border-opacity-50 flex flex-col justify-between h-full min-h-[130px] ${theme.bg} ${theme.darkBg}`;
    
    status.innerHTML = `
        <div class="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition transform group-hover:scale-110 duration-500">
            <i class="ph-fill ${theme.iconName} text-5xl ${theme.icon}"></i>
        </div>
        
        <div class="relative z-10 flex flex-col h-full justify-between">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-[10px] font-bold uppercase tracking-widest opacity-60 ${theme.text} ${theme.darkText}">${label}</span>
                </div>
                
                <div class="flex flex-col items-start">
                    <span class="text-3xl font-black ${theme.text} ${theme.darkText} leading-normal mb-1 tracking-tight truncate w-full">${mainStatus}</span>
                    <span class="text-xs font-bold opacity-80 ${theme.text} ${theme.darkText} mt-1 truncate w-full">${subStatus}</span>
                </div>
                </div>
            </div>

            <div class="mt-3 flex justify-end items-end">
                <div class="${theme.text} ${theme.darkText}">
                    ${bottomContent}
                </div>
            </div>
        </div>
    `;
}

// 状態解析ロジック (短い英語タイトルと詳細を生成)
function analyzeCondition(check, logs) {
    const drank = Calc.hasAlcoholLog(logs, check.timestamp);
    let score = 0;
    if (check.waistEase) score++; 
    if (check.footLightness) score++; 
    if (check.fiberOk) score++; 
    if (check.waterOk) score++;

    // ★修正: 休肝日判定のロジック
    // 誤: if (!drank || check.isDryDay)  <-- これだと「飲んだけどチェックがON」の時に休肝日になってしまう
    // 正: if (!drank && check.isDryDay)  <-- 「飲んでない」かつ「チェックON」のみ休肝日とする
    
    if (!drank && check.isDryDay) {
        if (check.waistEase && check.footLightness) {
            return { short: "Perfect", desc: "休肝日・絶好調 ✨", score: 4 };
        }
        return { short: "Rest Day", desc: "休肝日 🍵", score: 3 };
    }

    // 飲酒日 (または休肝日チェックOFFの日)
    if (score >= 3) return { short: "Good", desc: "対策バッチリ 👍", score: 3 };
    if (score >= 1) return { short: "Average", desc: "まずまず 🙂", score: 1 };
    
    return { short: "Warning", desc: "不調気味... 😰", score: 0 };
}