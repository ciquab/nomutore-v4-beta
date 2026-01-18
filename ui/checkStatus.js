import { Calc } from '../logic.js';
import { DOM, escapeHtml } from './dom.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

export function renderCheckStatus(checks, logs) {
    const status = DOM.elements['check-status'] || document.getElementById('check-status');
    if(!status) return;

    const today = dayjs();
    const yest = today.subtract(1, 'day');
    let targetCheck = null; let type = 'none';

    if (checks.length > 0) {
        for(let i=checks.length-1; i>=0; i--) {
            const c = checks[i];
            const checkDay = dayjs(c.timestamp);
            if (checkDay.isSame(today, 'day')) { targetCheck = c; type = 'today'; break; }
            if (checkDay.isSame(yest, 'day')) { targetCheck = c; type = 'yesterday'; break; }
        }
    }

    // テーマとテキストの決定
    let theme = {
        bg: "bg-gray-50", darkBg: "dark:bg-gray-800/50",
        text: "text-gray-800", darkText: "dark:text-white",
        icon: "text-gray-300", iconName: "ph-clipboard-text",
        accent: "bg-gray-200"
    };
    
    let label = "DAILY CHECK";
    let mainStatus = "No Record";
    let subStatus = "記録がありません";
    let bottomContent = `<span class="text-[10px] font-bold opacity-60">Tap to record</span>`;

    if (type !== 'none') {
        const { short, desc, score } = analyzeCondition(targetCheck, logs);
        
        if (type === 'today') {
            label = "TODAY'S COND.";
            // スコアに基づく色分け
            if (score >= 3) { // 好調
                theme = { 
                    bg: "bg-emerald-50", darkBg: "dark:bg-emerald-900/20",
                    text: "text-emerald-900", darkText: "dark:text-emerald-100",
                    icon: "text-emerald-500", iconName: "ph-smiley"
                };
            } else if (score >= 1) { // 普通
                theme = { 
                    bg: "bg-blue-50", darkBg: "dark:bg-blue-900/20",
                    text: "text-blue-900", darkText: "dark:text-blue-100",
                    icon: "text-blue-500", iconName: "ph-activity"
                };
            } else { // 不調
                theme = { 
                    bg: "bg-orange-50", darkBg: "dark:bg-orange-900/20",
                    text: "text-orange-900", darkText: "dark:text-orange-100",
                    icon: "text-orange-500", iconName: "ph-warning"
                };
            }
        } else {
            label = "YESTERDAY";
            theme = { 
                bg: "bg-white", darkBg: "dark:bg-gray-800",
                text: "text-gray-600", darkText: "dark:text-gray-300",
                icon: "text-gray-300", iconName: "ph-calendar-check"
            };
        }

        mainStatus = short;
        subStatus = desc;
        
        // フッター（体重表示 または Editバッジ）
        if (targetCheck.weight) {
            bottomContent = `<span class="text-[10px] font-bold font-mono bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded">${targetCheck.weight}kg</span>`;
        } else {
            bottomContent = `<span class="text-[10px] font-bold opacity-40">Edit</span>`;
        }
    }

    // HTML生成 (LiverRankと構造を完全一致させる)
    // h-full を指定し、親グリッドの高さに合わせて伸縮させる
    status.className = `glass-panel p-4 rounded-2xl relative overflow-hidden group cursor-pointer transition hover:border-opacity-50 flex flex-col justify-between h-full min-h-[130px] ${theme.bg} ${theme.darkBg}`;
    
    status.innerHTML = `
        <div class="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition transform group-hover:scale-110 duration-500">
            <i class="ph-fill ${theme.iconName} text-5xl ${theme.icon}"></i>
        </div>
        
        <div class="relative z-10 flex flex-col h-full justify-between">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-[10px] font-bold uppercase tracking-widest opacity-60 ${theme.text} ${theme.darkText}">${label}</span>
                </div>
                
                <div class="flex flex-col items-start">
                    <span class="text-3xl font-black ${theme.text} ${theme.darkText} leading-none tracking-tight truncate w-full">${mainStatus}</span>
                    <span class="text-xs font-bold opacity-80 ${theme.text} ${theme.darkText} mt-1 truncate w-full">${subStatus}</span>
                </div>
            </div>

            <div class="mt-3 flex justify-end items-end">
                <div class="${theme.text} ${theme.darkText}">
                    ${bottomContent}
                </div>
            </div>
        </div>
    `;
}

// 状態解析ロジック (短い英語タイトルと詳細を生成)
PWA改修計画書 漏れ・確認事項
Gemini との会話
v3の時のわかりやすい操作ガイドと同等のものをv4にも付けたいです。（添付はv3）

v3の操作ガイドの「わかりやすさ」と「親しみやすさ」を継承しつつ、v4の新機能（オーブ、アクションセンター、Cellar）に合わせて内容をアップデートした完全版ヘルプモーダルを作成しました。

index.html 内の `` の部分を、以下のコードで丸ごと上書きしてください。

🛠️ 修正: index.html (Help Modal)
レイアウトを「コンセプト」「遊び方」「ランクの仕組み」「他のお酒の換算表」の4部構成に整理し、v4のデザイン言語（Glassmorphism）で美しく整形しました。

