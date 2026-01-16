import { EXERCISE, STYLE_METADATA } from '../constants.js';
import { Calc } from '../logic.js';
import { Store } from '../store.js';
import { StateManager } from './state.js';
import { DOM, escapeHtml } from './dom.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

let _fetchLogsHandler = null;

export const setFetchLogsHandler = (fn) => {
    _fetchLogsHandler = fn;
};

// ログリスト更新 (無限スクロール対応)
export async function updateLogListView(isAppend = false) {
    const listContainer = document.getElementById('log-list');
    if (!listContainer) return;

    if (!isAppend) {
        StateManager.setLogLimit(50);
        listContainer.innerHTML = '';
        StateManager.setLogLoading(false);
    }

    if (StateManager.isLoadingLogs) return;
    StateManager.setLogLoading(true);

    try {
        if (!_fetchLogsHandler) return;

        const currentLimit = StateManager.logLimit;
        const offset = isAppend ? currentLimit - 50 : 0; 
        const limit = 50;
        
        const { logs, totalCount } = await _fetchLogsHandler(offset, limit);

        renderLogList(logs, isAppend);
        manageInfiniteScrollSentinel(totalCount > currentLimit);

    } catch (e) {
        console.error("Log load error:", e);
    } finally {
        StateManager.setLogLoading(false);
    }
}

// センチネル管理 (変更なし、クラスのみ微調整)
export function manageInfiniteScrollSentinel(hasMore) {
    const listContainer = document.getElementById('log-list');
    let sentinel = document.getElementById('log-list-sentinel');

    if (sentinel) sentinel.remove();

    if (hasMore) {
        sentinel = document.createElement('div');
        sentinel.id = 'log-list-sentinel';
        sentinel.className = "py-8 text-center text-xs text-slate-500 animate-pulse";
        sentinel.textContent = "Loading history...";
        listContainer.appendChild(sentinel);

        if (window.logObserver) window.logObserver.disconnect();
        window.logObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                StateManager.incrementLogLimit(50);
                updateLogListView(true);
            }
        }, { rootMargin: '200px' });
        window.logObserver.observe(sentinel);
    } else {
        if (listContainer.children.length > 0) {
            const endMsg = document.createElement('div');
            endMsg.className = "py-12 text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest";
            endMsg.textContent = "- End of Cellar -";
            listContainer.appendChild(endMsg);
        }
    }
}

