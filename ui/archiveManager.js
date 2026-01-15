import { db } from '../store.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

/**
 * Archive Manager
 * 過去の期間アーカイブを表示・管理する
 */
export async function renderArchives() {
    const container = document.getElementById('archive-list');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-8 text-xs text-gray-400">Loading archives...</div>';

    try {
        // Fetch archives (Newest first)
        const archives = await db.period_archives.orderBy('startDate').reverse().toArray();

        if (archives.length === 0) {
            container.innerHTML = `
                <div class="text-center py-10 px-4">
                    <div class="text-4xl mb-3 opacity-50">📦</div>
                    <h3 class="text-lg font-bold text-text-dark dark:text-white mb-2">No Archives</h3>
                    <p class="text-xs text-text-mutedDark dark:text-text-muted">
                        期間モードの終了時に<br>ここに成績表が保存されます。
                    </p>
                </div>`;
            return;
        }

        const html = archives.map(arc => {
            const start = dayjs(arc.startDate).format('YYYY/MM/DD');
            const end = dayjs(arc.endDate).format('MM/DD');
            const res = arc.result || {};
            
            const balance = res.balance || 0;
            const isPositive = balance >= 0;
            const balanceSign = isPositive ? '+' : '';
            const balanceClass = isPositive ? 'text-recovery' : 'text-red-500';
            
            const rank = res.rank || '-';
            
            // Rank Color
            let rankBg = 'bg-gray-100 text-gray-600 dark:bg-gray-700';
            if (rank === 'S') rankBg = 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
            if (rank === 'A') rankBg = 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400';
            if (rank === 'B') rankBg = 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';

            return `
                <div class="glass-panel rounded-xl p-4 flex items-center justify-between group hover:bg-base-50 dark:hover:bg-base-700/50 transition cursor-pointer" onclick="alert('Archive Detail (Coming Phase 3.2)')">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-lg flex flex-col items-center justify-center font-black text-xl shadow-sm ${rankBg}">
                            ${rank}
                            <span class="text-[8px] font-normal opacity-70 uppercase">Rank</span>
                        </div>
                        <div>
                            <p class="text-xs font-bold text-text-mutedDark dark:text-text-muted mb-0.5">${start} - ${end}</p>
                            <div class="flex items-center gap-2 text-[10px] text-gray-400">
                                <span>🍺 ${res.drinkDays||0} days</span>
                                <span>🏃 ${res.exerciseDays||0} days</span>
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-lg font-black ${balanceClass}">${balanceSign}${Math.round(balance)}</p>
                        <p class="text-[10px] font-bold text-text-mutedDark dark:text-text-muted">kcal</p>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        
        // Update Total Count in Header
        const totalCountEl = document.getElementById('cellar-total-count');
        if (totalCountEl) {
            totalCountEl.textContent = `${archives.length} Periods`;
        }

    } catch (e) {
        console.error("Failed to render archives:", e);
        container.innerHTML = '<div class="text-center text-red-500 text-xs">Error loading data</div>';
    }
}