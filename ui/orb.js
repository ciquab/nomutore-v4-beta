import { APP, EXERCISE, BEER_COLORS, STYLE_METADATA } from '../constants.js';
import { Calc } from '../logic.js';
import { Store } from '../store.js';
import { StateManager } from './state.js';
import { DOM } from './dom.js';

/**
 * "Craft & Flow" Orb Renderer
 * Logic Inversion: 
 * - 借金 (マイナス) = 液体が増える (Fill)
 * - 貯金 (プラス) = 液体が減る/空になる (Drain/Clean)
 */
export function updateOrb(currentBalanceKcal) {
    const orbFront = DOM.elements['orb-liquid-front'];
    const orbBack = DOM.elements['orb-liquid-back'];
    const balanceVal = DOM.elements['balance-val'];
    const statusText = DOM.elements['status-text'];

    // 要素がなければスキップ（エラー回避）
    if (!orbFront || !balanceVal) return;

    const profile = Store.getProfile();
    const settings = {
        modes: Store.getModes(),
        baseExercise: Store.getBaseExercise()
    };

    // 1. 数値表示の更新
    balanceVal.textContent = Math.round(currentBalanceKcal);

    // 2. スタイル情報の取得 (constants.jsと整合)
    // 現在選択中のモード ("mode1" or "mode2") に対応するビールスタイル名を取得
    const currentStyleName = StateManager.beerMode === 'mode1' ? settings.modes.mode1 : settings.modes.mode2;
    
    // メタデータから色キーを取得 (例: "Hazy IPA" -> "hazy")
    // 定義がない場合はデフォルトで 'gold' (ピルスナー色)
    const styleMeta = STYLE_METADATA[currentStyleName] || { color: 'gold' };
    const colorKey = styleMeta.color;
    
    // グラデーション定義を取得
    let liquidGradient = BEER_COLORS[colorKey] || BEER_COLORS['gold'];

    // Hazy判定 (名前による判定は維持しつつ、メタデータ優先)
    const lowerName = currentStyleName.toLowerCase();
    const isHazy = lowerName.includes('hazy') || lowerName.includes('wheat') || lowerName.includes('weizen');

    // 3. 水位と状態メッセージの計算
    const MAX_DEBT_CAP = 700; // 満タンになる借金量 (kcal)
    let fillPercentage = 0;
    let statusMsg = "";
    let statusClass = "";

    if (currentBalanceKcal < 0) {
        // --- 借金あり (液体充填) ---
        const debt = Math.abs(currentBalanceKcal);
        
        // 借金が多いほど満たされる (上限100%)
        // 視認性のため、わずかでも借金があれば最低15%は表示
        fillPercentage = Math.min(100, Math.max(15, (debt / MAX_DEBT_CAP) * 100));

        const baseExData = EXERCISE[settings.baseExercise] || EXERCISE['stepper'];
        const debtMins = Calc.convertKcalToMinutes(debt, settings.baseExercise, profile);

        if (debt > 500) {
            statusMsg = `Warning: ${debtMins} min debt`;
            statusClass = "text-red-500 animate-pulse";
            // 警告時は少し赤みを混ぜても良いが、今回はビール色を尊重
        } else {
            statusMsg = `Recovery: ${debtMins} min (${baseExData.label})`;
            statusClass = "text-accent"; // Amber color
        }

    } else {
        // --- 貯金あり (クリーン/空) ---
        fillPercentage = 0;
        
        // 貯金時は「回復の泉」としてエメラルド色に変更 (guideline: Recovery Color)
        liquidGradient = "linear-gradient(135deg, #10b981, #34d399)"; 
        
        const creditMins = Calc.convertKcalToMinutes(currentBalanceKcal, settings.baseExercise, profile);
        
        if (currentBalanceKcal === 0) {
            statusMsg = "Balanced";
            statusClass = "text-gray-400";
        } else {
            statusMsg = `Savings: +${creditMins} min`;
            statusClass = "text-recovery font-bold";
        }
    }

    // 4. DOMへの反映 (アニメーション)
    requestAnimationFrame(() => {
        // CSSの top は 100% が底、0% が天井
        const topValue = 100 - fillPercentage;
        
        orbFront.style.top = `${topValue}%`;
        orbBack.style.top = `${topValue}%`;
        
        // 液色の適用
        orbFront.style.background = liquidGradient;
        orbBack.style.background = liquidGradient; 
        
        // Back wave は少し透明度を下げて奥行きを出す
        orbBack.style.opacity = '0.6';

        // 濁り表現
        if (isHazy && currentBalanceKcal < 0) {
            orbFront.style.filter = 'blur(1px) brightness(1.1)';
        } else {
            orbFront.style.filter = 'none';
        }

        // テキスト更新
        if (statusText) {
            statusText.textContent = statusMsg;
            statusText.className = `text-xl font-bold drop-shadow-sm transition-colors duration-300 ${statusClass}`;
        }
    });
}