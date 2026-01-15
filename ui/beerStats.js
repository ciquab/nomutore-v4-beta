import { db } from '../store.js';
import { Calc } from '../logic.js';
import { STYLE_METADATA } from '../constants.js';
import { escapeHtml } from './dom.js';

/**
 * Beer Stats (Collection) Renderer
 * 全期間のログからビール帳を集計・表示する
 */
export async function renderBeerStats() {
    const grid = document.getElementById('cellar-grid');
    if (!grid) return;

    // Loading State
    grid.innerHTML = '<div class="col-span-2 text-center py-8 text-xs text-gray-400">Loading cellar...</div>';

    try {
        // 1. Fetch ALL beer logs (Not filtered by period)
        const allLogs = await db.logs.where('type').equals('beer').toArray();
        
        if (allLogs.length === 0) {
            grid.innerHTML = `
                <div class="col-span-2 text-center py-10">
                    <div class="text-4xl mb-3 opacity-50">🍺</div>
                    <p class="text-sm font-bold text-text-mutedDark dark:text-text-muted">No beers collected yet.</p>
                </div>`;
            return;
        }

        // 2. Calculate Stats
        const { beerStats, styleCount } = Calc.getBeerStats(allLogs);

        // 3. Render Grid
        const html = beerStats.map(beer => {
            const meta = STYLE_METADATA[beer.style] || { color: 'gold', icon: '🍺' };
            const safeName = escapeHtml(beer.name);
            const safeBrewery = escapeHtml(beer.brewery || 'Unknown Brewery');
            
            // Rating Stars
            const ratingAvg = Math.round(beer.averageRating);
            const stars = '★'.repeat(ratingAvg) + '☆'.repeat(5 - ratingAvg);
            
            // Color Class Mapping (Simple mapping for now)
            let badgeClass = "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
            if (meta.color === 'gold') badgeClass = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
            if (meta.color === 'amber' || meta.color === 'copper') badgeClass = "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
            if (meta.color === 'black') badgeClass = "bg-gray-800 text-gray-200 dark:bg-black dark:text-gray-400 border border-gray-700";
            if (meta.color === 'hazy') badgeClass = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";

            return `
                <div class="glass-panel p-3 rounded-xl hover:bg-base-100 dark:hover:bg-base-700/50 transition cursor-pointer group flex flex-col h-full border border-transparent hover:border-accent/30" onclick="alert('Detail view coming soon: ${safeName}')">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded border border-black/5 dark:border-white/5 ${badgeClass}">${escapeHtml(beer.style)}</span>
                        <div class="flex text-yellow-500 text-[10px] tracking-tighter">
                            ${stars}
                        </div>
                    </div>
                    
                    <div class="flex-grow">
                        <h4 class="font-bold text-text-dark dark:text-white text-sm line-clamp-2 leading-tight group-hover:text-accent transition">${safeName}</h4>
                        <p class="text-[10px] text-text-mutedDark dark:text-text-muted truncate mt-0.5">${safeBrewery}</p>
                    </div>

                    <div class="mt-3 flex justify-between items-end border-t border-gray-100 dark:border-gray-700 pt-2">
                        <span class="text-[10px] font-mono text-text-mutedDark dark:text-text-muted">
                            <i class="ph-bold ph-pint-glass mr-0.5"></i>${(beer.totalMl / 1000).toFixed(1)}L
                        </span>
                        <span class="text-[10px] font-bold text-accent bg-accent/10 px-1.5 rounded">x${beer.count}</span>
                    </div>
                </div>
            `;
        }).join('');

        grid.innerHTML = html;
        
        // Update Total Count in Header
        const totalCountEl = document.getElementById('cellar-total-count');
        if (totalCountEl) {
            totalCountEl.textContent = `${beerStats.length} Beers`;
        }

    } catch (e) {
        console.error("Failed to render beer stats:", e);
        grid.innerHTML = '<div class="col-span-2 text-center text-red-500 text-xs">Error loading data</div>';
    }
}