import { Calc } from '../logic.js';
import { Store } from '../store.js';
import { StateManager } from './state.js';
import { DOM } from './dom.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

export function renderChart(logs, checks) {
    const ctxCanvas = document.getElementById('balanceChart');
    if (!ctxCanvas || typeof Chart === 'undefined') return;

    // フィルタボタンの更新
    const filters = DOM.elements['chart-filters'] || document.getElementById('chart-filters');
    if(filters) {
        filters.querySelectorAll('button').forEach(btn => {
            const isActive = btn.dataset.range === StateManager.chartRange;
            btn.className = `px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                isActive ? "active-filter bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-300 shadow-sm" 
                         : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            }`;
        });
    }

    try {
        const now = dayjs();
        let cutoffDate = StateManager.chartRange === '1w' ? now.subtract(7, 'day').valueOf() :
                         StateManager.chartRange === '1m' ? now.subtract(1, 'month').valueOf() :
                         now.subtract(3, 'month').valueOf();

        const profile = Store.getProfile();
        const baseEx = profile.baseExercise || 'walking';

        // --- データセット準備 ---
        const dateMap = new Map();
        
        // 1. 日付ごとの枠を作成
        let current = dayjs(cutoffDate);
        const end = dayjs();
        while(current.isBefore(end) || current.isSame(end, 'day')) {
            const dStr = current.format('MM/DD');
            dateMap.set(dStr, { date: dStr, balance: 0, weight: null, hasWeight: false });
            current = current.add(1, 'day');
        }

        // 2. ログデータの集計 (Balance)
        logs.forEach(l => {
            if (l.timestamp >= cutoffDate) {
                const dStr = dayjs(l.timestamp).format('MM/DD');
                if (dateMap.has(dStr)) {
                    // kcalがあれば優先、なければminutesから計算
                    const val = l.kcal !== undefined ? l.kcal : (l.minutes * Calc.burnRate(6.0, profile));
                    dateMap.get(dStr).balance += val;
                }
            }
        });

        // 3. チェックデータの集計 (Weight)
        // 同じ日に複数記録がある場合は最新を採用
        checks.forEach(c => {
            if (c.timestamp >= cutoffDate && c.weight) {
                const dStr = dayjs(c.timestamp).format('MM/DD');
                if (dateMap.has(dStr)) {
                    dateMap.get(dStr).weight = parseFloat(c.weight);
                    dateMap.get(dStr).hasWeight = true;
                }
            }
        });

        // 4. 配列化 & 体重データの補間 (nullだと線が切れるため、前日データで埋めるオプションも考えられるが、Chart.jsのspanGapsを使う)
        const dataArray = Array.from(dateMap.values());

        // 体重グラフのY軸範囲調整 (見やすくするため)
        const weights = dataArray.filter(d => d.hasWeight).map(d => d.weight);
        let weightMin = 40, weightMax = 100;
        if (weights.length > 0) {
            weightMin = Math.min(...weights) - 2.0;
            weightMax = Math.max(...weights) + 2.0;
        }

        // Chart生成
        if (StateManager.chart) StateManager.chart.destroy();

        // Dark mode detection for Chart.js colors
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#9CA3AF' : '#6B7280';
        const gridColor = isDark ? 'rgba(75, 85, 99, 0.2)' : 'rgba(229, 231, 235, 0.5)';

        const newChart = new Chart(ctxCanvas, {
            type: 'bar',
            data: {
                labels: dataArray.map(d => d.date),
                datasets: [
                    { 
                        // 運動 (プラス)
                        label: 'Earned', 
                        data: dataArray.map(d => d.balance > 0 ? Math.round(Calc.convertKcalToMinutes(d.balance, baseEx, profile)) : 0), 
                        backgroundColor: '#10B981', 
                        borderRadius: 4,
                        stack: '0', 
                        order: 2,
                        yAxisID: 'y'
                    },
                    { 
                        // 飲酒 (マイナス) - グラフ上はプラス方向に表示した方が見やすい場合もあるが、収支通りマイナスに出す
                        label: 'Consumed', 
                        data: dataArray.map(d => d.balance < 0 ? Math.round(Calc.convertKcalToMinutes(d.balance, baseEx, profile)) : 0), 
                        backgroundColor: '#EF4444', 
                        borderRadius: 4,
                        stack: '0', 
                        order: 3,
                        yAxisID: 'y'
                    },
                    {
                        // 体重 (折れ線) - 右軸
                        type: 'line',
                        label: 'Weight',
                        data: dataArray.map(d => d.weight), // nullが含まれるとspanGaps: trueが必要
                        borderColor: '#6366F1', // Indigo
                        backgroundColor: '#6366F1',
                        borderWidth: 2,
                        pointRadius: 3,
                        tension: 0.3,
                        yAxisID: 'y1',
                        order: 1,
                        spanGaps: true // データ欠損時も線をつなぐ
                    }
                ] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                scales: { 
                    x: { 
                        stacked: true,
                        ticks: { color: textColor, font: { size: 10 } },
                        grid: { display: false }
                    }, 
                    y: { 
                        // 左軸: カロリー(分)
                        beginAtZero: true,
                        position: 'left',
                        title: { display: false }, // スペース節約
                        ticks: { color: textColor, font: { size: 10 } },
                        grid: { color: gridColor }
                    },
                    y1: {
                        // 右軸: 体重
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: weightMin,
                        max: weightMax,
                        grid: { drawOnChartArea: false }, // グリッド線は左軸に合わせる
                        ticks: { color: '#6366F1', font: { size: 10, weight: 'bold' } }
                    }
                }, 
                plugins: { 
                    legend: { 
                        display: true, 
                        position: 'bottom', 
                        labels: { color: textColor, boxWidth: 10, font: { size: 10 } } 
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                } 
            }
        });
        
        StateManager.setChart(newChart);

    } catch(e) { console.error('Chart Error', e); }
}