HTML
    <div id="help-modal" class="fixed inset-0 bg-gray-900/60 hidden z-[100] flex items-center justify-center p-4 backdrop-blur-sm transition-opacity duration-300">
        <div class="bg-white dark:bg-base-900 w-full max-w-lg max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            
            <div class="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur">
                <h3 class="text-lg font-black text-base-900 dark:text-white flex items-center gap-2">
                    <i class="ph-fill ph-book-open text-indigo-500"></i>
                    User Guide
                </h3>
                <button onclick="UI.closeModal('help-modal')" class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition text-gray-500 dark:text-gray-300">✕</button>
            </div>
            
            <div class="p-6 overflow-y-auto custom-scrollbar space-y-8">
                
                <section class="text-center space-y-3">
                    <span class="px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-widest">Concept</span>
                    <h4 class="text-2xl font-black text-base-900 dark:text-white">
                        飲んだら、動いて返す。<br>
                        <span class="text-indigo-500">「実質ゼロ」</span>を目指そう。
                    </h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        Nomutore (ノムトレ) は、飲酒による摂取カロリーを<br>
                        運動による消費カロリーで相殺する<br>
                        <strong class="text-base-800 dark:text-gray-200">「借金返済型」</strong>の健康管理アプリです。
                    </p>
                </section>

                <hr class="border-gray-100 dark:border-gray-800">
                
                <section>
                    <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <i class="ph-fill ph-game-controller"></i> How to Play
                    </h4>
                    <div class="space-y-3">
                        <div class="flex gap-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                            <div class="w-10 h-10 rounded-full bg-white dark:bg-amber-800 flex items-center justify-center text-xl shadow-sm flex-shrink-0">🍺</div>
                            <div>
                                <h5 class="font-bold text-amber-900 dark:text-amber-200 text-sm">1. 飲んだら記録 (借金)</h5>
                                <p class="text-xs text-amber-800/70 dark:text-amber-300/70 mt-1">
                                    飲酒ボタンからビールを記録。ホームのオーブ（液体）が減り、<strong class="text-amber-700 dark:text-amber-200">「借金 (運動ノルマ)」</strong>が発生します。
                                </p>
                            </div>
                        </div>

                        <div class="flex gap-4 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                            <div class="w-10 h-10 rounded-full bg-white dark:bg-indigo-800 flex items-center justify-center text-xl shadow-sm flex-shrink-0">🏃</div>
                            <div>
                                <h5 class="font-bold text-indigo-900 dark:text-indigo-200 text-sm">2. 動いて返済</h5>
                                <p class="text-xs text-indigo-800/70 dark:text-indigo-300/70 mt-1">
                                    運動タイマーを起動、または手入力で運動を記録。借金を返済し、オーブを満タンに戻しましょう。
                                </p>
                            </div>
                        </div>

                        <div class="flex gap-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                            <div class="w-10 h-10 rounded-full bg-white dark:bg-emerald-800 flex items-center justify-center text-xl shadow-sm flex-shrink-0">✅</div>
                            <div>
                                <h5 class="font-bold text-emerald-900 dark:text-emerald-200 text-sm">3. コンディション管理</h5>
                                <p class="text-xs text-emerald-800/70 dark:text-emerald-300/70 mt-1">
                                    飲んだ翌日や休肝日は「Daily Check」。体調や体重を記録して、Liver Rank（肝臓ランク）を上げましょう。
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <hr class="border-gray-100 dark:border-gray-800">

                <section>
                    <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <i class="ph-fill ph-trophy"></i> Rank System
                    </h4>
                    <div class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <p class="text-xs text-gray-600 dark:text-gray-300 mb-4 text-center">
                            <strong class="text-indigo-600 dark:text-indigo-400">直近28日間の休肝日率</strong>等でランクが決まります。<br>
                            連続で休肝日を作るとボーナスが発生！
                        </p>
                        
                        <div class="grid grid-cols-2 gap-2">
                            <div class="bg-white dark:bg-gray-800 p-3 rounded-xl border border-purple-100 dark:border-purple-900/30 shadow-sm flex items-center gap-3">
                                <span class="text-2xl">👼</span>
                                <div>
                                    <span class="block text-xs font-black text-purple-600 dark:text-purple-400">Rank S</span>
                                    <span class="block text-[10px] text-gray-400">神の肝臓 (20日+)</span>
                                </div>
                            </div>
                            <div class="bg-white dark:bg-gray-800 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm flex items-center gap-3">
                                <span class="text-2xl">🛡️</span>
                                <div>
                                    <span class="block text-xs font-black text-indigo-600 dark:text-indigo-400">Rank A</span>
                                    <span class="block text-[10px] text-gray-400">鉄の肝臓 (12日+)</span>
                                </div>
                            </div>
                            <div class="bg-white dark:bg-gray-800 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm flex items-center gap-3">
                                <span class="text-2xl">🌿</span>
                                <div>
                                    <span class="block text-xs font-black text-emerald-600 dark:text-emerald-400">Rank B</span>
                                    <span class="block text-[10px] text-gray-400">健康志向 (8日+)</span>
                                </div>
                            </div>
                            <div class="bg-white dark:bg-gray-800 p-3 rounded-xl border border-red-100 dark:border-red-900/30 shadow-sm flex items-center gap-3">
                                <span class="text-2xl">⚠️</span>
                                <div>
                                    <span class="block text-xs font-black text-red-500 dark:text-red-400">Rank C</span>
                                    <span class="block text-[10px] text-gray-400">要注意</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <hr class="border-gray-100 dark:border-gray-800">

                <section>
                    <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <i class="ph-fill ph-scales"></i> Other Drinks
                    </h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        ビール以外のお酒は、カロリーが近いスタイルを選んで記録してください。
                    </p>
                    
                    <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                        <table class="w-full text-left border-collapse text-xs">
                            <thead class="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                <tr>
                                    <th class="p-3 font-bold">飲み物</th>
                                    <th class="p-3 font-bold">おすすめ設定</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200">
                                <tr>
                                    <td class="p-3 font-bold"><span class="mr-2">🥃</span>ハイボール (7%)</td>
                                    <td class="p-3"><span class="text-indigo-600 dark:text-indigo-400 font-bold">アンバーエール</span></td>
                                </tr>
                                <tr>
                                    <td class="p-3 font-bold"><span class="mr-2">🍋</span>レモンサワー</td>
                                    <td class="p-3"><span class="text-indigo-600 dark:text-indigo-400 font-bold">ペールエール</span></td>
                                </tr>
                                <tr>
                                    <td class="p-3 font-bold"><span class="mr-2">🥤</span>ストロング系 (9%)</td>
                                    <td class="p-3"><span class="text-indigo-600 dark:text-indigo-400 font-bold">IPA (West Coast)</span></td>
                                </tr>
                                <tr>
                                    <td class="p-3 font-bold"><span class="mr-2">🍷</span>ワイン / 日本酒</td>
                                    <td class="p-3"><span class="text-indigo-600 dark:text-indigo-400 font-bold">ベルジャン・トリペル</span> (250ml)</td>
                                </tr>
                                <tr>
                                    <td class="p-3 font-bold"><span class="mr-2">🍵</span>お茶割り</td>
                                    <td class="p-3"><span class="text-indigo-600 dark:text-indigo-400 font-bold">セッションIPA</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <div class="text-center pt-4">
                    <p class="text-[10px] text-gray-300 dark:text-gray-600">Nomutore v4.0 - Designed for Beer Geeks</p>
                </div>

            </div>
            
            <div class="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <button onclick="UI.closeModal('help-modal')" class="w-full bg-base-900 dark:bg-white dark:text-base-900 text-white font-bold py-3.5 rounded-xl shadow-lg transition transform active:scale-95 text-sm">
                    OK, Let's Drink!
                </button>
            </div>
        </div>
    </div>
ヘルプモーダルはどこを押すと開きますか？

現在の実装では、ホーム画面の 「Liver Rank (ランクが表示されている左側のカード)」 をタップすると開く設定になっています。

(index.html の liver-rank-card に onclick="UI.openHelp()" が付与されています)

💡 設定画面にもボタンを追加する場合
ホーム画面のカードタップは「裏技」的で気付きにくいため、設定タブ（Config）の最下部にもガイドを開くボタンを追加することをお勧めします。

index.html の tab-settings 内、Data Management パネルの下あたりに以下のコードを追加してください。

HTML
            <div class="glass-panel p-6 rounded-3xl mb-24"> <h2 class="text-xl font-black mb-4 flex items-center gap-2">
                    <i class="ph-fill ph-info text-indigo-500"></i>
                    About
                </h2>
                
                <button onclick="UI.openHelp()" class="w-full flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800 rounded-xl group transition hover:bg-gray-200 dark:hover:bg-gray-700">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center shadow-sm">
                            <i class="ph-fill ph-book-open text-indigo-500"></i>
                        </div>
                        <div class="text-left">
                            <span class="block text-xs font-bold text-gray-500 dark:text-gray-400">How to use</span>
                            <span class="block text-sm font-black text-base-900 dark:text-white">User Guide</span>
                        </div>
                    </div>
                    <i class="ph-bold ph-caret-right text-gray-400 group-hover:text-indigo-500 transition"></i>
                </button>
                
                <div class="mt-4 text-center">
                    <p class="text-[10px] font-bold text-gray-300 dark:text-gray-600">Nomutore v4.0.0 (Beta)</p>
                </div>
            </div>
※ これを追加する場合は、その上にある Data Management パネルの mb-24 を mb-4 に変更して間隔を調整してください。

v3では左上にありましたよね？

はい、その通りです。v3では左上のロゴ付近にヘルプ（ガイド）ボタンがありました。 v4でも同じ位置にあると、迷わずにガイドを開くことができて便利ですね。

ヘッダーのレイアウトを微調整し、左上に「?」ボタンを復活させます。

🛠️ index.html の修正（ヘッダー部分）
`` のセクションを以下のコードで上書きしてください。 左端にヘルプボタンを配置し、タイトルをその横に並べました。

HTML
    <header class="fixed top-0 w-full z-40 bg-white/80 dark:bg-base-900/80 backdrop-blur-md border-b border-base-200 dark:border-base-800 transition-colors">
        <div class="container mx-auto max-w-md h-14 flex items-center justify-between px-4">
            
            <div class="flex items-center gap-3">
                <button onclick="UI.openHelp()" class="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition">
                    <i class="ph-bold ph-question"></i>
                </button>
                
                <div class="flex items-baseline gap-1">
                    <h1 class="text-lg font-black tracking-tight text-base-900 dark:text-white">NOMUTORE</h1>
                    <span class="text-[10px] font-bold text-gray-400">v4</span>
                </div>
            </div>
            
            <div class="flex items-center gap-2">
                <select id="header-mode-select" class="text-xs font-bold bg-transparent border-none py-1 px-0 text-gray-600 dark:text-gray-300 focus:ring-0 cursor-pointer outline-none text-right">
                    <option value="mode1">Lager</option>
                    <option value="mode2">Ale</option>
                </select>

                <div class="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1"></div>

                <button onclick="UI.toggleTheme()" class="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-yellow-500 transition">
                    <i class="ph-fill ph-moon-stars"></i>
                </button>
            </div>
        </div>
    </header>
これで、画面左上の「?」ボタンを押せばいつでも操作ガイドが開くようになります。

？ボタンとロゴが並んでいるのはそれはそれでちょっと違和感がありますね。

「ロゴの隣にハテナマーク」という並びは、確かにアプリのタイトル周りがごちゃついて見えてしまい、ブランド感を損なう原因になりますね。
UI Header Designの画像
Getty Images

ヘルプボタンを右側に移動し、機能系ボタン（モード切替・テーマ切替・ヘルプ）として右上にまとめるレイアウトに変更します。これにより、左上はロゴだけですっきりとし、違和感が解消されます。

🛠️ index.html の修正（ヘッダー部分）
`` セクションを以下のコードで上書きしてください。

