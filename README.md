# Kana Layer Cutter

English | [日本語](README.ja.md)

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
