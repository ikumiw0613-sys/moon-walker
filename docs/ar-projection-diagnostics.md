# AR表示側の切り分け

## 現時点で確認できたこと

- Debug の従来プレビューは、方位差±45°、高度差±30°を x/y の0〜100%へ**線形**に写す。
- 本番ARは `moonWorld → correctedRotation → moonInDevice → projectMoonToScreen → MoonSprite`。透視投影で、端末のrollも反映する。月・姿勢が同じでも、中心から離れれば2Dと3Dの位置は一致しない。例として方位差22.5°・高度差0°・rollなしでは、2Dのx=75%、3Dのx≈70.71%となる。
- `projectMoonToScreen()` はwindowやDOMを参照しない。出力は投影面内の0〜1座標であり、「必ず画面全体を意味する」という前提は実装にはない。投影面とFOVの物理的な対応は描画側が決める。
- `.mw-ar` はsafe-area込みpadding、ヘッダー、gap、案内欄を持つgrid。`.mw-ar-viewport` はその中の一部を占める。その中心・サイズはwindow全体と異なり得る。
- 固定 FOV 90° / 60° は `tan(45°) / tan(30°) = √3 ≈ 1.732` の縦横比を想定する。同一焦点距離の透視投影として整合するのは、描画領域もこの比率の場合。実viewportの比率は端末・案内欄の折返し・safe-area等で変わるため、実測が必要。
- 現在のCSSではviewportは `position: relative`、月は `position: absolute` と `translate(-50%, -50%)`。translateは46pxの月の左上を中心に合わせる正しい処理。アプリの実際の祖先にはtransformは見つからず、雲のtransform・hazeのfilterは兄弟側にあり、月のpositioning contextを変えない。`isolation: isolate` や `position: relative` だけでもfixedの基準は変わらない。
- **固定日時モードでは別のCSS要因がある。** `.mw-ar` は `auto minmax(200px, 1fr) auto` の3行定義だが、headerとviewportの間に日時ラベルが追加される。自動配置のためラベルが2行目、viewportが3行目、案内が暗黙の4行目に入る。viewportの子はabsolute要素なので、その高さが潰れる可能性がある。今回は修正せず、各grid itemの実測rectと高さ0の警告を追加した。

以上から、優先して調べる対象は **viewportの中心・サイズとFOVの対応**。固定日時使用時にはgridの行割当も優先する。実際の10°以上のズレの原因が確定した、またはセンサーを原因から除外できた、とはまだ言えない。

## 起動と切替

本番URL: https://moon-walker.vercel.app/ar?arDebug=projection

AR投影診断は `arDebug=projection` の完全一致だけで有効になる。`import.meta.env.DEV` や `VITE_ENABLE_DEBUG` は不要。別画面の `/debug` に対する環境条件は引き続き独立している。
直接開いた直後は従来どおり校正が必要。「準備する」から校正へ進み、完了後にARへ戻る際も、ARと校正画面の往復に限って診断queryを引き継ぐ。ホーム・月の情報へ移ると引き継がない。URLからqueryを外した場合も診断は終了する。校正の条件・保存処理には変更を加えない。
Vercelでは既知のSPAルートを `vercel.json` から `/index.html` へrewriteする。リダイレクトではないため、`/ar` のパスとqueryを維持してReactのルーティングへ渡す。静的assetsやAPIを巻き込む全パスrewriteは使用しない。

本番成果物の確認: `npm run build` 後に `node scripts/verify-ar-production.mjs`。配信中のHTTP応答とJS entryを含める場合は `node scripts/verify-ar-production.mjs https://moon-walker.vercel.app`。JSの実行はJSDOMによるもので、端末のレイアウトやセンサーの実測を代替しない。

通常の `/ar` は既存の配置・FOV・表示条件のまま。計測用observerやパネルも起動しない。

- `/ar?arDebug=projection`: 本番と同じviewport配置から診断開始。
- `/ar?arDebug=projection&arProjection=full-screen`: 全画面配置から診断開始。

クエリはAR画面のマウント時に読む。比較は再読み込みせず、パネルの **viewport projection / full-screen projection** を切り替える。再読み込みすると既存仕様どおり北補正が消えるため、比較の途中では行わない。

詳細診断は最初は閉じており、ヘッダーの下の右上に「Direction error」と「投影診断を開く」ボタンを表示する。Direction errorは詳細パネルの開閉にかかわらず常時表示する。パネルの空白部分はタップを受け取らず、下側の準備・現在地・校正ボタンを操作できる。開いた後も、スクロール領域の外に常にある「診断を閉じる」で最小化できる。Escapeでも閉じられ、配置・FOVなどの選択は維持する。
パネルはbodyにportalしたfixed overlayで、ARのgridに行を追加しない。

全画面モードでは本物のMoonSpriteをbodyへportalし、`position: fixed` と `left = screenX * innerWidth px`、`top = screenY * innerHeight px` を使う。これはモバイルでのvhとinnerHeightの違いを避け、計測に使ったwindowサイズへ直接対応させるため。アプリ祖先のtransformにも影響されない。body/html自体にtransform等があれば診断で警告する。

月本体は全モードで本番FOV 90/60のまま。リング・画面端マーカーは従来のviewport基準に残す。診断モードでも姿勢不安定・未校正・地平線下などの既存の表示抑制は維持する。

## 計測値と比較点