HTML
    <header class="fixed top-0 w-full z-40 bg-white/80 dark:bg-base-900/80 backdrop-blur-md border-b border-base-200 dark:border-base-800 transition-colors">
        <div class="container mx-auto max-w-md h-14 flex items-center justify-between px-4">
            
            <div class="flex items-center gap-2">
                <i class="ph-fill ph-beer-bottle text-indigo-500 text-xl"></i>
                <h1 class="text-lg font-black tracking-tight text-base-900 dark:text-white">NOMUTORE <span class="text-[10px] text-gray-400 font-normal ml-0.5">v4</span></h1>
            </div>
            
            <div class="flex items-center gap-1">
                <div class="relative group">
                    <select id="header-mode-select" class="text-xs font-bold bg-transparent border-none py-1 pr-4 pl-0 text-gray-600 dark:text-gray-300 focus:ring-0 cursor-pointer outline-none text-right appearance-none">
                        <option value="mode1">Lager</option>
                        <option value="mode2">Ale</option>
                    </select>
                    <div class="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-[8px]">▼</div>
                </div>

                <div class="w-px h-3 bg-gray-300 dark:bg-gray-700 mx-2"></div>

                <button onclick="UI.openHelp()" class="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                    <i class="ph-bold ph-question text-lg"></i>
                </button>

                <button onclick="UI.toggleTheme()" class="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-yellow-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                    <i class="ph-fill ph-moon-stars text-lg"></i>
                </button>
            </div>
        </div>
    </header>
変更点:

左側: ロゴとバージョン番号のみにし、クリーンな見た目にしました。

右側: 「モード選択」「ヘルプ」「テーマ」を機能エリアとして統合しました。区切り線を入れることで、選択系とボタン系を整理しています。

「借金を返済し、オーブを満タンに戻しましょう」とありますが、ロジックを逆にしたんじゃなかったでしたっけ？

ご指摘ありがとうございます！ おっしゃる通りです。「飲んだら（カロリー/毒素が）溜まる」「運動して（消化して）空っぽにする」 という デトックス（排出）モデル の方が、直感的かつ「実質ゼロを目指す」というコンセプトに合致します。

以前の「資産（HP）が減る」という説明は、v3時代の名残と混同していました。 ヘルプの文言を、「飲んで溜まった液体を、運動で空（ゼロ）にする」 というロジックに修正します。

🛠️ index.html (Help Modal修正)
`` 内の Step 1 と `Step 2` の説明文を書き換えます。 （HTML全体を貼り直すのは長いので、該当の `section` 部分のみ提示します。`help-modal` の中身を書き換えてください）

HTML
                <section>
                    <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <i class="ph-fill ph-game-controller"></i> How to Play
                    </h4>
                    <div class="space-y-3">
                        <div class="flex gap-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                            <div class="w-10 h-10 rounded-full bg-white dark:bg-amber-800 flex items-center justify-center text-xl shadow-sm flex-shrink-0">🍺</div>
                            <div>
                                <h5 class="font-bold text-amber-900 dark:text-amber-200 text-sm">1. 飲んだら記録 (蓄積)</h5>
                                <p class="text-xs text-amber-800/70 dark:text-amber-300/70 mt-1">
                                    ビールを記録すると、ホームのオーブに<strong>「未消化カロリー (液体)」</strong>が溜まっていきます。
                                </p>
                            </div>
                        </div>

                        <div class="flex gap-4 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                            <div class="w-10 h-10 rounded-full bg-white dark:bg-indigo-800 flex items-center justify-center text-xl shadow-sm flex-shrink-0">🏃</div>
                            <div>
                                <h5 class="font-bold text-indigo-900 dark:text-indigo-200 text-sm">2. 動いて燃焼 (排出)</h5>
                                <p class="text-xs text-indigo-800/70 dark:text-indigo-300/70 mt-1">
                                    運動してカロリーを消費すると、オーブの液体が減ります。<strong>「実質ゼロ (空っぽ)」</strong>を目指しましょう。
                                </p>
                            </div>
                        </div>

                        <div class="flex gap-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                            <div class="w-10 h-10 rounded-full bg-white dark:bg-emerald-800 flex items-center justify-center text-xl shadow-sm flex-shrink-0">✅</div>
                            <div>
                                <h5 class="font-bold text-emerald-900 dark:text-emerald-200 text-sm">3. コンディション管理</h5>
                                <p class="text-xs text-emerald-800/70 dark:text-emerald-300/70 mt-1">
                                    休肝日や体調を「Daily Check」で記録。ランクを上げて、健康的なビアライフを維持します。
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
ビールを記録する画面でRateが数字を入力させるようになっているのですがこれはどういう仕様ですか？星の数を選ばせる仕様が正しい気がしましたが違いますか？

ご指摘の通りです。前回のコードでは簡易的な数値入力欄（input type="number"）になっておりましたが、「星の数（5段階評価）を選択する」 形が正しい仕様（およびUXとしてあるべき姿）です。

元の仕様に合わせて、ドロップダウン（セレクトボックス）で星を選べるように修正し、ついでにメモ欄も入力しやすいエリアに変更します。

以下の2ファイルを修正してください。

1. index.html (修正)
`` の中の、Rating と `Memo` の入力部分を以下のコードに置き換えてください。

変更前 (数値入力):

HTML
<div class="flex items-center gap-2">
    <input type="number" id="beer-rating" placeholder="Rating" max="5" min="0" step="0.1" class="w-20 bg-base-50 dark:bg-base-800 border-none rounded-xl text-xs font-bold p-3">
    <input type="text" id="beer-memo" placeholder="Memo..." class="flex-1 bg-base-50 dark:bg-base-800 border-none rounded-xl text-xs font-bold p-3">
</div>
変更後 (星選択 + エリア):

HTML
                    <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-xl border border-yellow-100 dark:border-yellow-900/30 space-y-2">
                        <div class="flex items-center gap-2">
                            <label class="text-xs font-bold text-yellow-600 dark:text-yellow-500 uppercase">Rating</label>
                            <div class="relative">
                                <select id="beer-rating" class="appearance-none pl-2 pr-8 py-1 bg-white dark:bg-gray-800 border border-yellow-200 dark:border-yellow-700 rounded text-sm font-bold text-yellow-600 dark:text-yellow-500 outline-none cursor-pointer focus:ring-2 focus:ring-yellow-400">
                                    <option value="0">No Rating</option>
                                    <option value="1">★☆☆☆☆</option>
                                    <option value="2">★★☆☆☆</option>
                                    <option value="3">★★★☆☆</option>
                                    <option value="4">★★★★☆</option>
                                    <option value="5">★★★★★</option>
                                </select>
                                <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-yellow-600 dark:text-yellow-500 text-xs">▼</div>
                            </div>
                        </div>
                        <textarea id="beer-memo" rows="2" placeholder="Taste notes..." class="w-full p-2.5 bg-white dark:bg-gray-800 border border-yellow-200 dark:border-yellow-800 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none text-xs resize-none dark:text-white placeholder-gray-400"></textarea>
                    </div>
2. ui/modal.js (修正)
フォームをリセットする際、セレクトボックスの初期値を「空文字」ではなく「0 (評価なし)」に戻すように修正します。

関数: resetBeerForm

JavaScript
export const resetBeerForm = () => {
    document.getElementById('beer-date').value = getTodayString();
    document.getElementById('beer-count').value = 1;
    document.getElementById('beer-brewery').value = '';
    document.getElementById('beer-brand').value = '';
    
    // ★修正: 星の初期値を '0' に設定
    const ratingEl = document.getElementById('beer-rating');
    if(ratingEl) ratingEl.value = '0';
    
    document.getElementById('beer-memo').value = '';
    
    const untappdCheck = document.getElementById('untappd-check');
    if(untappdCheck) untappdCheck.checked = false;
};
LIVER RANKと今日のコンディションの枠の見た目が違うのと、表示されている情報の密度、雰囲気が全然違うのが気になります。

ご指摘ありがとうございます。 隣り合う2つのカード（ランクとコンディション）のデザイン言語が統一されておらず、「片方はリッチなガラス風、もう片方は古いフラットデザイン」 になっているのが違和感の原因です。

checkStatus.js を全面的に書き換え、Liver Rankカードと全く同じHTML構造・CSSクラス構成に合わせることで、情報の密度と雰囲気を統一します。

🛠️ 修正: ui/checkStatus.js
「今日のコンディション」カードも、ランクカード同様に**「大きな見出し（英語）＋詳細（日本語）」**という構成に変更し、背景アイコンやレイアウトも共通化します。

JavaScript
import { Calc } from '../logic.js';
import { DOM, escapeHtml } from './dom.js';
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

