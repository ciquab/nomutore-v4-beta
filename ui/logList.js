import { db } from '../store.js';
import { DOM, escapeHtml } from './dom.js';
import { EXERCISE, CALORIES } from '../constants.js';
import { StateManager } from './state.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

// 状態管理
let currentLimit = 20; // 最初に表示する件数
const LIMIT_STEP = 20; // 追加で読み込む件数

export const toggleEditMode = () => {
    const isEdit = !StateManager.isEditMode;
    StateManager.setIsEditMode(isEdit);
    
    // UI反映
    updateLogListView(false); // 再描画してチェックボックスを表示
    
    // ★追加: Select Allボタンの表示制御
    const selectAllBtn = document.getElementById('btn-select-all');
    if (selectAllBtn) {
        if (isEdit) selectAllBtn.classList.remove('hidden');
        else selectAllBtn.classList.add('hidden');
    }
    
    updateBulkActionUI();
};

export const toggleSelectAll = () => {
    const checkboxes = document.querySelectorAll('.log-checkbox');
    // 全てチェック済みなら解除、そうでなければ全選択
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
    updateBulkActionUI();
};

// 選択状態に応じてアクションバー（削除ボタン等）の表示を更新
export const updateBulkCount = () => {
    updateBulkActionUI();
};

const updateBulkActionUI = () => {
    const count = document.querySelectorAll('.log-checkbox:checked').length;
    
    // 編集モードツールバー（Select Allなど）の制御
    const toolbar = document.getElementById('edit-toolbar'); // HTMLに存在すれば
    if (toolbar) toolbar.classList.toggle('hidden', !StateManager.isEditMode);
    
    // 一括削除ボタンエリア
    const deleteBtn = document.getElementById('btn-delete-selected');
    if (deleteBtn) {
        deleteBtn.disabled = count === 0;
        deleteBtn.innerHTML = `<i class="ph-bold ph-trash"></i> Delete (${count})`;
        // ボタンの表示/非表示
        if(StateManager.isEditMode) {
             deleteBtn.classList.remove('translate-y-20', 'opacity-0');
        } else {
             deleteBtn.classList.add('translate-y-20', 'opacity-0');
        }
    }
    
    // 既存のツールバー内カウント更新（もしあれば）
    const countLabel = document.getElementById('bulk-selected-count');
    if (countLabel) countLabel.textContent = count;
};

