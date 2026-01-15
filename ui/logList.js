import { EXERCISE, STYLE_METADATA } from '../constants.js';
import { Calc } from '../logic.js';
import { Store } from '../store.js';
import { StateManager } from './state.js';
import { DOM, escapeHtml } from './dom.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

// 内部で保持するハンドラ
let _fetchLogsHandler = null;

export const setFetchLogsHandler = (fn) => {
    _fetchLogsHandler = fn;
};

// ログリスト管理のメイン関数
export async function updateLogListView(isAppend = false) {
    // v4: Log Listは #log-list (内部は #cellar-subview-logs 内)
    const listContainer = document.getElementById('log-list');
    if (!listContainer) return;

    // 初回読み込み（リセット）の場合
    if (!isAppend) {
        StateManager.setLogLimit(50);
        listContainer.innerHTML = '';
        StateManager.setLogLoading(false);
    }

    if (StateManager.isLoadingLogs) return;
    StateManager.setLogLoading(true);

    try {
        if (!_fetchLogsHandler) {
            console.warn("fetchLogsHandler is not set. Skipping data load.");
            return;
        }

        const currentLimit = StateManager.logLimit;
        const offset = isAppend ? currentLimit - 50 : 0; 
        const limit = 50;
        
        const { logs, totalCount } = await _fetchLogsHandler(offset, limit);

        renderLogList(logs, isAppend);
        manageInfiniteScrollSentinel(totalCount > currentLimit);

        // 総件数の更新 (Cellarタブヘッダー用)
        const totalCountEl = document.getElementById('cellar-total-count');
        if (totalCountEl) {
            totalCountEl.textContent = `${totalCount} Logs`;
        }

    } catch (e) {
        console.error("Log load error:", e);
    } finally {
        StateManager.setLogLoading(false);
    }
}

// 監視要素(Sentinel)の管理
export function manageInfiniteScrollSentinel(hasMore) {
    const listContainer = document.getElementById('log-list');
    let sentinel = document.getElementById('log-list-sentinel');

    if (sentinel) sentinel.remove();

    if (hasMore) {
        sentinel = document.createElement('div');
        sentinel.id = 'log-list-sentinel';
        sentinel.className = "py-8 text-center text-xs text-gray-400 font-bold animate-pulse";
        sentinel.textContent = "Loading more...";
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
            endMsg.className = "py-8 text-center text-[10px] text-gray-300 font-bold uppercase tracking-widest";
            endMsg.textContent = "- END OF PERIOD -";
            listContainer.appendChild(endMsg);
        }
    }
}