export function renderCheckStatus(checks, logs) {
    const status = DOM.elements['check-status'] || document.getElementById('check-status');
    if(!status) return;

    const today = dayjs();
    const yest = today.subtract(1, 'day');
    let targetCheck = null; let type = 'none';

    if (checks.length > 0) {
        for(let i=checks.length-1; i>=0; i--) {
            const c = checks[i];
            const checkDay = dayjs(c.timestamp);
            if (checkDay.isSame(today, 'day')) { targetCheck = c; type = 'today'; break; }
            if (checkDay.isSame(yest, 'day')) { targetCheck = c; type = 'yesterday'; break; }
        }
    }

    // テーマとテキストの決定
    let theme = {
        bg: "bg-gray-50", darkBg: "dark:bg-gray-800/50",
        text: "text-gray-800", darkText: "dark:text-white",
        icon: "text-gray-300", iconName: "ph-clipboard-text",
        accent: "bg-gray-200"
    };
    
    let label = "DAILY CHECK";
    let mainStatus = "No Record";
    let subStatus = "記録がありません";
    let bottomContent = `<span class="text-[10px] font-bold opacity-60">Tap to record</span>`;

    if (type !== 'none') {
        const { short, desc, score } = analyzeCondition(targetCheck, logs);
        
        if (type === 'today') {
            label = "TODAY'S COND.";
            // スコアに基づく色分け
            if (score >= 3) { // 好調
                theme = { 
                    bg: "bg-emerald-50", darkBg: "dark:bg-emerald-900/20",
                    text: "text-emerald-900", darkText: "dark:text-emerald-100",
                    icon: "text-emerald-500", iconName: "ph-smiley"
                };
            } else if (score >= 1) { // 普通
                theme = { 
                    bg: "bg-blue-50", darkBg: "dark:bg-blue-900/20",
                    text: "text-blue-900", darkText: "dark:text-blue-100",
                    icon: "text-blue-500", iconName: "ph-activity"
                };
            } else { // 不調
                theme = { 
                    bg: "bg-orange-50", darkBg: "dark:bg-orange-900/20",
                    text: "text-orange-900", darkText: "dark:text-orange-100",
                    icon: "text-orange-500", iconName: "ph-warning"
                };
            }
        } else {
            label = "YESTERDAY";
            theme = { 
                bg: "bg-white", darkBg: "dark:bg-gray-800",
                text: "text-gray-600", darkText: "dark:text-gray-300",
                icon: "text-gray-300", iconName: "ph-calendar-check"
            };
        }

        mainStatus = short;
        subStatus = desc;
        
        // フッター（体重表示 または Editバッジ）
        if (targetCheck.weight) {
            bottomContent = `<span class="text-[10px] font-bold font-mono bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded">${targetCheck.weight}kg</span>`;
        } else {
            bottomContent = `<span class="text-[10px] font-bold opacity-40">Edit</span>`;
        }
    }

    // HTML生成 (LiverRankと構造を完全一致させる)
    // h-full を指定し、親グリッドの高さに合わせて伸縮させる
    status.className = `glass-panel p-4 rounded-2xl relative overflow-hidden group cursor-pointer transition hover:border-opacity-50 flex flex-col justify-between h-full min-h-[130px] ${theme.bg} ${theme.darkBg}`;
    
    status.innerHTML = `
        <div class="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition transform group-hover:scale-110 duration-500">
            <i class="ph-fill ${theme.iconName} text-5xl ${theme.icon}"></i>
        </div>
        
        <div class="relative z-10 flex flex-col h-full justify-between">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-[10px] font-bold uppercase tracking-widest opacity-60 ${theme.text} ${theme.darkText}">${label}</span>
                </div>
                
                <div class="flex flex-col items-start">
                    <span class="text-3xl font-black ${theme.text} ${theme.darkText} leading-none tracking-tight truncate w-full">${mainStatus}</span>
                    <span class="text-xs font-bold opacity-80 ${theme.text} ${theme.darkText} mt-1 truncate w-full">${subStatus}</span>
                </div>
            </div>

            <div class="mt-3 flex justify-end items-end">
                <div class="${theme.text} ${theme.darkText}">
                    ${bottomContent}
                </div>
            </div>
        </div>
    `;
}

// 状態解析ロジック (短い英語タイトルと詳細を生成)
function analyzeCondition(check, logs) {
    const drank = Calc.hasAlcoholLog(logs, check.timestamp);
    let score = 0;
    if (check.waistEase) score++; 
    if (check.footLightness) score++; 
    if (check.fiberOk) score++; 
    if (check.waterOk) score++;

    // 休肝日かどうかで分岐
    if (!drank || check.isDryDay) {
        if (check.waistEase && check.footLightness) {
            return { short: "Perfect", desc: "休肝日・絶好調 ✨", score: 4 };
        }
        return { short: "Rest Day", desc: "休肝日 🍵", score: 3 };
    }

    // 飲酒日
    if (score >= 3) return { short: "Good", desc: "対策バッチリ 👍", score: 3 };
    if (score >= 1) return { short: "Average", desc: "まずまず 🙂", score: 1 };
    
    return { short: "Warning", desc: "不調気味... 😰", score: 0 };
}
v3では「untappdで検索」のチェックボックスをクリックしたうえで記録をすると、記録されたうえでUntappdが開く仕様でしたが、その仕様はなくなってしまいましたか？

ご指摘ありがとうございます。 v3にあった「保存と同時にUntappdで検索する」機能ですが、v4のデザイン刷新時にUI上（HTML上）で隠されてしまっていました（内部ロジック的には残っていました）。

v3ユーザーにとっては非常に便利なフローですので、保存ボタンの上に「Untappdで開く」オプションを復活させ、さらに動作を保証するロジックを再実装します。

以下の2ファイルを修正してください。

1. index.html (修正)
ビール記録モーダル（#beer-modal）内の、保存ボタンの直前にある隠し要素を削除し、見えるスイッチとして復活させます。

場所: `` の最後の方、保存ボタンの直上。

変更前:

HTML
<input type="checkbox" id="untappd-check" class="hidden"> 
変更後:

HTML
                    <label class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 transition">
                        <div class="flex items-center gap-2">
                            <span class="text-xl">🍻</span>
                            <span class="text-xs font-bold text-gray-600 dark:text-gray-300">Open Untappd after Save</span>
                        </div>
                        <div class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="untappd-check" class="sr-only peer">
                            <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500"></div>
                        </div>
                    </label>
2. main.js (修正)
保存イベント（save-beer）が発生した際、このチェックボックスがONならUntappdを開く処理を確実に実行するようにします。

変更箇所: document.addEventListener('save-beer', ...) の部分

JavaScript
    document.addEventListener('save-beer', async (e) => {
        const data = e.detail;
        
        // 保存処理
        await Service.saveBeerLog(data, editingLogId);
        editingLogId = null; 

        // ★追加: Untappd連携 (v3仕様の復活)
        if (data.useUntappd) {
            const query = encodeURIComponent(`${data.brewery || ''} ${data.brand || ''}`.trim());
            if(query) {
                // ポップアップブロック回避のため、少し遅延させるか、ユーザーアクション内であることを期待
                setTimeout(() => {
                    window.open(`https://untappd.com/search?q=${query}`, '_blank');
                }, 100);
            }
        }
    });
これで、記録保存時にスイッチをONにしておけば、自動的にUntappdの検索結果ページが別タブで開くようになります。

ログの編集画面で、登録してあったはずのブルワリー名、ビール名、Rating、メモがモーダル内に出てきません

原因は、ui/modal.js の openBeerModal 関数が、「新規作成モード」を想定して作られており、「編集モード（既存データの読み込み）」に対応していないため です。

編集ボタンを押した際に、既存のデータをフォームに流し込む処理を追加する必要があります。

🛠️ 修正: ui/modal.js
openBeerModal 関数を以下のように修正し、引数で log データを受け取った場合は、その内容をフォームにセットするように変更します。

JavaScript
// ui/modal.js

// ... (前略)

// ★修正: 第3引数 log (編集対象のデータ) を受け取れるように変更
export const openBeerModal = (e, dateStr = null, log = null) => {
    resetBeerForm();
    
    // 日付セット
    if (dateStr) {
        document.getElementById('beer-date').value = dateStr;
    } else if (log) {
        document.getElementById('beer-date').value = dayjs(log.timestamp).format('YYYY-MM-DD');
    }

    updateBeerSelectOptions();

    // ★追加: 編集モードの場合、データをフォームに流し込む
    if (log) {
        // 基本情報
        document.getElementById('beer-count').value = log.count || 1;
        document.getElementById('beer-brewery').value = log.brewery || '';
        document.getElementById('beer-brand').value = log.brand || log.name || ''; // nameの場合もあるのでフォールバック
        document.getElementById('beer-rating').value = log.rating || 0;
        document.getElementById('beer-memo').value = log.memo || '';
        
        // プリセットかカスタムか判定
        if (log.type === 'brew') {
            // カスタム入力だった場合
            switchBeerInputTab('custom');
            document.getElementById('custom-abv').value = log.abv || 5.0;
            document.getElementById('custom-amount').value = log.rawAmount || log.ml || 350;
        } else {
            // プリセットの場合
            switchBeerInputTab('preset');
            const styleSel = document.getElementById('beer-select');
            const sizeSel = document.getElementById('beer-size');
            
            if (log.style) styleSel.value = log.style;
            if (log.size) sizeSel.value = log.size;
        }
    }

    toggleModal('beer-modal', true);
};

