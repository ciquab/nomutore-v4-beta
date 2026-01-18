import { Calc } from '../logic.js';
import { DOM, escapeHtml } from './dom.js';
import { STYLE_METADATA } from '../constants.js';

let statsChart = null;

export function renderBeerStats(logs) {
    const container = document.getElementById('view-cellar-stats');
    if (!container) return;

    // データの集計
    const stats = Calc.getBeerStats(logs);

    // HTML構造の生成 (検索バー + グラフエリア + リストエリア)
    container.innerHTML = `
        <div class="space-y-6">
            <div class="grid grid-cols-3 gap-3 text-center">
                <div class="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-2xl border border-amber-100 dark:border-amber-800/50">
                    <p class="text-[10px] font-bold text-amber-800 dark:text-amber-200 uppercase">Total</p>
                    <p class="text-xl font-black text-amber-600 dark:text-amber-400">${stats.totalCount}<span class="text-xs ml-1">杯</span></p>
                </div>
                <div class="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                    <p class="text-[10px] font-bold text-indigo-800 dark:text-indigo-200 uppercase">Volume</p>
                    <p class="text-xl font-black text-indigo-600 dark:text-indigo-400">${(stats.totalMl / 1000).toFixed(1)}<span class="text-xs ml-1">L</span></p>
                </div>
                <div class="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                    <p class="text-[10px] font-bold text-emerald-800 dark:text-emerald-200 uppercase">Unique</p>
                    <p class="text-xl font-black text-emerald-600 dark:text-emerald-400">${stats.uniqueBeersCount}<span class="text-xs ml-1">種</span></p>
                </div>
            </div>

            <div class="glass-panel p-4 rounded-3xl relative">
                <h3 class="text-xs font-bold text-gray-400 uppercase mb-4 text-center">Style Breakdown</h3>
                <div class="h-48 w-full relative">
                    <canvas id="beerStyleChart"></canvas>
                    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span class="text-3xl font-black text-base-900 dark:text-white opacity-20">🍺</span>
                    </div>
                </div>
            </div>

            <div>
                <div class="sticky top-0 bg-white/90 dark:bg-base-900/90 backdrop-blur z-10 py-2">
                    <div class="flex items-center justify-between mb-2 px-1">
                        <h3 class="text-lg font-black text-base-900 dark:text-white flex items-center gap-2">
                            <i class="ph-fill ph-books text-indigo-500"></i> Collection
                        </h3>
                        <div class="relative">
                            <input type="text" id="beer-search-input" placeholder="Search..." class="bg-gray-100 dark:bg-gray-800 border-none rounded-xl text-xs font-bold py-2 pl-8 pr-3 w-40 focus:w-full transition-all focus:ring-2 focus:ring-indigo-500">
                            <i class="ph-bold ph-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        </div>
                    </div>
                </div>

                <div id="beer-ranking-list" class="space-y-3 pb-24">
                    </div>
            </div>
        </div>
    `;

    // チャート描画
    renderStyleChart(stats.styleCounts);

    // リスト描画 & 検索機能
    const searchInput = document.getElementById('beer-search-input');
    
    const filterAndRender = (term = '') => {
        const lowerTerm = term.toLowerCase();
        const filtered = stats.beerStats.filter(b => 
            (b.name && b.name.toLowerCase().includes(lowerTerm)) || 
            (b.brewery && b.brewery.toLowerCase().includes(lowerTerm)) ||
            (b.style && b.style.toLowerCase().includes(lowerTerm))
        );
        renderBeerList(filtered);
    };

    if (searchInput) {
        searchInput.addEventListener('input', (e) => filterAndRender(e.target.value));
    }
    
    // 初回リスト描画
    renderBeerList(stats.beerStats);
}

function renderStyleChart(styleCounts) {
    const ctx = document.getElementById('beerStyleChart');
    if (!ctx) return;

    if (statsChart) statsChart.destroy();

    const labels = Object.keys(styleCounts);
    const data = Object.values(styleCounts);
    
    // 色マッピング (Tailwind colors to Hex)
    const map = {
        'gold': '#fbbf24', 'amber': '#f59e0b', 'black': '#1f2937', 
        'hazy': '#facc15', 'white': '#fcd34d', 'red': '#ef4444', 
        'pale': '#fef08a', 'copper': '#d97706', 'green': '#10b981'
    };

    const bgColors = labels.map(style => {
        const meta = STYLE_METADATA[style];
        const colorKey = meta ? meta.color : 'gold';
        return map[colorKey] || '#cbd5e1';
    });

    statsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: bgColors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    bodyFont: { size: 12, weight: 'bold' },
                    padding: 10,
                    cornerRadius: 8
                }
            }
        }
    });
}

function renderBeerList(beers) {
    const listEl = document.getElementById('beer-ranking-list');
    if (!listEl) return;

    if (!beers || beers.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-10 opacity-50">
                <i class="ph-duotone ph-beer-bottle text-4xl mb-2"></i>
                <p class="text-xs font-bold">No beers found.</p>
            </div>`;
        return;
    }

    listEl.innerHTML = beers.map((beer, index) => {
        // ランキングバッジ
        let rankBadge = `<span class="text-xs font-bold text-gray-300 w-6 text-center">#${index + 1}</span>`;
        if (index === 0) rankBadge = `<span class="text-lg">🥇</span>`;
        if (index === 1) rankBadge = `<span class="text-lg">🥈</span>`;
        if (index === 2) rankBadge = `<span class="text-lg">🥉</span>`;

        // 評価スター
        const rating = beer.averageRating > 0 
            ? `<span class="flex items-center text-[10px] text-yellow-500 font-bold bg-yellow-50 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded gap-1"><i class="ph-fill ph-star"></i>${beer.averageRating.toFixed(1)}</span>`
            : '';

        return `
            <div class="flex items-center bg-white dark:bg-base-800 p-3 rounded-2xl shadow-sm border border-base-100 dark:border-base-700">
                <div class="flex-shrink-0 w-8 text-center mr-1">${rankBadge}</div>
                
                <div class="flex-grow min-w-0">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-[10px] font-bold text-gray-400 uppercase truncate tracking-wider">${escapeHtml(beer.brewery || 'Unknown')}</p>
                            <h4 class="text-sm font-black text-base-900 dark:text-white truncate leading-tight">${escapeHtml(beer.name)}</h4>
                        </div>
                        <div class="text-right ml-2">
                            <span class="block text-xl font-black text-indigo-600 dark:text-indigo-400 leading-none">${beer.count}</span>
                            <span class="text-[9px] text-gray-400 font-bold uppercase">Cups</span>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-2 mt-2">
                        <span class="text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md truncate max-w-[100px]">${beer.style}</span>
                        ${rating}
                        <span class="ml-auto text-[10px] font-mono text-gray-400">Total: ${(beer.totalMl/1000).toFixed(1)}L</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}