// ログリスト描画
export function renderLogList(logs, isAppend) {
    const list = document.getElementById('log-list');
    if (!list) return;

    if (!isAppend && logs.length === 0) {
        list.innerHTML = `
            <div class="text-center py-10 px-4">
                <div class="text-6xl mb-4 opacity-80">🍻</div>
                <h3 class="text-lg font-bold text-text-dark dark:text-white mb-2">No Records Yet</h3>
                <p class="text-xs text-text-mutedDark dark:text-text-muted mb-6 leading-relaxed">
                    この期間の記録はまだありません。<br>
                    飲んだら記録して、借金を返済しましょう！
                </p>
                <button data-action="trigger-beer-modal" class="bg-accent/10 text-accent font-bold py-3 px-6 rounded-xl text-sm border border-accent/20 hover:bg-accent/20 transition">
                    👉 飲酒を記録する
                </button>
            </div>
        `;
        return;
    }

    const baseEx = Store.getBaseExercise();
    const userProfile = Store.getProfile();

    const htmlItems = logs.map(log => {
        const kcal = log.kcal !== undefined ? log.kcal : (log.minutes * Calc.burnRate(6.0, userProfile));
        const isDebt = kcal < 0; // 借金判定
        
        // 運動による返済も、飲酒による借金も絶対値で分換算表示
        const displayMinutes = Calc.convertKcalToMinutes(Math.abs(kcal), baseEx, userProfile);
        
        // v4 Design: Phosphor Icons & Glassmorphism List Item
        // スタイル/運動種別に応じたアイコン取得
        let iconChar = isDebt ? '🍺' : '🏃‍♀️';
        let iconBg = isDebt ? 'bg-accent/10 text-accent' : 'bg-recovery/10 text-recovery';
        
        if (isDebt && log.style && STYLE_METADATA[log.style]) {
            iconChar = STYLE_METADATA[log.style].icon;
        } else if (!isDebt && log.exerciseKey && EXERCISE[log.exerciseKey]) {
            iconChar = EXERCISE[log.exerciseKey].icon;
        }

        const date = dayjs(log.timestamp).format('MM/DD HH:mm');
        const safeName = escapeHtml(log.name);
        
        // 詳細情報（ブルワリーなど）
        let subText = '';
        if (log.brewery || log.brand) {
            subText = `<span class="opacity-80">${escapeHtml(log.brewery||'')}</span> ${escapeHtml(log.brand||'')}`;
        }

        // Checkbox Logic
        const checkHidden = StateManager.isEditMode ? '' : 'hidden';
        const checkboxHtml = `
            <div class="edit-checkbox-area ${checkHidden} mr-3 flex-shrink-0 transition-all duration-300">
                <input type="checkbox" class="log-checkbox w-5 h-5 text-accent rounded border-base-300 dark:border-base-600 focus:ring-accent bg-base-100 dark:bg-base-700" value="${log.id}">
            </div>`;

        // 符号と色
        const valSign = isDebt ? '-' : '+';
        const valColor = isDebt ? 'text-accent' : 'text-recovery';

        return `
            <div class="log-item-row glass-panel rounded-xl p-3 flex items-center justify-between group transition hover:bg-base-50 dark:hover:bg-base-700/50 cursor-pointer mb-2 border border-transparent hover:border-base-200 dark:hover:border-base-600" data-id="${log.id}">
                <div class="flex items-center flex-grow min-w-0 pr-2">
                    ${checkboxHtml}
                    <div class="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 mr-3 ${iconBg}">
                        ${iconChar}
                    </div>
                    <div class="min-w-0">
                        <p class="font-bold text-sm text-text-dark dark:text-white truncate">${safeName}</p>
                        ${subText ? `<p class="text-[10px] text-text-mutedDark dark:text-text-muted truncate">${subText}</p>` : ''}
                        <p class="text-[10px] text-gray-400 mt-0.5">${date}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-2 flex-shrink-0">
                    <span class="text-sm font-black ${valColor} whitespace-nowrap">${valSign}${displayMinutes} min</span>
                    <button data-id="${log.id}" class="delete-log-btn opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1 transition-opacity">
                        <i class="ph-bold ph-trash"></i>
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

// 編集モード等のユーティリティ (v3維持+CSSクラス調整)
export const toggleEditMode = () => {
    const isEdit = StateManager.toggleEditMode();
    const btn = document.getElementById('btn-toggle-edit-mode');
    
    if (btn) {
        btn.innerHTML = isEdit ? '<i class="ph-bold ph-check"></i>' : 'Edit';
        btn.classList.toggle('bg-accent', isEdit);
        btn.classList.toggle('text-black', isEdit);
    }

    const checkboxes = document.querySelectorAll('.edit-checkbox-area');
    checkboxes.forEach(el => {
        if (isEdit) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
    
    const actionBar = document.getElementById('bulk-action-bar');
    if (actionBar) {
        if (isEdit) actionBar.classList.remove('hidden');
        else actionBar.classList.add('hidden');
    }

    if (!isEdit) {
        document.querySelectorAll('.log-checkbox').forEach(i => i.checked = false);
        updateBulkCount(0);
    }
};

export const toggleSelectAll = () => {
    // ... (DOM依存が少ないため省略可だが、v4に合わせて維持)
    const inputs = document.querySelectorAll('.log-checkbox');
    const allChecked = Array.from(inputs).every(i => i.checked);
    inputs.forEach(i => i.checked = !allChecked);
    updateBulkCount(inputs.length);
};

export const updateBulkCount = (count) => {
    const el = document.getElementById('bulk-selected-count');
    if (el) el.textContent = count;
};