// ... (後略)
2. ui/index.js (呼び出し側の確認)
ui/index.js の editLog 関数で、正しく log オブジェクトを渡しているか確認し、渡していなければ修正します。

JavaScript
// ui/index.js

// ...

    editLog: async (id) => {
        if (StateManager.isEditMode) return;

        const log = await db.logs.get(id);
        if(!log) return;
        
        if(confirm('記録を複製して編集モードに入りますか？\n(古い記録は削除されません)')) {
            if(log.type === 'beer') {
                // ★修正: 第3引数に log を渡す
                openBeerModal(null, dayjs(log.timestamp).format('YYYY-MM-DD'), log);
            } else if(log.type === 'exercise') {
                // Exercise側も同様に対応が必要なら引数を追加する (今回はBeerのみ対応)
                openManualInput(dayjs(log.timestamp).format('YYYY-MM-DD'));
            }
        }
    },

// ...
これで、編集ボタンを押した際に、記録済みの「ブルワリー名」「ビール名」「Rating」「メモ」などが正しくモーダルに表示されるようになります。

v3にあったビールの連続記録機能（保存して次へ）がなくなってしまいました。

飲み会などで連続して記録したい場合に便利な「保存して次へ」機能ですね。v3からの重要な機能ですので復活させましょう。

以下の3ステップで実装します。

HTML: 保存ボタンを「保存して閉じる」と「保存して次へ」の2つに分割します。

Modal処理: 入力フォームのリセット関数を、「日付だけ維持してリセット」できるように改良します（連続記録時は同じ日付であることが多いため）。

イベント処理: 「保存して次へ」ボタンが押された時の動作（保存→リセット→モーダル維持）を追加します。

1. ui/modal.js (修正)
resetBeerForm 関数に引数を追加し、「日付を維持するかどうか」 を制御できるようにします。

JavaScript
// ... (前略)

// ★修正: keepDate引数を追加
export const resetBeerForm = (keepDate = false) => {
    // keepDateがtrueなら、現在入力されている日付を維持する
    if (!keepDate) {
        document.getElementById('beer-date').value = getTodayString();
    }
    
    document.getElementById('beer-count').value = 1;
    document.getElementById('beer-brewery').value = '';
    document.getElementById('beer-brand').value = '';
    
    const ratingEl = document.getElementById('beer-rating');
    if(ratingEl) ratingEl.value = '0';
    
    document.getElementById('beer-memo').value = '';
    
    // Untappdチェックは連続記録時に便利なので維持しても良いが、
    // 基本はリセットとし、必要ならユーザーが再チェックする方針とする
    const untappdCheck = document.getElementById('untappd-check');
    if(untappdCheck) untappdCheck.checked = false;
};

// ... (後略)
2. ui/index.js (修正)
「保存して次へ」ボタン（btn-save-beer-next）のイベントリスナーを追加します。

JavaScript
// ... (前略)

        // 既存の「保存して閉じる」
        bind('btn-save-beer', 'click', () => {
            const data = getBeerFormData();
            const event = new CustomEvent('save-beer', { detail: data });
            document.dispatchEvent(event);
            toggleModal('beer-modal', false);
        });

        // ★追加: 「保存して次へ」
        bind('btn-save-beer-next', 'click', () => {
            const data = getBeerFormData();
            
            // 保存イベント発火
            const event = new CustomEvent('save-beer', { detail: data });
            document.dispatchEvent(event);
            
            // 完了メッセージ
            showMessage('Saved! Ready for next.', 'success');
            
            // フォームリセット (日付は維持する = true)
            resetBeerForm(true);
            
            // フォームの一番上までスクロールを戻す
            const container = document.querySelector('#beer-modal .overflow-y-auto');
            if(container) container.scrollTop = 0;
        });
        
// ... (後略)
3. index.html (修正)
`` のフッター部分（保存ボタンがある場所）を、ボタン2つ並びのレイアウトに変更します。

変更前:

HTML
            <div class="p-4 border-t border-base-100 dark:border-base-800">
                <button id="btn-save-beer" class="w-full py-4 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/30 active:scale-95 transition">
                    Save Record
                </button>
            </div>
変更後:

HTML
            <div class="p-4 border-t border-base-100 dark:border-base-800 flex gap-3">
                <button id="btn-save-beer-next" class="flex-1 py-4 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition active:scale-95">
                    Save & Next
                </button>
                <button id="btn-save-beer" class="flex-[2] py-4 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition active:scale-95">
                    Save & Close
                </button>
            </div>
これで、連続してビールを記録する際に「Save & Next」を押せば、モーダルが開いたままフォームがクリアされ（日付はそのまま）、スムーズに次の入力を開始できるようになります。

ビール名の文字数のせいでヘッダーのレイアウトがおかしくなりました。

スクリーンショットのご提供ありがとうございます。 ビール名（選択肢）が長い場合、プルダウンの幅が広がりすぎて、ロゴや他のアイコンを圧迫してしまう状態ですね。

ヘッダーのプルダウン部分に最大幅（Max Width）を設定し、長すぎる文字は「...」で省略されるように修正します。

以下の index.html を修正してください。

🛠️ index.html (ヘッダー部分のみ修正)
`` セクションを以下のコードで上書きしてください。 主な変更点は、プルダウンを囲む div に `max-w-[100px]` を追加し、`select` タグに `truncate`（文字省略）クラスを追加したことです。

HTML
    <header class="fixed top-0 w-full z-40 bg-white/80 dark:bg-base-900/80 backdrop-blur-md border-b border-base-200 dark:border-base-800 transition-colors">
        <div class="container mx-auto max-w-md h-14 flex items-center justify-between px-4">
            
            <div class="flex items-center gap-2 flex-shrink-0">
                <i class="ph-fill ph-beer-bottle text-indigo-500 text-xl"></i>
                <h1 class="text-lg font-black tracking-tight text-base-900 dark:text-white">NOMUTORE <span class="text-[10px] text-gray-400 font-normal ml-0.5">v4</span></h1>
            </div>
            
            <div class="flex items-center gap-1 flex-shrink min-w-0 ml-2">
                <div class="relative group max-w-[100px] sm:max-w-[140px]">
                    <select id="header-mode-select" class="w-full text-xs font-bold bg-transparent border-none py-1 pr-4 pl-0 text-gray-600 dark:text-gray-300 focus:ring-0 cursor-pointer outline-none text-right appearance-none truncate">
                        <option value="mode1">Lager</option>
                        <option value="mode2">Ale</option>
                    </select>
                    <div class="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-[8px]">▼</div>
                </div>

                <div class="w-px h-3 bg-gray-300 dark:bg-gray-700 mx-2 flex-shrink-0"></div>

                <button onclick="UI.openHelp()" class="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition flex-shrink-0">
                    <i class="ph-bold ph-question text-lg"></i>
                </button>

                <button onclick="UI.toggleTheme()" class="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-yellow-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition flex-shrink-0">
                    <i class="ph-fill ph-moon-stars text-lg"></i>
                </button>
            </div>
        </div>
    </header>
①各タブの見出しのサイズやレイアウトがバラバラで統一感がありません。

②Recordタブの上部が大きくあいています

ご指摘ありがとうございます。 Recordタブの過剰な余白（pt-8など）を取り除き、CellarやSettingsも含めて**「見出しのデザイン（フォントサイズ・余白）」を完全に統一**します。

index.html 内の `` の3つのセクション（Record, Cellar, Settings）を、以下のコードに書き換えてください。

🛠️ index.html 修正（タブごとの見出し統一）
すべてのタブで text-2xl font-black px-2 mb-4 というスタイルを共通化し、開始位置を揃えました。

1. Recordタブ (余白削除・見出し統一)
tab-record の中身を丸ごと入れ替えてください。

