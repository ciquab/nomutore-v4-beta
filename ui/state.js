// ui/state.js
import { APP } from '../constants.js';

const _state = {
    cellarViewMode: 'logs', // 'logs' | 'stats' | 'archives'
    heatmapOffset: 0,       // 0 = current week
    chartRange: '1w',       // '1w', '1m', '3m'
    beerMode: localStorage.getItem('nomutore_home_beer_mode') || 'mode1' // 'mode1' or 'mode2'
};

export const StateManager = {
    // Cellar View
    get cellarViewMode() { return _state.cellarViewMode; },
    setCellarViewMode(mode) { _state.cellarViewMode = mode; },

    // Heatmap
    get heatmapOffset() { return _state.heatmapOffset; },
    setHeatmapOffset(offset) { _state.heatmapOffset = offset; },

    // Chart
    get chartRange() { return _state.chartRange; },
    setChartRange(range) { _state.chartRange = range; },

    // Home Beer Mode
    get beerMode() { return _state.beerMode; },
    setBeerMode(mode) {
        _state.beerMode = mode;
        localStorage.setItem('nomutore_home_beer_mode', mode);
    }
};