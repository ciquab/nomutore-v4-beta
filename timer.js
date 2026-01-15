import { APP, EXERCISE, CALORIES } from '../constants.js';
import { Calc } from '../logic.js';
import { Store } from '../store.js';
import { StateManager } from './state.js';
import { UI, toggleModal } from './index.js'; // UIユーティリティ
import { DOM, showConfetti, showMessage } from './dom.js';

// 保存処理を実行するためのハンドラ
let _saveExerciseHandler = null;

export const setTimerSaveHandler = (fn) => {
    _saveExerciseHandler = fn;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
// 演出用: ビール1杯分のカロリー (標準的なラガー)
const UNIT_KCAL = 140; 
let lastBurnedKcal = 0; // 前回チェック時の消費カロリー

// ----------------------------------------------------------------------
// DOM Generation (Full Screen Modal)
// ----------------------------------------------------------------------
const renderTimerModal = () => {
    if (document.getElementById('timer-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'timer-modal';
    modal.className = "fixed inset-0 z-[80] bg-base-900 text-white flex flex-col items-center justify-center hidden opacity-0 transition-opacity duration-300";
    modal.innerHTML = `
        <!-- Background Elements -->
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
            <div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/20 rounded-full blur-[100px] animate-pulse"></div>
            <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/20 rounded-full blur-[100px] animate-pulse" style="animation-delay: 1s;"></div>
        </div>

        <!-- Header -->
        <div class="absolute top-0 w-full p-6 flex justify-between items-center z-10">
            <div class="flex items-center gap-2">
                <span class="text-2xl">🏃‍♀️</span>
                <span class="font-bold text-lg tracking-widest">WORKOUT</span>
            </div>
            <button id="btn-minimize-timer" class="p-2 rounded-full bg-white/10 hover:bg-white/20 transition">
                <i class="ph-bold ph-caret-down"></i>
            </button>
        </div>

        <!-- Main Timer Display -->
        <div class="relative z-10 flex flex-col items-center mb-12">
            <!-- Progress Ring (Decorative) -->
            <div class="absolute inset-0 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full border-4 border-white/5 top-1/2 left-1/2 pointer-events-none"></div>
            <div class="absolute inset-0 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full border-2 border-dashed border-white/10 top-1/2 left-1/2 pointer-events-none animate-[spin_10s_linear_infinite]"></div>

            <div id="timer-status" class="text-emerald-400 font-bold tracking-[0.2em] mb-4 text-sm uppercase animate-pulse">READY</div>
            
            <div class="font-black text-8xl tracking-tighter tabular-nums mb-2 text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400" id="timer-display">
                00:00
            </div>
            
            <div class="flex items-center gap-4 text-sm text-gray-400">
                <div class="flex flex-col items-center">
                    <span class="text-xs font-bold uppercase tracking-wider mb-0.5">Burned</span>
                    <span id="timer-kcal" class="font-mono text-white font-bold text-lg">0</span>
                    <span class="text-[10px]">kcal</span>
                </div>
            </div>
        </div>

        <!-- Controls -->
        <div class="relative z-10 flex items-center gap-6">
            <button id="timer-btn-start" class="w-20 h-20 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center transition transform hover:scale-105 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                <i class="ph-fill ph-play text-3xl"></i>
            </button>

            <button id="timer-btn-pause" class="w-20 h-20 rounded-full bg-yellow-500 hover:bg-yellow-400 text-black flex items-center justify-center transition transform hover:scale-105 shadow-[0_0_30px_rgba(234,179,8,0.4)] hidden">
                <i class="ph-fill ph-pause text-3xl"></i>
            </button>
            
            <button id="timer-btn-resume" class="w-20 h-20 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center transition transform hover:scale-105 shadow-[0_0_30px_rgba(16,185,129,0.4)] hidden">
                <i class="ph-fill ph-play text-3xl"></i>
            </button>

            <button id="timer-btn-stop" class="w-16 h-16 rounded-full bg-white/10 hover:bg-red-500/80 text-white flex items-center justify-center transition hover:scale-105 backdrop-blur-md hidden">
                <i class="ph-fill ph-stop text-2xl"></i>
            </button>
        </div>

        <!-- Exercise Selector (Overlay style) -->
        <div class="absolute bottom-10 w-full max-w-sm px-6 z-10">
            <label class="block text-xs font-bold text-gray-500 mb-2 text-center uppercase tracking-widest">Activity Type</label>
            <div class="relative">
                <select id="timer-exercise-select" class="w-full bg-white/10 text-white border border-white/20 rounded-xl p-3 outline-none text-center font-bold appearance-none">
                    <!-- Options injected via JS -->
                </select>
                <div class="absolute right-4 top-3.5 text-white/50 pointer-events-none">
                    <i class="ph-bold ph-caret-down"></i>
                </div>
            </div>
        </div>

        <!-- Toast Notification Area -->
        <div id="timer-toast-area" class="absolute top-24 left-0 w-full flex flex-col items-center gap-2 pointer-events-none"></div>
    `;
    
    document.body.appendChild(modal);

    // Bind Events
    document.getElementById('btn-minimize-timer').onclick = () => {
        // バックグラウンド実行時はモーダルだけ隠す（タイマーは止まらない）
        toggleModal('timer-modal', false);
    };

    document.getElementById('timer-btn-start').onclick = Timer.start;
    document.getElementById('timer-btn-pause').onclick = Timer.pause;
    document.getElementById('timer-btn-resume').onclick = Timer.resume;
    document.getElementById('timer-btn-stop').onclick = Timer.stop;

    // Populate Select
    const sel = document.getElementById('timer-exercise-select');
    if (sel) {
        Object.keys(EXERCISE).forEach(k => {
            const o = document.createElement('option');
            o.value = k;
            o.textContent = EXERCISE[k].label;
            sel.appendChild(o);
        });
        // Default
        const def = Store.getDefaultRecordExercise();
        if (def) sel.value = def;
    }
};

// ----------------------------------------------------------------------
// Internal Logic
// ----------------------------------------------------------------------

const showTimerToast = (msg, icon = '🍺') => {
    const area = document.getElementById('timer-toast-area');
    if (!area) return;

    const toast = document.createElement('div');
    toast.className = "bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-full flex items-center gap-2 animate-[float_1s_ease-out_forwards]";
    toast.innerHTML = `<span class="text-xl">${icon}</span> <span class="font-bold text-sm text-white">${msg}</span>`;
    
    area.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
};

const updateTimeDisplay = () => { 
    const stStr = localStorage.getItem(APP.STORAGE_KEYS.TIMER_START);
    const accStr = localStorage.getItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED);
    let totalMs = 0;
    
    if (accStr) totalMs += parseInt(accStr, 10);
    if (stStr) totalMs += (Date.now() - parseInt(stStr, 10));

    // Time Format
    const totalSec = Math.floor(totalMs / 1000);
    const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const ss = (totalSec % 60).toString().padStart(2, '0');
    
    const display = document.getElementById('timer-display');
    if(display) display.textContent = `${mm}:${ss}`;

    // Kcal Calculation & Effect
    const exKey = document.getElementById('timer-exercise-select')?.value || 'walking';
    const mets = EXERCISE[exKey] ? EXERCISE[exKey].mets : 3.0;
    const profile = Store.getProfile();
    const ratePerMin = Calc.burnRate(mets, profile);
    
    const burned = Math.floor((totalMs / 60000) * ratePerMin);
    
    const kcalEl = document.getElementById('timer-kcal');
    if (kcalEl) kcalEl.textContent = burned;

    // Check Milestones (1 Beer unit)
    if (burned > 0 && burned >= lastBurnedKcal + UNIT_KCAL) {
        lastBurnedKcal = burned;
        showTimerToast('Beer Earned!', '🍺');
        showConfetti(); // 軽い紙吹雪
    }
};

const updateButtons = (state) => {
    const startBtn = document.getElementById('timer-btn-start');
    const pauseBtn = document.getElementById('timer-btn-pause');
    const resumeBtn = document.getElementById('timer-btn-resume');
    const stopBtn = document.getElementById('timer-btn-stop');
    const statusText = document.getElementById('timer-status');
    const sel = document.getElementById('timer-exercise-select');
    
    [startBtn, pauseBtn, resumeBtn, stopBtn].forEach(el => el?.classList.add('hidden'));

    if (state === 'running') {
        pauseBtn?.classList.remove('hidden');
        stopBtn?.classList.remove('hidden');
        if (sel) sel.disabled = true;
        if(statusText) { 
            statusText.textContent = 'RUNNING'; 
            statusText.className = 'text-emerald-400 font-bold tracking-[0.2em] mb-4 text-sm uppercase animate-pulse'; 
        }
    } else if (state === 'paused') {
        resumeBtn?.classList.remove('hidden');
        stopBtn?.classList.remove('hidden');
        if(statusText) { 
            statusText.textContent = 'PAUSED'; 
            statusText.className = 'text-yellow-400 font-bold tracking-[0.2em] mb-4 text-sm uppercase'; 
        }
    } else { 
        startBtn?.classList.remove('hidden');
        if (sel) sel.disabled = false;
        if(statusText) { 
            statusText.textContent = 'READY'; 
            statusText.className = 'text-gray-500 font-bold tracking-[0.2em] mb-4 text-sm uppercase'; 
        }
        // Reset Kcal tracking
        lastBurnedKcal = 0;
        const k = document.getElementById('timer-kcal');
        if(k) k.textContent = '0';
    }
};

export const Timer = {
    init: () => {
        renderTimerModal();
        Timer.restoreState();
    },

    open: () => {
        renderTimerModal();
        toggleModal('timer-modal', true);
    },

    start: () => {
        if (StateManager.timerId) return;
        
        lastBurnedKcal = 0; // Reset session tracking logic
        const accStr = localStorage.getItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED);
        if (accStr) {
            // Calculate starting burned kcal if resuming
            // (Strictly speaking, we should persist kcal, but approximate recalculation is fine for UI)
        }

        localStorage.setItem(APP.STORAGE_KEYS.TIMER_START, Date.now());
        updateButtons('running');
        updateTimeDisplay();
        StateManager.setTimerId(setInterval(updateTimeDisplay, 1000));
    },

    pause: () => {
        if (StateManager.timerId) {
            clearInterval(StateManager.timerId);
            StateManager.setTimerId(null);
        }
        const stStr = localStorage.getItem(APP.STORAGE_KEYS.TIMER_START);
        if (stStr) {
            const currentSession = Date.now() - parseInt(stStr, 10);
            const prevAcc = parseInt(localStorage.getItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED) || '0', 10);
            localStorage.setItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED, prevAcc + currentSession);
            localStorage.removeItem(APP.STORAGE_KEYS.TIMER_START);
        }
        updateButtons('paused');
        updateTimeDisplay();
    },

    resume: () => {
        if (StateManager.timerId) return;
        localStorage.setItem(APP.STORAGE_KEYS.TIMER_START, Date.now());
        updateButtons('running');
        updateTimeDisplay();
        StateManager.setTimerId(setInterval(updateTimeDisplay, 1000));
    },

    stop: async () => {
        Timer.pause();
        const totalMs = parseInt(localStorage.getItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED) || '0', 10);
        const m = totalMs / 60000; // Float minutes
        
        localStorage.removeItem(APP.STORAGE_KEYS.TIMER_START);
        localStorage.removeItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED);
        
        updateButtons('initial');
        const display = document.getElementById('timer-display');
        if (display) display.textContent = '00:00';
        
        if (m >= 1.0) { // 1分以上で保存
            if (_saveExerciseHandler) {
                const type = document.getElementById('timer-exercise-select').value;
                await _saveExerciseHandler(type, m);
                toggleModal('timer-modal', false);
            } else {
                console.warn("Save handler not set for Timer.");
                UI.showMessage('保存処理が設定されていません', 'error');
            }
        } else {
            UI.showMessage('1分未満のため記録されませんでした', 'error');
            toggleModal('timer-modal', false);
        }
        
        lastBurnedKcal = 0;
    },

    // アプリ起動時の状態復元
    restoreState: () => {
        const st = localStorage.getItem(APP.STORAGE_KEYS.TIMER_START);
        const acc = localStorage.getItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED);
        
        if (st) {
            const elapsed = Date.now() - parseInt(st, 10);
            if (elapsed > ONE_DAY_MS) {
                localStorage.removeItem(APP.STORAGE_KEYS.TIMER_START);
                localStorage.removeItem(APP.STORAGE_KEYS.TIMER_ACCUMULATED);
                return false;
            }
            // 復元時は自動的にモーダルを開かない方が良いかもしれないが、
            // 計測中であることがわかるようにバックグラウンドで状態同期
            updateButtons('running');
            StateManager.setTimerId(setInterval(updateTimeDisplay, 1000));
            return true;
        } else if (acc) {
            updateButtons('paused');
            updateTimeDisplay();
            return true;
        }
        return false;
    }
};