HTML
        <div id="tab-record" class="tab-content pb-24 hidden">
            <div class="flex items-center justify-between px-2 mb-4">
                <h2 class="text-2xl font-black text-base-900 dark:text-white tracking-tight">Record</h2>
                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg">Action Center</span>
            </div>

            <section class="mb-6 px-1">
                <h3 class="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider ml-1">Quick Log</h3>
                <div class="grid grid-cols-2 gap-3">
                    <button onclick="UI.openBeerModal()" class="group relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/20 text-left transition transform hover:scale-[1.02] active:scale-95">
                        <div class="relative z-10 flex flex-col h-full justify-between gap-1">
                            <i class="ph-fill ph-beer-bottle text-2xl text-white"></i>
                            <div>
                                <p class="text-[10px] font-bold text-white/80 uppercase">Drink</p>
                                <p class="text-base font-black text-white">ビール記録</p>
                            </div>
                        </div>
                        <div class="absolute -right-2 -bottom-2 text-white/10 rotate-12">
                            <i class="ph-fill ph-beer-stein text-6xl"></i>
                        </div>
                    </button>

                    <button onclick="UI.openCheckModal()" class="group relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-base-800 border border-gray-200 dark:border-gray-700 shadow-sm text-left transition transform hover:scale-[1.02] active:scale-95">
                        <div class="relative z-10 flex flex-col h-full justify-between gap-1">
                            <i class="ph-fill ph-heartbeat text-2xl text-emerald-500"></i>
                            <div>
                                <p class="text-[10px] font-bold text-gray-400 uppercase">Health</p>
                                <p class="text-base font-black text-base-900 dark:text-white">健康チェック</p>
                            </div>
                        </div>
                    </button>
                </div>
            </section>

            <section class="mb-6 px-1">
                <h3 class="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider ml-1">Workout Timer</h3>
                
                <button onclick="UI.openTimer()" class="w-full group relative overflow-hidden rounded-3xl p-5 bg-base-900 dark:bg-white text-left shadow-xl transition-transform active:scale-95">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/50 transition duration-500"></div>
                    <div class="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/30 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/50 transition duration-500"></div>
                    
                    <div class="relative z-10 flex items-center justify-between">
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                <span class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Immersive Mode</span>
                            </div>
                            <h3 class="text-xl font-black text-white dark:text-base-900">Start Workout</h3>
                            <p class="text-[10px] font-bold text-gray-400 group-hover:text-gray-300 dark:group-hover:text-gray-600 transition">
                                Live tracking & Beer conversion
                            </p>
                        </div>
                        
                        <div class="w-10 h-10 rounded-full bg-white/10 dark:bg-base-900/10 flex items-center justify-center border border-white/20 dark:border-base-900/20 group-hover:scale-110 transition duration-300">
                            <i class="ph-fill ph-play text-xl text-white dark:text-base-900 ml-0.5"></i>
                        </div>
                    </div>
                </button>
            </section>

            <section class="px-1">
                <div class="glass-panel p-5 rounded-3xl">
                    <h3 class="text-sm font-bold text-base-900 dark:text-white mb-4 flex items-center gap-2">
                        <i class="ph-fill ph-pencil-simple text-indigo-500"></i>
                        Manual Entry
                    </h3>
                    
                    <div class="space-y-4">
                        <div class="grid grid-cols-5 gap-3">
                            <div class="col-span-3">
                                <label class="text-[10px] font-bold text-gray-400 uppercase ml-1">Date</label>
                                <input type="date" id="manual-date" class="w-full bg-base-50 dark:bg-base-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-base-900 dark:text-white focus:outline-none focus:border-indigo-500">
                            </div>
                            <div class="col-span-2">
                                <label class="text-[10px] font-bold text-gray-400 uppercase ml-1">Mins</label>
                                <input type="number" id="manual-minutes" placeholder="30" class="w-full bg-base-50 dark:bg-base-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-base-900 dark:text-white focus:outline-none focus:border-indigo-500">
                            </div>
                        </div>

                        <div>
                            <label class="text-[10px] font-bold text-gray-400 uppercase ml-1">Activity</label>
                            <div class="relative">
                                <select id="exercise-select" class="w-full bg-base-50 dark:bg-base-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-base-900 dark:text-white focus:outline-none focus:border-indigo-500 appearance-none">
                                    </select>
                                <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                    <i class="ph-bold ph-caret-down"></i>
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 py-1">
                            <input type="checkbox" id="manual-bonus" class="w-4 h-4 rounded text-indigo-600 bg-gray-100 border-gray-300 focus:ring-indigo-500" checked>
                            <label for="manual-bonus" class="text-xs text-gray-500 dark:text-gray-400 select-none">Apply Streak Bonus</label>
                        </div>

                        <button id="btn-save-exercise" class="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 transition active:scale-95">
                            Log Workout
                        </button>
                    </div>
                </div>
            </section>
        </div>
2. Cellarタブ (見出しスタイル統一)
tab-cellar の中身を入れ替えます。

HTML
        <div id="tab-cellar" class="tab-content space-y-4 hidden">
             <div class="flex items-center justify-between px-2 mb-2">
                <h2 class="text-2xl font-black text-base-900 dark:text-white tracking-tight">Cellar</h2>
                <div class="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    <button id="btn-cellar-logs" onclick="UI.switchCellarViewHTML('logs')" class="px-3 py-1.5 text-[10px] font-bold rounded-md transition-all">Logs</button>
                    <button id="btn-cellar-stats" onclick="UI.switchCellarViewHTML('stats')" class="px-3 py-1.5 text-[10px] font-bold rounded-md transition-all text-gray-500">Stats</button>
                    <button id="btn-cellar-archives" onclick="UI.switchCellarViewHTML('archives')" class="px-3 py-1.5 text-[10px] font-bold rounded-md transition-all text-gray-500">Archives</button>
                </div>
             </div>

             <div id="view-cellar-logs" class="space-y-3 pb-24">
                 <div class="flex justify-between items-center px-2 mb-2">
                     <span id="history-base-label" class="text-xs font-bold text-gray-400 uppercase tracking-wide">All Records</span>
                     <button id="btn-select-all" onclick="UI.toggleSelectAll()" class="hidden text-xs text-indigo-500 font-bold">Select All</button>
                 </div>
                 
                 <div id="edit-toolbar" class="hidden sticky top-16 z-30 bg-white/90 dark:bg-base-900/90 backdrop-blur p-2 rounded-xl shadow-lg border border-indigo-100 dark:border-indigo-900 mb-2 flex justify-between items-center">
                     <span class="text-xs font-bold ml-2"><span id="bulk-selected-count">0</span> items</span>
                     <button onclick="document.dispatchEvent(new Event('bulk-delete'))" class="bg-red-50 text-red-500 px-3 py-1.5 rounded-lg text-xs font-bold">Delete</button>
                 </div>

                 <ul id="log-list" class="space-y-3 px-1"></ul>
                 <div id="edit-spacer" class="h-16 hidden"></div>
             </div>

             <div id="view-cellar-stats" class="hidden pb-24 px-1">
                 <div class="flex items-center justify-center h-40">
                     <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                 </div>
             </div>

             <div id="view-cellar-archives" class="hidden pb-24 px-1"></div>
        </div>
3. Settingsタブ (見出し追加)
tab-settings の中身を入れ替えます（「Settings」という見出しを追加）。

