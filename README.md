# 🧱🍉 Magic Fruit Splash Breaker

一款網頁版、可愛主題的親子打磚塊遊戲。滑動底部擋板，讓球彈起打掉上方的磚塊、水球與水果，清光整面即過關。共 5 關，雙模式，PWA 可加入主畫面、可離線玩。

## 🎮 玩法

- **手機 / 平板**：手指在螢幕下方左右滑動移動擋板，點一下發射球。
- **電腦**：滑鼠移動，或鍵盤 `←` / `→`、`A` / `D`。
- **發射**：`Space` 或 `Enter`，或直接點/觸螢幕。
- **暫停**：左上角的 ⏸ 按鈕，或按 `Esc` / `P`。
- **靜音**：右上角的喇叭按鈕（設定會記住）。

## ✨ 特色

- 三種目標：🧱 磚塊（1 下破）、💧 水球（1 下破有水花）、🍉 水果（西瓜／草莓／橘子，2 下破有裂痕）。
- 雙模式：
  - 🌈 **輕鬆模式**：球掉下去會自動重生，沒有失敗壓力。
  - ⭐ **挑戰模式**：5 顆愛心，掉光遊戲結束。
- 5 個關卡：從整齊磚牆到笑臉、果園、再到愛心大魔王。
- PWA：可「加到主畫面」全螢幕開啟、可離線。
- 純前端，無後端、無追蹤、無廣告。

## 🗂️ 專案結構

```
Magic-fruit-splash-breaker/
├── index.html              ← 入口
├── style.css               ← 介面樣式
├── manifest.json           ← PWA 設定
├── service-worker.js       ← 離線快取
├── js/
│   └── game.js             ← 遊戲主邏輯（純 Canvas + JS）
├── assets/
│   └── icons/
│       ├── icon.svg            ← 向量原圖
│       ├── icon-192.png        ← PWA 圖示
│       ├── icon-512.png        ← PWA 圖示
│       └── icon-maskable-512.png ← Android 可變形圖示
├── 打磚塊遊戲設計藍圖.md     ← 原始設計藍圖
└── README.md
```

## 🚀 部署到 GitHub Pages

1. 在 GitHub 建立名為 `Magic-fruit-splash-breaker` 的 **Public** 儲存庫。
2. 在這個資料夾初始化 git 並 push 上去：
   ```powershell
   git init
   git add .
   git commit -m "Initial commit: Magic Fruit Splash Breaker"
   git branch -M main
   git remote add origin https://github.com/<你的帳號>/Magic-fruit-splash-breaker.git
   git push -u origin main
   ```
3. 進儲存庫的 `Settings → Pages`，Source 選 `main` 分支、`/root`，按 Save。
4. 等一兩分鐘，遊戲就會上線在：
   `https://<你的帳號>.github.io/Magic-fruit-splash-breaker/`
5. 用手機 Chrome／Safari 開啟，選單裡選「加到主畫面」，圖示會像 App 一樣出現。

> ⚠️ 因為 GitHub Pages 的網址帶有 `/Magic-fruit-splash-breaker/` 子目錄，所有資源都用相對路徑（`./...`），可以直接運作不需要設 `base`。

## 🛠️ 本機開發

直接打開 `index.html` 多數功能都能用，但 **PWA 的 service worker 需要 HTTP 環境** 才會註冊成功。最簡單的方式：

```powershell
# Python 3
python -m http.server 8080
# 或 Node
npx serve .
```

然後開 `http://localhost:8080`。

## 🎨 美術與音效

- **圖示**：本專案附的 `icon.svg` / `icon-*.png` 由 `assets/icons/` 內建，使用 .NET System.Drawing 程式繪製。
- **音效**：完全由 Web Audio API 即時合成（不需任何外部素材檔），所以遊戲離線也有聲音。
  - 球碰擋板／牆：短促三角波。
  - 磚塊破：方波叮叮聲。
  - 水球破：濾波白噪音的「啪嚓」水花聲。
  - 水果破：噪音 + 鋸齒波的「噗滋」噴汁聲。
  - 過關：上行四音音階。

> 因為素材都是內建生成的，沒有第三方授權問題（CC0 等同），可以自由修改、發布。

## 📜 授權

本遊戲程式碼以 **MIT** 釋出，內附素材（程式生成的圖示、Web Audio 合成的音效）視同 **CC0**。

設計藍圖請見 `打磚塊遊戲設計藍圖.md`。

---

祝玩得愉快！🎮🍉💧
