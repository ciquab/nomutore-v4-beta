import { APP } from './constants.js';

// 外部から注入される保存処理ハンドラ
let _saveHandler = null;

// インターバルIDをモジュール内で管理
let _intervalId = null;

export const setTimerSaveHandler = (fn) => {
    _saveHandler = fn;
};

/**
 * 時間表示の更新 (00:00)
 */
const updateDisplay = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    
    const el = document.getElementById('timer-display');
    if (el) el.textContent = `${m}:${s}`;
};

/**
 * ボタンの表示切り替え
 * v4のHTML構造 (start-stepper-btn / timer-controls) に対応
 */
const updateUIState = (state) => {
    const startBtn = document.getElementById('start-stepper-btn');
    const controls = document.getElementById('timer-controls');
    const pauseBtn = document.getElementById('pause-stepper-btn');
    const resumeBtn = document.getElementById('resume-stepper-btn');
    // stopBtn は controls 内に常駐するため個別の表示制御は不要だが、controlsごとの表示切替に含まれる

    if (!startBtn || !controls) return;

    if (state === 'running') {
        startBtn.classList.add('hidden');
        controls.classList.remove('hidden');
        
        pauseBtn?.classList.remove('hidden');
        resumeBtn?.classList.add('hidden');
        
    } else if (state === 'paused') {
        startBtn.classList.add('hidden');
        controls.classList.remove('hidden');
        
        pauseBtn?.classList.add('hidden');
        resumeBtn?.classList.remove('hidden');
        
    } else { 
        // stopped (initial)
        startBtn.classList.remove('hidden');
        controls.classList.add('hidden');
    }
};

export const Timer = {
    startTime: null,
    accumulatedTime: 0, // 一時停止までに蓄積された時間(ms)
    isRunning: false,

    init: () => {
        // 状態復元
        const savedStart = localStorage.getItem(APP.STORAGE_KEYS.TIMER_START);
        const savedAcc = localStorage.getItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED);

        if (savedAcc) Timer.accumulatedTime = parseInt(savedAcc, 10);

        if (savedStart) {
            Timer.startTime = parseInt(savedStart, 10);
            Timer.isRunning = true;
            Timer.startInterval();
            updateUIState('running');
        } else if (Timer.accumulatedTime > 0) {
            // 一時停止状態
            updateDisplay(Timer.accumulatedTime);
            updateUIState('paused');
        } else {
            updateUIState('stopped');
        }
    },

    start: () => {
        if (Timer.isRunning) return;
        
        Timer.startTime = Date.now();
        Timer.isRunning = true;
        
        localStorage.setItem(APP.STORAGE_KEYS.TIMER_START, Timer.startTime);
        
        Timer.startInterval();
        updateUIState('running');
    },

    pause: () => {
        if (!Timer.isRunning) return;

        // 経過時間を蓄積に加算
        const elapsed = Date.now() - Timer.startTime;
        Timer.accumulatedTime += elapsed;
        
        Timer.stopInterval();
        Timer.isRunning = false;

        localStorage.removeItem(APP.STORAGE_KEYS.TIMER_START);
        localStorage.setItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED, Timer.accumulatedTime);

        updateUIState('paused');
    },

    resume: () => {
        if (Timer.isRunning) return;

        Timer.startTime = Date.now();
        Timer.isRunning = true;

        localStorage.setItem(APP.STORAGE_KEYS.TIMER_START, Timer.startTime);
        Timer.startInterval();
        updateUIState('running');
    },

    stop: async () => {
        // まず一時停止して時間を確定させる
        Timer.stopInterval();
        
        // 最終時間の計算
        let totalMs = Timer.accumulatedTime;
        if (Timer.isRunning && Timer.startTime) {
            totalMs += (Date.now() - Timer.startTime);
        }

        const minutes = Math.floor(totalMs / 60000); // 分単位（切り捨て）

        // 状態クリア
        Timer.resetState();
        updateDisplay(0);
        updateUIState('stopped');

        // 保存処理
        if (minutes >= 1) {
            if (confirm(`${minutes}分の運動を記録しますか？`)) {
                if (_saveHandler) {
                    // 現在選択されている運動種目を取得
                    const typeSelect = document.getElementById('exercise-select');
                    const type = typeSelect ? typeSelect.value : 'stepper'; 
                    await _saveHandler(type, minutes);
                }
            }
        } else {
            // 1分未満は記録しないが、UIはリセットする
            // 必要に応じてメッセージ表示: alert('1分未満のため記録しませんでした。');
        }
    },

    startInterval: () => {
        if (_intervalId) clearInterval(_intervalId);
        _intervalId = setInterval(() => {
            const current = Date.now() - Timer.startTime + Timer.accumulatedTime;
            updateDisplay(current);
        }, 1000);
    },

    stopInterval: () => {
        if (_intervalId) {
            clearInterval(_intervalId);
            _intervalId = null;
        }
    },

    resetState: () => {
        Timer.startTime = null;
        Timer.accumulatedTime = 0;
        Timer.isRunning = false;
        localStorage.removeItem(APP.STORAGE_KEYS.TIMER_START);
        localStorage.removeItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED);
    },
    
    // アプリ起動時に「計測中」または「一時停止中」であれば true を返す
    // (main.js がこれを見てモーダルを開くかどうか決める)
    restoreState: () => {
        Timer.init();
        return (Timer.isRunning || Timer.accumulatedTime > 0);
    }
};