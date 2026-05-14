# Kana Layer Cutter

Kana Layer Cutter is a browser-based tool for turning uploaded images into editable PSD layer plans. It is designed for posters, UI screenshots, infographics, presentation images, and other flat visuals that need to be separated into editable parts.

Live demo: https://kanaworksai-hue.github.io/kanaworks-ai-layer-cutter/

Follow KanaWorks AI on X: https://x.com/KanaWorks_AI

## Features

- Upload images by clicking the upload button or dragging an image into the upload area.
- Supports common image ratios such as 16:9, 9:16, 3:2, 2:3, 1:1, and adaptive sizes.
- Choose low or medium layer granularity before scanning.
- Creates a layer plan using OCR-assisted text detection, contour detection, and a local visual fallback.
- Adjust, rename, lock, reorder, hide, and delete planned layer areas.
- Add manual extraction areas as rectangles, rounded rectangles, or circles.
- Preview extracted layers before exporting.
- Export a layered PSD directly from the browser.
- Switch between English and Japanese.

## Workflow

1. Upload an image.
2. Choose a detail level and scan the image.
3. Fine-tune layer boxes, names, locks, visibility, and shapes.
4. Preview the extracted layers.
5. Extract the planned areas.
6. Export the result as a PSD file.

## Privacy

Kana Layer Cutter runs in the browser. Image processing happens locally on the user's device, and uploaded images do not need to be sent to a server.

## Tech Stack

- HTML, CSS, and vanilla JavaScript.
- Canvas-based editing and preview.
- Tesseract.js for OCR-assisted text detection.
- OpenCV.js for contour-based visual region detection.
- A browser-side PSD writer for exporting layered PSD files.

## Run Locally

```bash
python3 -m http.server 4174
```

Open http://127.0.0.1:4174/.

## GitHub Pages

This is a static site. It can be published from the repository root with GitHub Pages.

---

# Kana Layer Cutter 日本語

Kana Layer Cutter は、アップロードした画像をブラウザー上で編集可能な PSD レイヤー計画に分解するツールです。ポスター、UI スクリーンショット、インフォグラフィック、プレゼン用画像など、1 枚の画像をあとから編集しやすいパーツに分けたい場面に向いています。

オンライン版: https://kanaworksai-hue.github.io/kanaworks-ai-layer-cutter/

KanaWorks AI の X: https://x.com/KanaWorks_AI

## 機能

- アップロードボタン、またはアップロードエリアへのドラッグ＆ドロップで画像を読み込めます。
- 16:9、9:16、3:2、2:3、1:1 などの一般的な画像比率と自動サイズに対応します。
- スキャン前に低・中の分割粒度を選択できます。
- OCR 補助の文字検出、輪郭検出、ローカル視覚スキャンを組み合わせてレイヤー計画を作成します。
- レイヤー範囲の調整、名前変更、ロック、並べ替え、非表示、削除ができます。
- 手動の抽出範囲を四角、角丸、円形で追加できます。
- 書き出し前に抽出レイヤーをプレビューできます。
- ブラウザー上で直接、レイヤー付き PSD として書き出せます。
- 英語と日本語を切り替えられます。

## 使い方

1. 画像をアップロードします。
2. 分割粒度を選び、画像をスキャンします。
3. レイヤー範囲、名前、ロック、表示状態、形状を微調整します。
4. 抽出結果をプレビューします。
5. 計画した範囲を抽出します。
6. PSD ファイルとして書き出します。

## プライバシー

Kana Layer Cutter はブラウザー上で動作します。画像処理はユーザーの端末内で行われるため、アップロードした画像をサーバーへ送信する必要はありません。

## 技術構成

- HTML、CSS、バニラ JavaScript。
- Canvas による編集とプレビュー。
- Tesseract.js による OCR 補助の文字検出。
- OpenCV.js による輪郭ベースの視覚領域検出。
- ブラウザー上で動作する PSD 書き出し処理。

## ローカル実行

```bash
python3 -m http.server 4174
```

http://127.0.0.1:4174/ を開きます。

## GitHub Pages

このプロジェクトは静的サイトです。リポジトリのルートから GitHub Pages で公開できます。