DebugのMoon transform pipelineとAR診断のDirection errorには、Moon azimuth / Corrected heading / Heading error、Moon altitude / Corrected altitude / Altitude errorを表示する。誤差は月−カメラで、方位差のみ[-180°, 180°)の最短角差へ正規化する（359°−1°は−2°）。表示は小数1桁、判定は丸め前の値を使う。

Main error axisは絶対誤差が両方3°以下ならALIGNED、方位のみ5°超で高度3°以下ならHEADING、高度のみ5°超で方位3°以下ならALTITUDE、両方5°超ならBOTH。それ以外はCAUTION、必要な角度が欠ける場合はUNAVAILABLEとする。値は地平線下・画面外・姿勢不安定でも取得可能な範囲で表示し、AR診断JSONとDebugのコピーテキストにも含める。保存済み北補正・天体計算・本番投影・表示条件には反映しない。

windowのinnerWidth/innerHeight、viewportと月の実測rect、月の実測中心、computed CSS、実際の祖先、offsetParent、visualViewportを記録する。resize、scroll、回転、ResizeObserverと250ms間隔で更新する。

本番のscreenX/Yから次を計算する。

```text
windowX = viewport.left + screenX * viewport.width
windowY = viewport.top + screenY * viewport.height
normalizedWindowX = windowX / innerWidth
normalizedWindowY = windowY / innerHeight
```

実測した月の中心と選択した配置式との差が2pxを超えれば警告する。式はborderや回転transformのない長方形を前提とするため、差が出た場合はCSS詳細を確認する。

同じrenderの月位置と `correctedView / moonInDevice` から、既存2D関数と本番3D関数を並べて計算する。2Dの%を0〜1へ変換したうえで、3D−2Dのx/y差を画面幅・高さに対する%で表示する。背面・真上/真下などで比較不能なら欠測として残す。

- 橙の点: 既存Debug 2D投影。
- シアンの点: 仮FOVの3D投影。これは比較点だけに適用し、本番の月位置・案内・表示判定には適用しない。
- 両点は選択中の配置領域に換算するため、viewportと全画面を混同せず比較できる。

仮FOV候補は90/60、90/90、window比率で水平90°維持、viewport比率で水平90°維持、viewport比率で垂直60°維持。

```text
tan(hFov/2) = aspect * tan(vFov/2)
vFov = 2 * atan(tan(hFov/2) / aspect)
hFov = 2 * atan(aspect * tan(vFov/2))
mismatch % = (実aspect / FOVからの期待aspect - 1) * 100
```

絶対値10%超で警告する。比率の整合は必要な幾何条件であり、実際の視野角を校正したことにはならない。

例えば **仮の数値** としてwindow=390×844、viewport=(left20, top100, width350, height500)なら、中心の月はviewport配置で(195,350)、全画面配置で(195,422)。月の方位計算を変えなくても縦に72px差が出る。viewport比率0.7と固定FOV比率1.732のmismatchは約−59.6%。これは実機の測定結果ではなく、単体テスト用の例。

## 実機での証拠の取り方

1. 通常どおり校正後、同じタブで上記クエリ付きARへ遷移する。月が地平線上で、姿勢が安定している状態を使う。実際の月と比較する場合は現在時刻を使う。
2. 同じ姿勢で、まず本番90/60・viewport配置を確認。比較点をOFFにすると月本体だけを観察できる。
3. 配置だけfull-screenへ切り替える。FOV、moonInDevice、correctedRotation、screenX/Yが同条件で、実際の月とのズレが減るか確認する。
4. 配置を戻し、仮FOVを切り替え、シアン点がどう変わるか確認する。中央だけでなく、左右・上下へ少し外れた方向でも比較する。
5. CSS実測差、FOV mismatch、grid各要素のサイズを確認。固定日時では日時ラベルによる行割当の変化も確認する。
6. 各条件で「診断テキストを固定」を押し、textareaから選択コピーする。固定した文字列には観測時刻、月位置、moonWorld、moonInDevice、補正済み行列、全実測値、比較値が入る。テキスト固定後も実際の月表示は通常どおり更新される。

| 観測結果 | 解釈 |
| --- | --- |
| 同じFOV・同じ入力で全画面配置だけが改善 | 配置基準の中心・縮尺がズレに寄与する証拠。FOVとの組合せは引き続き確認 |
| 実測中心−配置計算値がほぼ0 | absolute/fixed配置とtranslateは指定どおり機能している。配置面の選択が正しいかは別途確認 |
| 実測差が大きい | transform、border、containing block、scroll等のCSS要因を調査 |
| 比率を合わせた仮FOVで周辺ほど改善 | FOVと描画領域の角度スケールを優先して調査 |
| 中央で一致し周辺で2D/3Dが離れる | 線形投影と透視投影・rollの違いも含む。単独では不具合の証拠にならない |
| 固定日時だけviewport高さが潰れる | grid自動配置に関する具体的なCSS要因の証拠 |

今回、DeviceOrientation、northCorrection、校正条件、加速度、姿勢安定化、Astronomy、既存 `projectMoonToScreen()` と本番ARのCSSは変更していない。`useARView` は既に計算済みの月位置を返す項目を追加しただけ。新しいFOV式は診断専用で、本番経路から参照しない。

自動テストでは座標換算、FOV式、2D/3Dの既知の差、通常ARの不変性、診断切替時の行列・moonInDevice・天文計算呼び出しの不変性、計測・portalと祖先CSSの検査を確認する。DOMのrectはテスト用に模擬しており、実ブラウザーのレイアウトを検証したものではない。この作業環境には操作可能なブラウザーが接続されていないため、実端末のrect・月との一致・safe-areaの実測は未実施。