// リスト描画 (v4 Glass Design)
export function renderLogList(logs, isAppend) {
    const list = DOM.elements['log-list'];
    if (!list) return;

    // Empty State
    if (!isAppend && logs.length === 0) {
        list.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 px-4 text-center text-slate-400">
                <div class="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-4xl mb-4 glass-panel">
                    🍺
                </div>
                <h3 class="text-lg font-bold text-white mb-2">Cellar is Empty</h3>
                <p class="text-xs text-slate-500 mb-6 max-w-xs leading-relaxed">
                    まだ記録がありません。<br>
                    下の「＋」ボタンから、最初の一杯を記録しましょう。
                </p>
            </div>
        `;
        return;
    }

    const baseEx = Store.getBaseExercise();
    const userProfile = Store.getProfile();

    const htmlItems = logs.map(log => {
        const kcal = log.kcal !== undefined ? log.kcal : (log.minutes * Calc.burnRate(6.0, userProfile));
        const isDebt = kcal < 0;
        
        const displayMinutes = Calc.convertKcalToMinutes(Math.abs(kcal), baseEx, userProfile);
        
        // 色設定 (v4 Colors)
        const signClass = isDebt 
            ? 'text-red-400 bg-red-900/20 border border-red-900/50' 
            : 'text-recovery bg-emerald-900/20 border border-emerald-900/50';
        
        // アイコン
        let iconChar = isDebt ? '🍺' : '🏃';
        if (isDebt && log.style && STYLE_METADATA[log.style]) {
            iconChar = STYLE_METADATA[log.style].icon;
        } else if (!isDebt) {
             const exKey = log.exerciseKey;
             if (exKey && EXERCISE[exKey]) {
                 iconChar = EXERCISE[exKey].icon;
             }
        }

        const date = dayjs(log.timestamp).format('MM/DD HH:mm');
        const safeName = escapeHtml(log.name);
        const safeBrewery = escapeHtml(log.brewery);
        const safeBrand = escapeHtml(log.brand);
        const safeMemo = escapeHtml(log.memo);

        // 詳細情報の構築
        let detailHtml = '';
        if (log.brewery || log.brand) {
            detailHtml += `<p class="text-xs text-slate-400 mt-0.5 truncate"><span class="font-bold text-slate-300">${safeBrewery||''}</span> ${safeBrand||''}</p>`;
        }
        
        // バッジ (Rating/Memo)
        let badgesHtml = '';
        if (isDebt && log.rating > 0) {
            const stars = '★'.repeat(log.rating);
            badgesHtml += `<span class="text-accent text-[10px] mr-2">${stars}</span>`;
        }
        if (log.memo) {
            badgesHtml += `<span class="text-[10px] text-slate-500 italic">"${safeMemo}"</span>`;
        }
        if (badgesHtml) {
            detailHtml += `<div class="mt-1 flex items-center">${badgesHtml}</div>`;
        }

        const checkHidden = StateManager.isEditMode ? '' : 'hidden';
        const checkboxHtml = `
            <div class="edit-checkbox-area ${checkHidden} mr-3 flex-shrink-0">
                <input type="checkbox" class="log-checkbox w-5 h-5 rounded border-slate-600 bg-slate-800 text-accent focus:ring-accent" value="${log.id}">
            </div>`;
        
        const displaySign = isDebt ? '-' : '+';

        // リストアイテムのHTML (Glass Panel Row)
        return `
            <div class="log-item-row group relative flex justify-between items-center p-4 mb-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 transition-all cursor-pointer" data-id="${log.id}">
                <div class="flex items-center flex-grow min-w-0 pr-2">
                    ${checkboxHtml}
                    <div class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xl mr-3 flex-shrink-0 shadow-inner">
                        ${iconChar}
                    </div>
                    <div class="min-w-0">
                        <p class="font-bold text-sm text-slate-200 truncate group-hover:text-white transition-colors">${safeName}</p>
                        ${detailHtml}
                        <p class="text-[10px] text-slate-600 mt-0.5 font-mono">${date}</p>
                    </div>
                </div>
                
                <div class="flex items-center space-x-3 flex-shrink-0">
                    <span class="px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${signClass}">
                        ${displaySign}${displayMinutes}<span class="text-[10px] opacity-70">m</span>
                    </span>
                    
                    <button data-id="${log.id}" class="delete-log-btn opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-400 transition-opacity">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            </div>`;
    });

    if (isAppend) {
        list.insertAdjacentHTML('beforeend', htmlItems.join(''));
    } else {
        list.innerHTML = htmlItems.join('');
    }
}

// 編集モード切り替え (スタイルの微調整)
export const toggleEditMode = () => {
    const isEdit = StateManager.toggleEditMode();
    
    const btn = document.getElementById('btn-toggle-edit-mode');
    if (btn) {
        btn.textContent = isEdit ? '完了' : '編集';
        btn.className = isEdit 
            ? "text-xs bg-accent text-black px-3 py-1.5 rounded-lg font-bold transition"
            : "text-xs bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition";
    }

    const selectAllBtn = document.getElementById('btn-select-all');
    if (selectAllBtn) {
        if (isEdit) selectAllBtn.classList.remove('hidden');
        else {
            selectAllBtn.classList.add('hidden');
            selectAllBtn.textContent = '全選択'; 
        }
    }

    const bar = document.getElementById('bulk-action-bar');
    if (bar) {
        if (isEdit) bar.classList.remove('hidden');
        else bar.classList.add('hidden');
    }

    const checkboxes = document.querySelectorAll('.edit-checkbox-area');
    checkboxes.forEach(el => {
        if (isEdit) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });

    if (!isEdit) {
        // 解除時に選択リセット
        const inputs = document.querySelectorAll('.log-checkbox');
        inputs.forEach(i => i.checked = false);
        updateBulkCount(0);
    }
};

export const toggleSelectAll = () => {
    const btn = document.getElementById('btn-select-all');
    const inputs = document.querySelectorAll('.log-checkbox');
    const isAllSelected = btn.textContent === '全解除';

    if (isAllSelected) {
        inputs.forEach(i => i.checked = false);
        btn.textContent = '全選択';
        updateBulkCount(0);
    } else {
        inputs.forEach(i => i.checked = true);
        btn.textContent = '全解除';
        updateBulkCount(inputs.length);
    }
};

export const updateBulkCount = (count) => {
    const el = document.getElementById('bulk-selected-count');
    if (el) el.textContent = count;
    
    const btn = document.getElementById('btn-bulk-delete');
    if (btn) {
        if (count > 0) {
            btn.removeAttribute('disabled');
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            btn.setAttribute('disabled', 'true');
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }
};