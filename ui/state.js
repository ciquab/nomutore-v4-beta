// 内部状態（直接アクセス禁止）
const _state = { 
    beerMode: 'mode1', 
    chart: null, 
    timerId: null,
    chartRange: '1w',
    isEditMode: false,
    heatmapOffset: 0,
    
    // Cellar Views
    cellarView: 'logs',     // 'logs' | 'beers' | 'archives'
    
    // Pagination & Loading
    logLimit: 50,
    isLoadingLogs: false
};

// 状態マネージャー
export const StateManager = {
    get beerMode() { return _state.beerMode; },
    get chart() { return _state.chart; },
    get timerId() { return _state.timerId; },
    get chartRange() { return _state.chartRange; },
    get isEditMode() { return _state.isEditMode; },
    get heatmapOffset() { return _state.heatmapOffset; },
    
    // Cellar
    get cellarView() { return _state.cellarView; },
    get logLimit() { return _state.logLimit; },
    get isLoadingLogs() { return _state.isLoadingLogs; },

    setBeerMode: (v) => { _state.beerMode = v; },
    setChart: (v) => { if(_state.chart) _state.chart.destroy(); _state.chart = v; },
    setTimerId: (v) => { _state.timerId = v; },
    setChartRange: (v) => { _state.chartRange = v; },
    setIsEditMode: (v) => { _state.isEditMode = v; }, 
    setHeatmapOffset: (v) => { _state.heatmapOffset = v; },
    
    incrementHeatmapOffset: () => { _state.heatmapOffset++; },
    decrementHeatmapOffset: () => { if(_state.heatmapOffset > 0) _state.heatmapOffset--; },
    
    // Cellar View Switching
    setCellarView: (view) => {
        _state.cellarView = view;
        // DOM操作はController(index.js/dom.js)の役割だが、
        // 便宜上クラス切り替え用のヘルパークラスを操作させるのが一般的
        // ここでは状態変更のみ行い、実際のDOM切り替えは ui/index.js でトリガーする
    },

    // 無限スクロール用
    setLogLimit: (v) => { _state.logLimit = v; },
    incrementLogLimit: (v) => { _state.logLimit += v; },
    setLogLoading: (v) => { _state.isLoadingLogs = v; },
    
    toggleEditMode: () => { _state.isEditMode = !_state.isEditMode; return _state.isEditMode; }
};