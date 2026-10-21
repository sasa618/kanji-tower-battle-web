# フォント

ゲームの漢字にはNoto Serif JPのBold（wght=700），目立たせるUIにはDela Gothic Oneを使用する．

- 配布元：https://github.com/google/fonts/tree/main/ofl/notoserifjp
- 原本：NotoSerifJP-Variable.ttf
- 静的インスタンス：NotoSerifJP-Bold.ttf（tools/build-font.pyで作成）
- ライセンス：../../public/fonts/NotoSerifJP-OFL.txt（SIL Open Font License 1.1）
- 配信用サブセット：../../public/fonts/KanjiTowerSerif.woff2
- UI用書体の配布元：https://github.com/google/fonts/tree/main/ofl/delagothicone
- UI用書体の原本：DelaGothicOne-Regular.ttf
- UI用ライセンス：../../public/fonts/DelaGothicOne-OFL.txt（SIL Open Font License 1.1）
- UI用サブセット：../../public/fonts/KanjiTowerDisplay.woff2（Dela Gothic One，画面で使用する文字のみ）
- UI用画像制作フォント：KanjiTowerDisplay-Heavy.ttf（同じサブセット）

生成したサブセットは内部名をKanji Tower Serif，Kanji Tower Displayに変更している．ゲームの58文字について，復号後の輪郭がBoldインスタンスと一致することを生成時に検査する．表示用の輪郭は改変せず，物理判定用の輪郭だけを近似・分割している．UI用の極太ゴシック体はゲームの字形・当たり判定には使わない．

BIZUDGothic-Bold.ttfは以前の書体の原本であり，現在の画面には使用しない．対応するライセンスはBIZUDGothic-OFL.txtである．

タイトルの「合体！」だけはMochiy Pop Oneを使用する．3文字に限定したサブセットの内部名はKanji Tower Impact，配信ファイルはKanjiTowerImpact.woff2（約1.1KB）である．UIでは輪郭線を加え，白字・赤い面・黄色の影で強調する．

- 配布元：https://github.com/google/fonts/tree/main/ofl/mochiypopone
- 原本：MochiyPopOne-Regular.ttf
- ライセンス：../../public/fonts/MochiyPopOne-OFL.txt（SIL Open Font License 1.1）
- 生成：tools/build-font.py

元フォントのTTFはサイズが大きいためgitには含めない．字形データやサブセットを再生成する場合は，上記の配布元から原本を取得してこのフォルダーに置き，tools/build-font.pyとtools/build-glyphs.mjsを実行する．配信用のwoff2とOFLはpublic/fontsに追跡している．