// 選択されたログを一括削除
export const deleteSelectedLogs = async () => {
    const checkboxes = document.querySelectorAll('.log-checkbox:checked');
    if (checkboxes.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${checkboxes.length} items?`)) return;

    const ids = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));
    
    try {
        await db.logs.bulkDelete(ids);
        // 削除後リフレッシュ
        updateLogListView(false);
        // 削除完了後は編集モードを維持するか抜けるか（ここでは維持）
        updateBulkActionUI();
    } catch (e) {
        console.error(e);
        alert('Failed to delete logs.');
    }
};


// リスト描画のメイン関数
// isLoadMore: trueなら件数を増やして再描画
export const updateLogListView = async (isLoadMore = false) => {
    const listEl = document.getElementById('log-list');
    const loadMoreBtn = document.getElementById('btn-load-more');
    if (!listEl) return;

    if (isLoadMore) {
        currentLimit += LIMIT_STEP;
    } else {
        // タブ切り替え時などは件数リセットせず、現在のLimitを維持
        // 必要なら currentLimit = 20; をここに入れる
    }

    // データ取得
    const totalCount = await db.logs.count();
    const logs = await db.logs.orderBy('timestamp').reverse().limit(currentLimit).toArray();

    listEl.innerHTML = '';

    if (logs.length === 0) {
        listEl.innerHTML = `<li class="text-center text-gray-400 py-10 text-xs flex flex-col items-center"><i class="ph-duotone ph-beer-bottle text-4xl mb-2"></i>No logs yet.</li>`;
        if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
        return;
    }

    let currentDateStr = '';

    logs.forEach(log => {
        // ★日付のみ表示（時間は削除）
        const dateStr = dayjs(log.timestamp).format('YYYY-MM-DD (ddd)');
        
        // 日付ヘッダー挿入
        if (dateStr !== currentDateStr) {
            const header = document.createElement('li');
            header.className = "text-[10px] font-bold text-gray-400 mt-6 mb-2 pl-1 border-l-2 border-indigo-200 dark:border-indigo-800 uppercase tracking-wider";
            header.textContent = dateStr;
            listEl.appendChild(header);
            currentDateStr = dateStr;
        }

        const li = document.createElement('li');
        li.className = "relative group bg-white dark:bg-gray-800 rounded-2xl p-3 shadow-sm flex items-center gap-3 mb-2 transition-all active:scale-[0.98] border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900";
        
        let icon = '🍺';
        let colorClass = 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500';
        let mainText = '';
        let subText = '';
        let rightContent = '';

        if (log.type === 'exercise') {
            const ex = EXERCISE[log.exerciseKey];
            icon = ex ? ex.icon : '🏃';
            colorClass = 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400';
            mainText = log.name; 
            subText = `${log.minutes} min · -${Math.round(log.kcal)} kcal`;
            rightContent = `<span class="text-xs font-bold text-indigo-500">-${Math.round(log.kcal)}</span>`;
        } else if (log.type === 'beer') {
            const size = log.size || 350;
            const count = log.count || 1;
            
            if (log.brand) {
                mainText = log.brewery ? `<span class="text-[10px] opacity-70 block leading-tight">${escapeHtml(log.brewery)}</span>${escapeHtml(log.brand)}` : escapeHtml(log.brand);
            } else {
                mainText = escapeHtml(log.name); 
            }

            const styleInfo = log.style ? ` · ${log.style}` : ''; 
            const totalMl = size * count;
            subText = `${count} cans (${totalMl}ml)${styleInfo}`;
            
            if(log.rating > 0) {
                rightContent = `<span class="text-[10px] text-amber-400">★${log.rating}</span>`;
            }
        }

        // チェックボックス (編集モード時のみ表示)
        const checkboxHtml = StateManager.isEditMode ? `
            <div class="mr-1">
                <input type="checkbox" class="log-checkbox checkbox checkbox-xs checkbox-primary" data-id="${log.id}">
            </div>
        ` : '';

        li.innerHTML = `
            ${checkboxHtml}
            <div class="w-10 h-10 rounded-full ${colorClass} flex items-center justify-center text-lg shrink-0">
                ${icon}
            </div>

            <div class="flex-1 min-w-0 cursor-pointer" onclick="UI.editLog(${log.id})">
                <div class="flex justify-between items-start">
                    <div class="text-sm font-bold text-gray-800 dark:text-gray-100 leading-tight">${mainText}</div>
                    ${rightContent}
                </div>
                <div class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">${subText}</div>
                ${log.memo ? `<div class="text-[10px] text-gray-400 mt-1 truncate bg-gray-50 dark:bg-gray-700/50 p-1 rounded inline-block max-w-full"><i class="ph-bold ph-note-pencil mr-1"></i>${escapeHtml(log.memo)}</div>` : ''}
            </div>
        `;
        
        listEl.appendChild(li);
    });

    // 「Load More」ボタンの表示制御
    if (loadMoreBtn) {
        if (totalCount > currentLimit) {
            loadMoreBtn.classList.remove('hidden');
            loadMoreBtn.textContent = `Load More (${totalCount - currentLimit} remaining)`;
            loadMoreBtn.onclick = () => updateLogListView(true);
        } else {
            loadMoreBtn.classList.add('hidden');
        }
    }
    
    // イベントリスナー再設定
    document.querySelectorAll('.log-checkbox').forEach(cb => {
        cb.addEventListener('change', updateBulkCount);
    });
};

// モジュール外から呼べるように割り当て
updateLogListView.updateBulkCount = updateBulkCount;

// ダミー関数（互換性維持）
export const setFetchLogsHandler = (fn) => {};