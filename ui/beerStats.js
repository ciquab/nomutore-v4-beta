import { Calc } from '../logic.js';
import { BEER_COLORS, STYLE_COLOR_MAP } from '../constants.js';

export function renderBeerStats(logs) {
    const container = document.getElementById('view-cellar-stats');
    if (!container) return;

    // 全期間のビールログを集計
    const stats = Calc.getBeerStats(logs);

    // HTML構造生成
    container.innerHTML = `
        <div class="space-y-4 pb-20">
            <!-- Summary Cards -->
            <div class="grid grid-cols-2 gap-3">
                <div class="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center">
                    <span class="text-[10px] font-bold uppercase text-gray-400">Total Drunk</span>
                    <span class="text-3xl font-black text-indigo-600 dark:text-indigo-400">${stats.totalCount} <span class="text-sm font-bold text-gray-400">cans</span></span>
                </div>
                <div class="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center">
                    <span class="text-[10px] font-bold uppercase text-gray-400">Total Volume</span>
                    <span class="text-3xl font-black text-indigo-600 dark:text-indigo-400">${(stats.totalMl / 1000).toFixed(1)} <span class="text-sm font-bold text-gray-400">L</span></span>
                </div>
            </div>

            <!-- Style Chart -->
            <div class="glass-panel p-5 rounded-3xl">
                <h3 class="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider text-center">Style Breakdown</h3>
                <div class="relative h-48 w-full">
                    <canvas id="styleChart"></canvas>
                    <!-- Center Text -->
                    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span class="text-3xl font-black text-gray-800 dark:text-white">${stats.logsCount}</span>
                        <span class="text-[10px] font-bold text-gray-400">RECORDS</span>
                    </div>
                </div>
            </div>

            <!-- Top Brands -->
            <div class="glass-panel p-5 rounded-3xl">
                <h3 class="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">Top Favorites</h3>
                <ul class="space-y-3">
                    ${renderTopStylesList(stats.topStyles)}
                </ul>
            </div>
        </div>
    `;

    // チャート描画 (Chart.js)
    requestAnimationFrame(() => {
        renderStyleChart(stats.styleCounts);
    });
}

function renderTopStylesList(topStyles) {
    if (!topStyles || topStyles.length === 0) return '<li class="text-center text-gray-400 text-xs">No data yet</li>';

    return topStyles.slice(0, 5).map((item, index) => {
        const percent = Math.min(100, (item.count / topStyles[0].count) * 100); // 1位を100%としたバー
        const colorKey = STYLE_COLOR_MAP[item.style] || 'gold';
        // BEER_COLORSはgradient定義なので、簡易的な単色に変換するか、CSS変数を使う。
        // ここではTailwindの色クラスを動的に割り当てるのは難しいため、style属性でバーの色を制御
        
        return `
            <li class="flex items-center gap-3">
                <span class="w-4 text-xs font-bold text-gray-400 text-center">${index + 1}</span>
                <div class="flex-1">
                    <div class="flex justify-between items-baseline mb-1">
                        <span class="text-xs font-bold text-gray-700 dark:text-gray-200">${item.style}</span>
                        <span class="text-[10px] font-bold text-gray-400">${item.count}</span>
                    </div>
                    <div class="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div class="h-full bg-indigo-500 rounded-full" style="width: ${percent}%"></div>
                    </div>
                </div>
            </li>
        `;
    }).join('');
}

function renderStyleChart(styleCounts) {
    const ctx = document.getElementById('styleChart');
    if (!ctx) return;

    const labels = Object.keys(styleCounts);
    const data = Object.values(styleCounts);
    
    // スタイルに対応する色をBEER_COLORSから取得したいが、Chart.jsは単色hex推奨。
    // 簡易パレット
    const colors = [
        '#FBBF24', '#F59E0B', '#D97706', '#B45309', '#78350F', 
        '#FEF3C7', '#10B981', '#6366F1', '#8B5CF6', '#EC4899'
    ];

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    bodyFont: { family: 'Inter', size: 12 },
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: true
                }
            }
        }
    });
}