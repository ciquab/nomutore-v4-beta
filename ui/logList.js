// ui/logList.js
import { db } from '../store.js';
import { DOM, escapeHtml } from './dom.js';
import { EXERCISE, CALORIES } from '../constants.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

let isEditMode = false;

export const toggleEditMode = () => {
    isEditMode = !isEditMode;
    updateLogListView();
    
    // UI反映
    const toolbar = document.getElementById('edit-toolbar');
    const selectAllBtn = document.getElementById('btn-select-all');
    if (toolbar) toolbar.classList.toggle('hidden', !isEditMode);
    if (selectAllBtn) selectAllBtn.classList.toggle('hidden', !isEditMode);
    
    // 選択状態リセット
    document.querySelectorAll('.log-checkbox').forEach(cb => cb.checked = false);
    updateBulkCount();
};

export const toggleSelectAll = () => {
    const checkboxes = document.querySelectorAll('.log-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
    updateBulkCount();
};

export const updateBulkCount = () => {
    const count = document.querySelectorAll('.log-checkbox:checked').length;
    const el = document.getElementById('bulk-selected-count');
    if (el) el.textContent = count;
};

// ログリスト描画のメイン関数
export const updateLogListView = async (forceRefresh = true) => {
    const listEl = document.getElementById('log-list');
    if (!listEl) return;

    // 簡易的に全件取得して表示 (動作優先)
    const allLogs = await db.logs.orderBy('timestamp').reverse().limit(50).toArray();

    listEl.innerHTML = '';

    if (allLogs.length === 0) {
        listEl.innerHTML = `<li class="text-center text-gray-400 py-8 text-xs">No records found.</li>`;
        return;
    }

    let currentDateStr = '';

    allLogs.forEach(log => {
        const dateStr = dayjs(log.timestamp).format('YYYY-MM-DD (ddd)');
        
        // 日付ヘッダー
        if (dateStr !== currentDateStr) {
            const header = document.createElement('li');
            header.className = "text-xs font-bold text-gray-400 mt-4 mb-2 pl-2 border-l-2 border-indigo-200 dark:border-indigo-800";
            header.textContent = dateStr;
            listEl.appendChild(header);
            currentDateStr = dateStr;
        }

        const li = document.createElement('li');
        li.className = "relative group bg-white dark:bg-base-800 rounded-xl p-3 shadow-sm flex items-center gap-3 transition-all active:scale-[0.99]";
        
        // アイコン決定
        let icon = '🍺';
        let colorClass = 'bg-yellow-100 text-yellow-600';
        let mainText = log.name;
        let subText = `${Math.round(Math.abs(log.kcal))} kcal`;

        if (log.type === 'exercise') {
            const ex = EXERCISE[log.exerciseKey];
            icon = ex ? ex.icon : '🏃';
            colorClass = 'bg-indigo-100 text-indigo-600';
            subText = `${log.minutes} min (${Math.round(log.kcal)} kcal)`;
        } else if (log.type === 'beer') {
            const size = log.size || 350;
            const count = log.count || 1;
            subText = `${size}ml x ${count} (${Math.round(Math.abs(log.kcal))} kcal)`;
        }

        // HTML生成: onclick="UI.deleteLog(...)" を埋め込むことで確実に動作させる
        li.innerHTML = `
            <div class="${isEditMode ? 'block' : 'hidden'} mr-2">
                <input type="checkbox" class="log-checkbox w-5 h-5 accent-indigo-600" data-id="${log.id}" onchange="UI.updateBulkCount()">
            </div>

            <div class="w-10 h-10 rounded-full ${colorClass} flex items-center justify-center text-lg shrink-0">
                ${icon}
            </div>

            <div class="flex-1 min-w-0" onclick="!isEditMode && UI.editLog(${log.id})">
                <div class="flex justify-between items-baseline">
                    <h4 class="text-sm font-bold text-base-900 dark:text-gray-100 truncate">${escapeHtml(mainText)}</h4>
                    <span class="text-xs font-mono text-gray-400 ml-2">${dayjs(log.timestamp).format('HH:mm')}</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${subText}</p>
                ${log.memo ? `<p class="text-[10px] text-gray-400 mt-1 truncate">"${escapeHtml(log.memo)}"</p>` : ''}
            </div>

            <button onclick="UI.deleteLog(${log.id})" class="${isEditMode ? 'hidden' : 'block'} w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 transition z-10">
                <i class="ph-bold ph-trash"></i>
            </button>
        `;

        listEl.appendChild(li);
    });
};

export const setFetchLogsHandler = (fn) => { /* Placeholder */ };