HTML
        <div id="tab-settings" class="tab-content pb-24 hidden">
            <div class="flex items-center justify-between px-2 mb-4">
                <h2 class="text-2xl font-black text-base-900 dark:text-white tracking-tight">Settings</h2>
            </div>

            <div class="glass-panel p-6 rounded-3xl mb-4">
                <h2 class="text-lg font-black mb-4 flex items-center gap-2">
                    <i class="ph-fill ph-user-circle text-indigo-500"></i>
                    Profile & Goals
                </h2>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">Weight (kg)</label>
                        <input type="number" id="weight-input" class="w-full bg-base-50 dark:bg-base-900 border-0 rounded-xl p-3 font-bold text-sm" placeholder="60">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">Height (cm)</label>
                        <input type="number" id="height-input" class="w-full bg-base-50 dark:bg-base-900 border-0 rounded-xl p-3 font-bold text-sm" placeholder="170">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">Age</label>
                        <input type="number" id="age-input" class="w-full bg-base-50 dark:bg-base-900 border-0 rounded-xl p-3 font-bold text-sm" placeholder="30">
                    </div>
                    <div>
                        <label class="text-xs font-bold text-gray-500 mb-1 block">Gender</label>
                        <select id="gender-input" class="w-full bg-base-50 dark:bg-base-900 border-0 rounded-xl p-3 font-bold text-sm">
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                        </select>
                    </div>
                </div>
                
                <div class="mb-2">
                    <label class="text-xs font-bold text-gray-500 mb-1 block">Period Mode</label>
                    <select id="setting-period-mode" class="w-full bg-base-50 dark:bg-base-900 border-0 rounded-xl p-3 font-bold mb-1 text-sm">
                        <option value="weekly">Weekly (Reset on Mon)</option>
                        <option value="monthly">Monthly (Reset on 1st)</option>
                        <option value="permanent">Permanent (Endless)</option>
                    </select>
                </div>
            </div>

            <div class="glass-panel p-6 rounded-3xl mb-4">
                <h2 class="text-lg font-black mb-4 flex items-center gap-2">
                    <i class="ph-fill ph-gear text-gray-500"></i>
                    Preferences
                </h2>
                
                <div class="mb-4">
                    <label class="text-xs font-bold text-gray-500 mb-1 block">Theme</label>
                    <select id="theme-input" class="w-full bg-base-50 dark:bg-base-900 border-0 rounded-xl p-3 font-bold text-sm">
                        <option value="system">System Default</option>
                        <option value="light">Light Mode</option>
                        <option value="dark">Dark Mode</option>
                    </select>
                </div>

                <div class="mb-4">
                    <label class="text-xs font-bold text-gray-500 mb-1 block">Favorite Beer 1</label>
                    <select id="setting-mode-1" class="w-full bg-base-50 dark:bg-base-900 border-0 rounded-xl p-3 font-bold text-sm"></select>
                </div>
                
                <div class="mb-4">
                    <label class="text-xs font-bold text-gray-500 mb-1 block">Favorite Beer 2</label>
                    <select id="setting-mode-2" class="w-full bg-base-50 dark:bg-base-900 border-0 rounded-xl p-3 font-bold text-sm"></select>
                </div>

                <div class="mb-4">
                    <label class="text-xs font-bold text-gray-500 mb-1 block">Base Exercise</label>
                    <select id="setting-base-exercise" class="w-full bg-base-50 dark:bg-base-900 border-0 rounded-xl p-3 font-bold text-sm"></select>
                </div>
                
                 <div class="mb-2">
                    <label class="text-xs font-bold text-gray-500 mb-1 block">Default Record Exercise</label>
                    <select id="setting-default-record-exercise" class="w-full bg-base-50 dark:bg-base-900 border-0 rounded-xl p-3 font-bold text-sm"></select>
                </div>
            </div>

            <div class="glass-panel p-6 rounded-3xl mb-4">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-lg font-black flex items-center gap-2">
                        <i class="ph-fill ph-check-square-offset text-emerald-500"></i>
                        Daily Checks
                    </h2>
                    <button onclick="addNewCheckItem()" class="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-200 transition">
                        + Add Custom
                    </button>
                </div>
                <div id="check-editor-list">
                    </div>
            </div>

            <div class="glass-panel p-6 rounded-3xl mb-4">
                <h2 class="text-lg font-black mb-4 text-red-500 flex items-center gap-2">
                    <i class="ph-fill ph-warning-circle"></i>
                    Data Management
                </h2>
                <button onclick="DataManager.exportCSV('logs')" class="w-full mb-3 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 font-bold text-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                    Export Logs (CSV)
                </button>
                
                <button onclick="DataManager.exportJSON()" class="w-full mb-3 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 font-bold text-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                    Export Backup (JSON)
                </button>

                <div class="relative">
                    <input type="file" id="import-file" class="hidden" onchange="DataManager.importJSON(this)">
                    <button onclick="document.getElementById('import-file').click()" class="w-full py-3 rounded-xl bg-gray-100 dark:bg-gray-800 font-bold text-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                        Import Backup (JSON)
                    </button>
                </div>
            </div>

            <div class="glass-panel p-6 rounded-3xl mb-4">
                <h2 class="text-lg font-black mb-4 flex items-center gap-2">
                    <i class="ph-fill ph-info text-indigo-500"></i>
                    About
                </h2>
                <button onclick="UI.openHelp()" class="w-full flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800 rounded-xl group transition hover:bg-gray-200 dark:hover:bg-gray-700">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center shadow-sm">
                            <i class="ph-fill ph-book-open text-indigo-500"></i>
                        </div>
                        <div class="text-left">
                            <span class="block text-[10px] font-bold text-gray-500 dark:text-gray-400">How to use</span>
                            <span class="block text-sm font-black text-base-900 dark:text-white">User Guide</span>
                        </div>
                    </div>
                    <i class="ph-bold ph-caret-right text-gray-400 group-hover:text-indigo-500 transition"></i>
                </button>
                <div class="mt-4 text-center">
                    <p class="text-[10px] font-bold text-gray-300 dark:text-gray-600">Nomutore v4.0.0</p>
                </div>
            </div>
            
            <div class="fixed bottom-24 left-0 right-0 px-6 z-50">
                <div class="max-w-md mx-auto">
                    <button id="btn-save-settings" class="w-full py-4 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg hover:bg-indigo-700 transition transform active:scale-95">
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
①ログ編集が、実質的にはコピー機能になっているのはなぜですか？元の記録を編集できるようにはできませんか？

②セッティングで基準ビールを編集したあとホームに戻っても、プルダウンのビールが更新されません（再読み込みすると変わります）

③ログでビアスタイルとコメントが表示されますが、コメントではなくビールの銘柄が出るようにしたいです

ご指摘ありがとうございます。 使い勝手を向上させるため、以下の3点を修正します。

ログ編集のロジック変更: 「複製」ではなく、IDを指定した「上書き（更新）」に変更します。

設定反映の即時化: 設定保存時に、ヘッダーのプルダウンの表示名を強制的に書き換える処理を追加します。

リスト表示の改善: ログ一覧で「コメント」の代わりに「銘柄（Brand）」を優先表示するようにします。

以下の4ファイルを修正してください。

1. index.html (修正)
ビール記録モーダルの中に、編集対象のIDを保持するための 隠しフィールド（Hidden Input） を追加します。

場所: `` の内部、div class="p-5 overflow-y-auto space-y-4" の冒頭あたりに追加。

HTML
            <div class="p-5 overflow-y-auto space-y-4">
                <input type="hidden" id="editing-log-id" value="">

                <div class="grid grid-cols-2 gap-4">
                    ```

---

### 2. `ui/modal.js` (修正)
① 編集モード時にIDを隠しフィールドにセットする処理
② 設定保存時にヘッダーを即時更新する処理
③ フォームリセット時にIDをクリアする処理
を追加します。

```javascript
import { EXERCISE, CALORIES, SIZE_DATA, STYLE_METADATA, APP, CHECK_SCHEMA } from '../constants.js';
import { Calc } from '../logic.js';
import { Store, db } from '../store.js';
import { StateManager } from './state.js';
import { DOM, toggleModal, escapeHtml, toggleDryDay, showMessage } from './dom.js';
import { Service } from '../service.js';
import { Timer } from './timer.js'; 
import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm';

// ... (他関数は省略) ...

export const resetBeerForm = (keepDate = false) => {
    if (!keepDate) {
        document.getElementById('beer-date').value = dayjs().format('YYYY-MM-DD');
    }
    
    // ★追加: 編集IDをリセット
    const idField = document.getElementById('editing-log-id');
    if(idField) idField.value = '';

    document.getElementById('beer-count').value = 1;
    document.getElementById('beer-brewery').value = '';
    document.getElementById('beer-brand').value = '';
    
    const ratingEl = document.getElementById('beer-rating');
    if(ratingEl) ratingEl.value = '0';
    
    document.getElementById('beer-memo').value = '';
    
    const untappdCheck = document.getElementById('untappd-check');
    if(untappdCheck) untappdCheck.checked = false;
};

// ... (getBeerFormDataは変更なし。ただしmain.jsでIDを取得するためHTML側にinputがあればOK) ...

export const openBeerModal = (e, dateStr = null, log = null) => {
    resetBeerForm();
    
    if (dateStr) {
        document.getElementById('beer-date').value = dateStr;
    } else if (log) {
        document.getElementById('beer-date').value = dayjs(log.timestamp).format('YYYY-MM-DD');
    }

    updateBeerSelectOptions();

    if (log) {
        // ★追加: 編集対象のIDをセット
        const idField = document.getElementById('editing-log-id');
        if(idField) idField.value = log.id;

        document.getElementById('beer-count').value = log.count || 1;
        document.getElementById('beer-brewery').value = log.brewery || '';
        document.getElementById('beer-brand').value = log.brand || log.name || ''; 
        document.getElementById('beer-rating').value = log.rating || 0;
        document.getElementById('beer-memo').value = log.memo || '';
        
        if (log.type === 'brew') {
            switchBeerInputTab('custom');
            document.getElementById('custom-abv').value = log.abv || 5.0;
            document.getElementById('custom-amount').value = log.rawAmount || log.ml || 350;
        } else {
            switchBeerInputTab('preset');
            const styleSel = document.getElementById('beer-select');
            const sizeSel = document.getElementById('beer-size');
            if (log.style) styleSel.value = log.style;
            if (log.size) sizeSel.value = log.size;
        }
    }

    toggleModal('beer-modal', true);
};

