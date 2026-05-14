# Kana Layer Cutter

Kana Layer Cutter is a browser-only tool that turns an uploaded image into editable PSD layers. It runs locally in the browser, so uploaded images do not need to be sent to a server.

Follow KanaWorks AI on X: https://x.com/KanaWorks_AI

## Features

- Upload common image ratios such as 16:9, 9:16, 3:2, 2:3, 1:1, and adaptive sizes.
- Choose low, medium, or high layer granularity before scanning.
- Use OCR-assisted text boxes and contour detection for the scan plan, with a local visual fallback.
- Adjust, rename, lock, reorder, hide, and delete planned layers.
- Add manual extraction areas as rectangles, rounded rectangles, or circles.
- Preview extracted layers and export a layered PSD directly from the browser.
- Switch between English and Japanese.

## Run Locally

```bash
python3 -m http.server 4174
```

Open http://127.0.0.1:4174/.

## GitHub Pages

This is a static site. It can be published from the repository root with GitHub Pages.

## 日本語

Kana Layer Cutter は、アップロードした画像をブラウザー上で編集可能な PSD レイヤーに分解するツールです。画像をサーバーへ送信せず、ブラウザー内で処理します。

- スキャン前に低・中・高の分割粒度を選択できます。
- OCR 補助の文字枠と輪郭検出でレイヤー計画を作り、必要に応じてローカル視覚スキャンへ切り替えます。
- レイヤーの調整、名前変更、ロック、並べ替え、非表示、削除ができます。
- 手動追加は四角、角丸、円形に対応します。
- 英語と日本語を切り替えられます。