export const handleSaveSettings = async () => {
    const btn = document.getElementById('btn-save-settings');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const periodSel = document.getElementById('setting-period-mode');
        const newMode = periodSel ? periodSel.value : 'weekly';
        await Service.updatePeriodSettings(newMode);

        const w = document.getElementById('weight-input').value;
        const h = document.getElementById('height-input').value;
        const a = document.getElementById('age-input').value;
        const g = document.getElementById('gender-input').value;
        
        if(w) localStorage.setItem(APP.STORAGE_KEYS.WEIGHT, w);
        if(h) localStorage.setItem(APP.STORAGE_KEYS.HEIGHT, h);
        if(a) localStorage.setItem(APP.STORAGE_KEYS.AGE, a);
        if(g) localStorage.setItem(APP.STORAGE_KEYS.GENDER, g);

        const m1 = document.getElementById('setting-mode-1').value;
        const m2 = document.getElementById('setting-mode-2').value;
        const base = document.getElementById('setting-base-exercise').value;
        const defRec = document.getElementById('setting-default-record-exercise').value;

        localStorage.setItem(APP.STORAGE_KEYS.MODE1, m1);
        localStorage.setItem(APP.STORAGE_KEYS.MODE2, m2);
        localStorage.setItem(APP.STORAGE_KEYS.BASE_EXERCISE, base);
        localStorage.setItem(APP.STORAGE_KEYS.DEFAULT_RECORD_EXERCISE, defRec);
        
        const theme = document.getElementById('theme-input').value;
        localStorage.setItem(APP.STORAGE_KEYS.THEME, theme);

        // ★追加: ヘッダーのプルダウン表示を即時更新
        const headerSel = document.getElementById('header-mode-select');
        if(headerSel) {
            headerSel.options[0].text = m1;
            headerSel.options[1].text = m2;
        }

        showMessage('設定を保存しました', 'success');
        document.dispatchEvent(new CustomEvent('refresh-ui'));

    } catch(e) {
        console.error(e);
        showMessage('設定保存中にエラーが発生しました', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
};

// ... (他関数は省略) ...
3. main.js (修正)
save-beer イベント内で、IDが存在する場合は update、存在しない場合は add を行うように分岐させます。

JavaScript
// ... (前略) ...

    document.addEventListener('save-beer', async (e) => {
        const data = e.detail;
        
        // ★修正: 編集IDを取得
        const idField = document.getElementById('editing-log-id');
        const existingId = idField && idField.value ? parseInt(idField.value) : null;

        if (existingId) {
            // IDがある場合 = 更新 (Update)
            // Serviceにupdateメソッドがない場合はdbを直接使うか、Serviceに追加する
            // ここではdbを直接使って更新します
            await db.logs.update(existingId, data);
            
            // 元のeditingLogIdロジックは不要になるのでnullへ
            editingLogId = null;
            
            // UI側にメッセージ
            UI.showMessage('Record Updated', 'success');
        } else {
            // IDがない場合 = 新規作成 (Add)
            await Service.saveBeerLog(data);
        }

        // Untappd連携
        if (data.useUntappd) {
            const query = encodeURIComponent(`${data.brewery || ''} ${data.brand || ''}`.trim());
            if(query) {
                setTimeout(() => {
                    window.open(`https://untappd.com/search?q=${query}`, '_blank');
                }, 100);
            }
        }
        
        // リフレッシュ
        await refreshUI();
    });

// ... (後略) ...
4. ui/logList.js (修正)
ログリストの表示内容を変更します。 「メモ」ではなく「ブルワリー名 + 銘柄名」を表示し、メモはツールチップや詳細表示に回します（今回はシンプルに非表示にします）。

JavaScript
// ... (前略) ...

export const updateLogListView = async (forceRefresh = true) => {
    const listEl = document.getElementById('log-list');
    if (!listEl) return;

    const allLogs = await db.logs.orderBy('timestamp').reverse().limit(50).toArray();

    listEl.innerHTML = '';

    if (allLogs.length === 0) {
        listEl.innerHTML = `<li class="text-center text-gray-400 py-8 text-xs">No records found.</li>`;
        return;
    }

    let currentDateStr = '';

    allLogs.forEach(log => {
        const dateStr = dayjs(log.timestamp).format('YYYY-MM-DD (ddd)');
        
        if (dateStr !== currentDateStr) {
            const header = document.createElement('li');
            header.className = "text-xs font-bold text-gray-400 mt-4 mb-2 pl-2 border-l-2 border-indigo-200 dark:border-indigo-800";
            header.textContent = dateStr;
            listEl.appendChild(header);
            currentDateStr = dateStr;
        }

        const li = document.createElement('li');
        li.className = "relative group bg-white dark:bg-base-800 rounded-xl p-3 shadow-sm flex items-center gap-3 transition-all active:scale-[0.99]";
        
        let icon = '🍺';
        let colorClass = 'bg-yellow-100 text-yellow-600';
        
        // ★修正: 表示テキストのロジック変更
        let mainText = '';
        let subText = '';

        if (log.type === 'exercise') {
            const ex = EXERCISE[log.exerciseKey];
            icon = ex ? ex.icon : '🏃';
            colorClass = 'bg-indigo-100 text-indigo-600';
            mainText = log.name; // 運動名
            subText = `${log.minutes} min (${Math.round(log.kcal)} kcal)`;
        } else if (log.type === 'beer') {
            const size = log.size || 350;
            const count = log.count || 1;
            
            // ★変更: 銘柄(Brand)があればそれを優先、なければName(Style)
            // ブルワリーがあるなら「Brewery - Brand」の形式に
            if (log.brand) {
                mainText = log.brewery ? `${log.brewery} ${log.brand}` : log.brand;
            } else {
                mainText = log.name; // Style名が入っていることが多い
            }

            // サブテキストにスタイル名とカロリーを入れる
            const styleInfo = log.brand ? `(${log.style || log.name})` : ''; 
            subText = `${styleInfo} ${size}ml x ${count} / ${Math.round(Math.abs(log.kcal))} kcal`;
        }

        li.innerHTML = `
            <div class="${isEditMode ? 'block' : 'hidden'} mr-2">
                <input type="checkbox" class="log-checkbox w-5 h-5 accent-indigo-600" data-id="${log.id}" onchange="UI.updateBulkCount()">
            </div>

            <div class="w-10 h-10 rounded-full ${colorClass} flex items-center justify-center text-lg shrink-0">
                ${icon}
            </div>

            <div class="flex-1 min-w-0" onclick="UI.editLog(${log.id})">
                <div class="flex justify-between items-baseline">
                    <h4 class="text-sm font-bold text-base-900 dark:text-gray-100 truncate">${escapeHtml(mainText)}</h4>
                    <span class="text-xs font-mono text-gray-400 ml-2">${dayjs(log.timestamp).format('HH:mm')}</span>
                </div>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 truncate">${subText}</p>
                ${log.memo ? `<p class="text-[9px] text-gray-400 mt-0.5 truncate opacity-70">📝 ${escapeHtml(log.memo)}</p>` : ''}
            </div>

            <button onclick="UI.deleteLog(${log.id})" class="${isEditMode ? 'hidden' : 'block'} w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 transition z-10">
                <i class="ph-bold ph-trash"></i>
            </button>
        `;

        listEl.appendChild(li);
    });
};
ビール登録と運動登録をしたら、休肝日でないのにホームの健康チェック欄が休肝日表示になりました

ご報告ありがとうございます。 これは ui/checkStatus.js 内の判定ロジックのミスです。

現状のコードでは「ビールを飲んでいない または(OR) 休肝日チェックがついている」場合に「休肝日」と判定してしまっていました。 そのため、ビールを記録（drank = true）していても、健康チェック側のフラグが残っていると、休肝日表示が優先されてしまっています。

正しくは「ビールを飲んでいない かつ(AND) 休肝日チェックがついている」場合のみ休肝日表示にするべきです。

以下の修正を行ってください。

🛠️ ui/checkStatus.js (修正)
末尾にある analyzeCondition 関数内の if 文の条件を、|| から && に変更します。

JavaScript
// ... (前略)

// 状態解析ロジック (短い英語タイトルと詳細を生成)
function analyzeCondition(check, logs) {
    const drank = Calc.hasAlcoholLog(logs, check.timestamp);
    let score = 0;
    if (check.waistEase) score++; 
    if (check.footLightness) score++; 
    if (check.fiberOk) score++; 
    if (check.waterOk) score++;

    // ★修正: 休肝日判定のロジック
    // 誤: if (!drank || check.isDryDay)  <-- これだと「飲んだけどチェックがON」の時に休肝日になってしまう
    // 正: if (!drank && check.isDryDay)  <-- 「飲んでない」かつ「チェックON」のみ休肝日とする
    
    if (!drank && check.isDryDay) {
        if (check.waistEase && check.footLightness) {
            return { short: "Perfect", desc: "休肝日・絶好調 ✨", score: 4 };
        }
        return { short: "Rest Day", desc: "休肝日 🍵", score: 3 };
    }

    // 飲酒日 (または休肝日チェックOFFの日)
    if (score >= 3) return { short: "Good", desc: "対策バッチリ 👍", score: 3 };
    if (score >= 1) return { short: "Average", desc: "まずまず 🙂", score: 1 };
    
    return { short: "Warning", desc: "不調気味... 😰", score: 0 };
}
