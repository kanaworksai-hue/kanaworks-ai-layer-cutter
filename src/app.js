import { encodePsd } from "./psd-writer.js";
import { detectGenericLayers } from "./layer-detector.js";

const COLORS = ["#167a63", "#d08b2c", "#3d6fb6", "#a34d78", "#6f8b2e", "#6e59a5"];
const STEP_ORDER = ["upload", "scan", "adjust", "preview", "split", "export"];
const STEP_LABELS = {
  upload: "step.upload",
  scan: "step.scan",
  adjust: "step.adjust",
  preview: "step.preview",
  split: "step.split",
  export: "step.export",
};
const GRANULARITY_LABELS = {
  low: "granularity.low",
  medium: "granularity.medium",
  high: "granularity.high",
};
const SHAPE_LABELS = {
  rect: "shape.rect",
  rounded: "shape.rounded",
  circle: "shape.circle",
};
const DEFAULT_LOCALE = "en";
const DEFAULT_MESSAGES = {
  "app.name": "KanaWorks AI Layer Cutter",
  "meta.title": "KanaWorks AI Layer Cutter",
  "aria.layers": "Layers",
  "aria.canvas": "Canvas",
  "aria.properties": "Properties",
  "aria.workflow": "Workflow",
  "aria.mainTools": "Main tools",
  "aria.language": "Language",
  "aria.granularity": "Granularity",
  "aria.shape": "Layer shape",
  "promo.followX": "Follow @KanaWorks_AI",
  "step.upload": "Upload",
  "step.scan": "Scan plan",
  "step.adjust": "Adjust",
  "step.preview": "Preview",
  "step.split": "Extract",
  "step.export": "Export PSD",
  "step.uploadButton": "1 Upload",
  "step.scanButton": "2 Scan",
  "step.adjustButton": "3 Adjust",
  "step.previewButton": "4 Preview",
  "step.splitButton": "5 Extract",
  "step.exportButton": "6 Export PSD",
  "granularity.low": "Low",
  "granularity.medium": "Medium",
  "granularity.high": "High",
  "shape.rect": "Rect",
  "shape.rounded": "Rounded",
  "shape.circle": "Circle",
  "status.waitingUpload": "Waiting for upload",
  "status.uploadStep": "Step 1: upload an image",
  "status.imageLoading": "Loading image",
  "status.imageLoaded": "Uploaded {name}. Next, scan the layer plan.",
  "status.imageFailed": "Image failed to load",
  "status.chooseGranularity": "{granularity} selected. Scan again to rebuild the plan.",
  "status.uploadFirst": "Upload an image first",
  "status.scanning": "Scanning with {granularity} granularity",
  "status.scanDone": "Scan complete: planned {count} layers with {granularity} granularity.",
  "status.scanFirst": "Scan a layer plan first",
  "status.adjust": "Step 3: move, resize, rename, delete, lock, or add manual areas.",
  "status.preview": "Step 4: previewing {count} visible layers",
  "status.previewFirst": "Preview the layers before extraction",
  "status.extracting": "Extracting layers",
  "status.keepOne": "Keep at least one visible layer",
  "status.extractDone": "Step 5 complete: extracted {count} layers. You can export PSD now.",
  "status.manualAdded": "Added a manual {shape} layer",
  "status.shapeChanged": "{name} changed to {shape}",
  "status.locked": "{name} locked",
  "status.unlocked": "{name} unlocked",
  "status.deleted": "Layer deleted",
  "status.exportFirst": "Complete Step 5 before exporting PSD",
  "status.writingPsd": "Writing PSD",
  "status.exportDone": "Exported {count} PSD layers",
  "status.exportFailed": "PSD export failed",
  "status.modified": "Layer plan changed. Preview and extract again.",
  "upload.emptyTitle": "Upload an image to start",
  "upload.emptyBody": "Supports 16:9, 9:16, 3:2, 2:3, 1:1, and adaptive sizes.",
  "panel.layerPlan": "Layer plan",
  "panel.properties": "Properties",
  "panel.emptyLoaded": "Scan a layer plan to show layers here.",
  "panel.emptyUpload": "Upload an image to start planning.",
  "field.name": "Name",
  "field.shape": "Shape",
  "field.opacity": "Opacity",
  "field.includeLayer": "Extract / export this layer",
  "field.includeReference": "Include hidden original reference layer",
  "action.openImage": "Open image",
  "action.lockSelected": "Lock selected area",
  "action.addLayer": "Add manual extraction area",
  "action.moveUp": "Move up",
  "action.moveDown": "Move down",
  "action.delete": "Delete",
  "action.visible": "Visible",
  "action.lock": "Lock",
  "action.unlock": "Unlock",
  "action.open": "On",
  "action.locked": "Locked",
  "action.selectLayer": "Select layer",
  "action.lockMark": "LOCK",
  "mode.add": "Add layer",
  "mode.preview": "Preview",
  "mode.split": "Extracted",
  "mode.select": "Select",
  "layer.manual": "Manual layer",
  "layer.reference": "Original reference / hidden",
  "aspect.adaptive": "Adaptive",
};

const refs = {
  fileInput: document.getElementById("fileInput"),
  scanButton: document.getElementById("scanButton"),
  adjustButton: document.getElementById("adjustButton"),
  previewButton: document.getElementById("previewButton"),
  splitButton: document.getElementById("splitButton"),
  drawButton: document.getElementById("drawButton"),
  exportButton: document.getElementById("exportButton"),
  stageCanvas: document.getElementById("stageCanvas"),
  canvasScroller: document.getElementById("canvasScroller"),
  uploadEmptyState: document.getElementById("uploadEmptyState"),
  layerList: document.getElementById("layerList"),
  layerCount: document.getElementById("layerCount"),
  imageMeta: document.getElementById("imageMeta"),
  modeLabel: document.getElementById("modeLabel"),
  statusText: document.getElementById("statusText"),
  layerName: document.getElementById("layerName"),
  layerX: document.getElementById("layerX"),
  layerY: document.getElementById("layerY"),
  layerW: document.getElementById("layerW"),
  layerH: document.getElementById("layerH"),
  layerOpacity: document.getElementById("layerOpacity"),
  layerVisible: document.getElementById("layerVisible"),
  lockSelectedButton: document.getElementById("lockSelectedButton"),
  includeReference: document.getElementById("includeReference"),
  languageInputs: [...document.querySelectorAll('input[name="language"]')],
  granularityInputs: [...document.querySelectorAll('input[name="granularity"]')],
  shapeInputs: [...document.querySelectorAll('input[name="layerShape"]')],
  moveUpButton: document.getElementById("moveUpButton"),
  moveDownButton: document.getElementById("moveDownButton"),
  deleteButton: document.getElementById("deleteButton"),
  workflowSteps: document.getElementById("workflowSteps"),
};

const ctx = refs.stageCanvas.getContext("2d", { willReadFrequently: true });
const sourceCanvas = document.createElement("canvas");
const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });

const state = {
  imageName: "",
  loaded: false,
  layers: [],
  selectedId: null,
  mode: "select",
  drag: null,
  workflowStep: "upload",
  language: DEFAULT_LOCALE,
  granularity: "high",
  drawShape: "rect",
  previewReady: false,
  splitReady: false,
  splitPayload: null,
};

let nextLayerId = 1;
let messages = { ...DEFAULT_MESSAGES };

boot();

async function boot() {
  state.language = preferredLanguage();
  await loadLocale(state.language);
  syncLanguageInputs();
  applyTranslations();
  bindEvents();
  const initialImage = getInitialImage();
  if (initialImage) {
    await loadImage(initialImage.src, initialImage.name);
  } else {
    showEmptyProject();
  }
}

function bindEvents() {
  refs.fileInput.addEventListener("change", handleFileChange);
  document.querySelectorAll("[data-upload-trigger]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      refs.fileInput.click();
    });
  });
  refs.languageInputs.forEach((input) => {
    input.addEventListener("change", async () => {
      if (!input.checked) {
        return;
      }
      state.language = input.value;
      window.localStorage.setItem("kw-layer-cutter-language", state.language);
      await loadLocale(state.language);
      document.documentElement.lang = state.language;
      applyTranslations();
      updateAll();
    });
  });
  refs.scanButton.addEventListener("click", scanAndPlanLayers);
  refs.granularityInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) {
        return;
      }
      state.granularity = input.value;
      invalidateSplit(false);
      if (state.loaded) {
        state.layers = [];
        state.selectedId = null;
        state.workflowStep = "scan";
        setStatus(t("status.chooseGranularity", { granularity: granularityLabel(state.granularity) }));
        updateAll();
      }
    });
  });
  refs.adjustButton.addEventListener("click", enterAdjustStep);
  refs.previewButton.addEventListener("click", enterPreviewStep);
  refs.splitButton.addEventListener("click", splitCurrentPlan);
  refs.drawButton.addEventListener("click", () => {
    if (state.workflowStep !== "adjust") {
      return;
    }
    state.mode = state.mode === "draw" ? "select" : "draw";
    updateMode();
    drawStage();
  });
  refs.exportButton.addEventListener("click", exportPsdFile);

  refs.layerName.addEventListener("input", () => updateSelected({ name: refs.layerName.value }));
  refs.layerX.addEventListener("input", () => updateSelectedNumber("x", refs.layerX.value));
  refs.layerY.addEventListener("input", () => updateSelectedNumber("y", refs.layerY.value));
  refs.layerW.addEventListener("input", () => updateSelectedNumber("width", refs.layerW.value));
  refs.layerH.addEventListener("input", () => updateSelectedNumber("height", refs.layerH.value));
  refs.layerOpacity.addEventListener("input", () => {
    updateSelected({ opacity: Number(refs.layerOpacity.value) / 100 });
  });
  refs.layerVisible.addEventListener("change", () => updateSelected({ visible: refs.layerVisible.checked }));
  refs.shapeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) {
        return;
      }
      state.drawShape = input.value;
      const layer = getSelectedLayer();
      if (layer && state.workflowStep === "adjust" && !layer.locked) {
        updateSelectedShape(input.value);
      } else {
        updateAll(false);
      }
    });
  });
  refs.lockSelectedButton.addEventListener("click", () => {
    const layer = getSelectedLayer();
    if (!layer) {
      return;
    }
    setLayerLocked(layer.id, true);
  });

  refs.moveUpButton.addEventListener("click", () => moveSelected(-1));
  refs.moveDownButton.addEventListener("click", () => moveSelected(1));
  refs.deleteButton.addEventListener("click", deleteSelected);

  refs.stageCanvas.addEventListener("pointerdown", handlePointerDown);
  refs.stageCanvas.addEventListener("pointermove", handlePointerMove);
  refs.stageCanvas.addEventListener("pointerup", handlePointerUp);
  refs.stageCanvas.addEventListener("pointercancel", handlePointerUp);
  refs.stageCanvas.addEventListener("dblclick", handleCanvasDoubleClick);
  window.addEventListener("resize", drawStage);
}

function preferredLanguage() {
  const saved = window.localStorage.getItem("kw-layer-cutter-language");
  if (saved === "ja" || saved === "en") {
    return saved;
  }
  return navigator.language?.toLowerCase().startsWith("ja") ? "ja" : DEFAULT_LOCALE;
}

async function loadLocale(locale) {
  if (locale === DEFAULT_LOCALE) {
    messages = { ...DEFAULT_MESSAGES };
    return;
  }

  try {
    const response = await fetch(`./locales/${locale}.json`);
    if (!response.ok) {
      throw new Error(`Locale ${locale} failed`);
    }
    messages = { ...DEFAULT_MESSAGES, ...(await response.json()) };
  } catch (error) {
    console.warn(error);
    messages = { ...DEFAULT_MESSAGES };
    state.language = DEFAULT_LOCALE;
  }
}

function applyTranslations() {
  document.documentElement.lang = state.language;
  document.title = t("meta.title");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.title = t(element.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
  syncLanguageInputs();
}

function t(key, values = {}) {
  const template = messages[key] ?? DEFAULT_MESSAGES[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
}

function syncLanguageInputs() {
  refs.languageInputs.forEach((input) => {
    input.checked = input.value === state.language;
  });
}

function granularityLabel(value) {
  return t(GRANULARITY_LABELS[value] ?? GRANULARITY_LABELS.high);
}

function shapeLabel(value) {
  return t(SHAPE_LABELS[value] ?? SHAPE_LABELS.rect);
}

function getInitialImage() {
  const imageParam = new URLSearchParams(window.location.search).get("image");
  if (!imageParam) {
    return null;
  }
  const src = imageParam;
  return {
    name: src.split("/").pop() || "image252.png",
    src,
  };
}

async function handleFileChange(event) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    await loadImage(url, file.name);
  } finally {
    URL.revokeObjectURL(url);
    refs.fileInput.value = "";
  }
}

function showEmptyProject() {
  state.imageName = "";
  state.loaded = false;
  state.layers = [];
  state.selectedId = null;
  state.mode = "select";
  state.workflowStep = "upload";
  state.previewReady = false;
  state.splitReady = false;
  state.splitPayload = null;
  refs.stageCanvas.width = 1280;
  refs.stageCanvas.height = 720;
  refs.imageMeta.textContent = t("status.waitingUpload");
  setStatus(t("status.uploadStep"));
  updateAll();
}

function loadImage(src, name) {
  setStatus(t("status.imageLoading"));
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      sourceCanvas.width = image.naturalWidth;
      sourceCanvas.height = image.naturalHeight;
      refs.stageCanvas.width = image.naturalWidth;
      refs.stageCanvas.height = image.naturalHeight;
      sourceCtx.clearRect(0, 0, image.naturalWidth, image.naturalHeight);
      sourceCtx.drawImage(image, 0, 0);

      state.imageName = name;
      state.loaded = true;
      state.layers = [];
      state.selectedId = null;
      state.mode = "select";
      state.workflowStep = "scan";
      state.previewReady = false;
      state.splitReady = false;
      state.splitPayload = null;
      refs.imageMeta.textContent = `${image.naturalWidth} × ${image.naturalHeight} · ${formatAspect(image.naturalWidth, image.naturalHeight)}`;
      setStatus(t("status.imageLoaded", { name }));
      updateAll();
      resolve();
    };
    image.onerror = () => {
      setStatus(t("status.imageFailed"));
      reject(new Error("Image load failed."));
    };
    image.src = src;
  });
}

function resetAutoLayers() {
  if (!state.loaded) {
    return 0;
  }
  nextLayerId = 1;
  state.layers = createAutoLayers(sourceCanvas.width, sourceCanvas.height);
  state.selectedId = state.layers[0]?.id ?? null;
  state.mode = "select";
  state.workflowStep = "adjust";
  invalidateSplit(false);
  updateAll();
  return state.layers.length;
}

function scanAndPlanLayers() {
  if (!state.loaded) {
    setStatus(t("status.uploadFirst"));
    return;
  }
  const label = granularityLabel(state.granularity);
  setStatus(t("status.scanning", { granularity: label }));
  window.requestAnimationFrame(() => {
    const count = resetAutoLayers();
    setStatus(t("status.scanDone", { count, granularity: label }));
  });
}

function enterAdjustStep() {
  if (!state.loaded || state.layers.length === 0) {
    setStatus(t("status.scanFirst"));
    return;
  }
  state.workflowStep = "adjust";
  state.mode = "select";
  setStatus(t("status.adjust"));
  updateAll();
}

function enterPreviewStep() {
  if (!state.loaded || state.layers.length === 0) {
    setStatus(t("status.scanFirst"));
    return;
  }
  state.workflowStep = "preview";
  state.mode = "preview";
  state.previewReady = true;
  setStatus(t("status.preview", { count: state.layers.filter((layer) => layer.visible).length }));
  updateAll();
}

async function splitCurrentPlan() {
  if (!state.loaded || state.layers.length === 0) {
    setStatus(t("status.scanFirst"));
    return;
  }
  if (!state.previewReady) {
    setStatus(t("status.previewFirst"));
    return;
  }

  state.workflowStep = "split";
  state.mode = "split";
  setStatus(t("status.extracting"));
  updateWorkflowUi();
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const composite = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const selectedLayers = state.layers.filter((layer) => layer.visible);
  if (selectedLayers.length === 0) {
    state.workflowStep = "adjust";
    state.mode = "select";
    setStatus(t("status.keepOne"));
    updateAll();
    return;
  }
  state.splitPayload = {
    composite,
    layers: selectedLayers.map((layer) => ({
      name: layer.name,
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      opacity: Math.round(layer.opacity * 255),
      visible: layer.visible,
      pixels: extractLayerPixels(layer),
    })),
  };
  state.splitReady = true;
  setStatus(t("status.extractDone", { count: state.splitPayload.layers.length }));
  updateAll();
}

function createAutoLayers(width, height) {
  const detected = detectGenericLayers(sourceCanvas, { granularity: state.granularity });
  return detected.map((layer) => createLayer(layer.name, clampRect(layer.rect, width, height), layer.holes ?? []));
}

function createLayer(name, rect, holes = [], shape = "rect") {
  return {
    id: `layer-${nextLayerId++}`,
    name,
    x: rect.x,
    y: rect.y,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
    holes: holes.map((hole) => ({ ...hole })),
    shape,
    locked: false,
    opacity: 1,
    visible: true,
    color: COLORS[nextLayerId % COLORS.length],
  };
}

function drawStage() {
  refs.uploadEmptyState.hidden = state.loaded;
  if (!state.loaded) {
    drawEmptyStage();
    return;
  }

  ctx.clearRect(0, 0, refs.stageCanvas.width, refs.stageCanvas.height);
  if (state.workflowStep === "preview" || state.workflowStep === "split" || state.workflowStep === "export") {
    drawPreviewComposite();
    return;
  }

  ctx.drawImage(sourceCanvas, 0, 0);

  for (let index = state.layers.length - 1; index >= 0; index -= 1) {
    const layer = state.layers[index];
    drawLayerOutline(layer, layer.id === state.selectedId);
  }

  if (state.drag?.type === "draw") {
    const rect = rectFromPointsForShape(state.drag.start, state.drag.current, state.drawShape);
    drawDraftShape(rect, state.drawShape);
  }
}

function drawEmptyStage() {
  ctx.clearRect(0, 0, refs.stageCanvas.width, refs.stageCanvas.height);
  drawCheckerboard(ctx, refs.stageCanvas.width, refs.stageCanvas.height, 32);
}

function drawPreviewComposite() {
  drawCheckerboard(ctx, refs.stageCanvas.width, refs.stageCanvas.height, 24);
  const layers = state.splitReady ? state.splitPayload.layers : state.layers;

  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const sourceLayer = layers[index];
    if (!sourceLayer.visible) {
      continue;
    }
    const layerPixels = sourceLayer.pixels ?? extractLayerPixels(sourceLayer);
    drawLayerPixels(sourceLayer, layerPixels);
  }
}

function drawCheckerboard(targetCtx, width, height, size) {
  targetCtx.save();
  targetCtx.fillStyle = "#ffffff";
  targetCtx.fillRect(0, 0, width, height);
  targetCtx.fillStyle = "#ece7dc";
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      if ((x / size + y / size) % 2 === 0) {
        targetCtx.fillRect(x, y, size, size);
      }
    }
  }
  targetCtx.restore();
}

function drawLayerPixels(layer, pixels) {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = layer.width;
  tempCanvas.height = layer.height;
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.putImageData(pixels, 0, 0);
  ctx.save();
  const opacity = layer.opacity == null ? 1 : layer.opacity > 1 ? layer.opacity / 255 : layer.opacity;
  ctx.globalAlpha = clamp(opacity, 0, 1);
  ctx.drawImage(tempCanvas, layer.x, layer.y);
  ctx.restore();
}

function drawLayerOutline(layer, selected) {
  const alpha = selected ? 0.18 : 0.045;
  ctx.save();
  ctx.globalAlpha = layer.visible ? 1 : 0.38;
  ctx.fillStyle = hexToRgba(layer.color, alpha);
  ctx.strokeStyle = layer.locked ? "#59635f" : layer.color;
  ctx.lineWidth = selected ? scaledLineWidth(3) : scaledLineWidth(1.5);
  ctx.setLineDash(layer.locked ? [scaledLineWidth(3), scaledLineWidth(5)] : selected ? [] : [scaledLineWidth(10), scaledLineWidth(6)]);
  traceLayerShape(ctx, layer);
  ctx.fill();
  traceLayerShape(ctx, layer);
  ctx.stroke();

  if (layer.locked) {
    ctx.fillStyle = "rgba(30, 37, 36, 0.72)";
    ctx.font = `${Math.max(12, scaledLineWidth(15))}px sans-serif`;
    ctx.fillText(t("action.lockMark"), layer.x + scaledLineWidth(8), layer.y + scaledLineWidth(20));
  }

  if (selected) {
    const handle = scaledHandleSize();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#111827";
    ctx.setLineDash([]);
    ctx.lineWidth = scaledLineWidth(2);
    ctx.fillRect(layer.x + layer.width - handle, layer.y + layer.height - handle, handle, handle);
    ctx.strokeRect(layer.x + layer.width - handle, layer.y + layer.height - handle, handle, handle);
  }
  ctx.restore();
}

function drawDraftShape(rect, shape) {
  ctx.save();
  ctx.fillStyle = "rgba(22, 122, 99, 0.14)";
  ctx.strokeStyle = "#167a63";
  ctx.lineWidth = scaledLineWidth(3);
  ctx.setLineDash([scaledLineWidth(12), scaledLineWidth(8)]);
  traceShapePath(ctx, rect, shape);
  ctx.fill();
  traceShapePath(ctx, rect, shape);
  ctx.stroke();
  ctx.restore();
}

function renderLayers() {
  refs.layerList.textContent = "";
  refs.layerCount.textContent = String(state.layers.length);

  if (state.layers.length === 0) {
    const empty = document.createElement("div");
    empty.className = "layer-empty";
    empty.textContent = state.loaded ? t("panel.emptyLoaded") : t("panel.emptyUpload");
    refs.layerList.append(empty);
    return;
  }

  state.layers.forEach((layer, index) => {
    const item = document.createElement("div");
    item.className = `layer-item${layer.id === state.selectedId ? " selected" : ""}${layer.locked ? " locked" : ""}`;

    const visibility = document.createElement("input");
    visibility.type = "checkbox";
    visibility.checked = layer.visible;
    visibility.disabled = state.workflowStep !== "adjust" || layer.locked;
    visibility.title = t("action.visible");
    visibility.addEventListener("change", () => {
      layer.visible = visibility.checked;
      invalidateSplit();
      updateAll(false);
    });

    const lockButton = document.createElement("button");
    lockButton.className = `lock-toggle${layer.locked ? " active" : ""}`;
    lockButton.type = "button";
    lockButton.disabled = state.workflowStep !== "adjust";
    lockButton.title = layer.locked ? t("action.unlock") : t("action.lock");
    lockButton.textContent = layer.locked ? t("action.lock") : t("action.open");
    lockButton.addEventListener("click", () => setLayerLocked(layer.id, !layer.locked));

    const button = document.createElement("button");
    button.className = "layer-select";
    button.type = "button";
    button.disabled = layer.locked;
    button.title = layer.locked ? t("action.locked") : t("action.selectLayer");
    button.addEventListener("click", () => selectLayer(layer.id));

    const thumb = document.createElement("canvas");
    thumb.width = 44;
    thumb.height = 32;
    drawThumbnail(thumb, layer);

    const label = document.createElement("span");
    label.textContent = layer.name;

    const order = document.createElement("small");
    order.textContent = String(index + 1).padStart(2, "0");

    button.append(thumb, label, order);
    item.append(visibility, lockButton, button);
    refs.layerList.append(item);
  });
}

function drawThumbnail(canvas, layer) {
  const thumbCtx = canvas.getContext("2d");
  thumbCtx.clearRect(0, 0, canvas.width, canvas.height);
  thumbCtx.fillStyle = "#f3f0e8";
  thumbCtx.fillRect(0, 0, canvas.width, canvas.height);
  if (!state.loaded) {
    return;
  }

  const scale = Math.min(canvas.width / layer.width, canvas.height / layer.height);
  const width = Math.max(1, layer.width * scale);
  const height = Math.max(1, layer.height * scale);
  const x = (canvas.width - width) / 2;
  const y = (canvas.height - height) / 2;
  thumbCtx.save();
  traceShapePath(
    thumbCtx,
    {
      x,
      y,
      width,
      height,
    },
    layer.shape,
  );
  thumbCtx.clip();
  thumbCtx.drawImage(sourceCanvas, layer.x, layer.y, layer.width, layer.height, x, y, width, height);
  thumbCtx.restore();
}

function renderInspector() {
  const layer = getSelectedLayer();
  const canEdit = Boolean(layer) && state.workflowStep === "adjust";
  for (const element of [
    refs.layerName,
    refs.layerX,
    refs.layerY,
    refs.layerW,
    refs.layerH,
    refs.layerOpacity,
    refs.layerVisible,
    refs.lockSelectedButton,
    refs.moveUpButton,
    refs.moveDownButton,
    refs.deleteButton,
  ]) {
    element.disabled = !canEdit;
  }
  refs.shapeInputs.forEach((input) => {
    input.disabled = state.workflowStep !== "adjust";
  });

  if (!layer) {
    refs.layerName.value = "";
    refs.layerX.value = "";
    refs.layerY.value = "";
    refs.layerW.value = "";
    refs.layerH.value = "";
    refs.layerOpacity.value = "100";
    refs.layerVisible.checked = false;
    syncShapeInputs(state.drawShape);
    return;
  }

  refs.layerName.value = layer.name;
  refs.layerX.value = String(layer.x);
  refs.layerY.value = String(layer.y);
  refs.layerW.value = String(layer.width);
  refs.layerH.value = String(layer.height);
  refs.layerOpacity.value = String(Math.round(layer.opacity * 100));
  refs.layerVisible.checked = layer.visible;
  syncShapeInputs(layer.shape ?? "rect");
}

function handlePointerDown(event) {
  if (!state.loaded || state.workflowStep !== "adjust") {
    return;
  }
  const point = canvasPoint(event);
  refs.stageCanvas.setPointerCapture(event.pointerId);

  if (state.mode === "draw") {
    state.drag = { type: "draw", start: point, current: point };
    drawStage();
    return;
  }

  const hit = hitTest(point);
  if (hit) {
    selectLayer(hit.id, false);
    const resize = isInResizeHandle(hit, point);
    state.drag = {
      type: resize ? "resize" : "move",
      id: hit.id,
      start: point,
      original: { x: hit.x, y: hit.y, width: hit.width, height: hit.height },
    };
  } else {
    state.selectedId = null;
    state.drag = null;
  }
  updateAll(false);
}

function handlePointerMove(event) {
  if (!state.loaded || state.workflowStep !== "adjust") {
    return;
  }
  const point = canvasPoint(event);

  if (state.drag?.type === "draw") {
    state.drag.current = point;
    drawStage();
    return;
  }

  if (state.drag?.type === "move" || state.drag?.type === "resize") {
    const layer = state.layers.find((item) => item.id === state.drag.id);
    if (!layer) {
      return;
    }
    const dx = Math.round(point.x - state.drag.start.x);
    const dy = Math.round(point.y - state.drag.start.y);
    if (state.drag.type === "move") {
      layer.x = clamp(state.drag.original.x + dx, 0, sourceCanvas.width - layer.width);
      layer.y = clamp(state.drag.original.y + dy, 0, sourceCanvas.height - layer.height);
    } else if (layer.shape === "circle") {
      const maxSize = Math.min(sourceCanvas.width - layer.x, sourceCanvas.height - layer.y);
      const size = clamp(Math.max(state.drag.original.width + dx, state.drag.original.height + dy), 1, maxSize);
      layer.width = size;
      layer.height = size;
    } else {
      layer.width = clamp(state.drag.original.width + dx, 1, sourceCanvas.width - layer.x);
      layer.height = clamp(state.drag.original.height + dy, 1, sourceCanvas.height - layer.y);
    }
    updateAll(false);
    return;
  }

  const selected = getSelectedLayer();
  refs.stageCanvas.style.cursor = selected && isInResizeHandle(selected, point) ? "nwse-resize" : "default";
}

function handlePointerUp(event) {
  if (!state.drag) {
    return;
  }

  if (state.drag.type === "draw") {
    const rect = normalizeRect(rectFromPointsForShape(state.drag.start, state.drag.current, state.drawShape));
    if (rect.width > 6 && rect.height > 6) {
      const layer = createLayer(`${t("layer.manual")} ${nextLayerId}`, rect, [], state.drawShape);
      normalizeShapeBounds(layer);
      state.layers.unshift(layer);
      state.selectedId = layer.id;
      invalidateSplit();
      setStatus(t("status.manualAdded", { shape: shapeLabel(layer.shape) }));
    }
    state.mode = "select";
  }

  state.drag = null;
  refs.stageCanvas.releasePointerCapture(event.pointerId);
  updateAll();
}

function handleCanvasDoubleClick(event) {
  if (state.workflowStep !== "adjust") {
    return;
  }
  const hit = hitTest(canvasPoint(event));
  if (hit) {
    selectLayer(hit.id);
  }
}

function selectLayer(id, rerender = true) {
  const layer = state.layers.find((item) => item.id === id);
  if (!layer || layer.locked) {
    return;
  }
  state.selectedId = id;
  if (rerender) {
    updateAll();
  }
}

function updateSelected(patch) {
  const layer = getSelectedLayer();
  if (!layer || layer.locked) {
    return;
  }
  Object.assign(layer, patch);
  clampLayer(layer);
  invalidateSplit();
  updateAll(false);
}

function updateSelectedShape(shape) {
  const layer = getSelectedLayer();
  if (!layer || layer.locked) {
    return;
  }
  layer.shape = shape;
  normalizeShapeBounds(layer);
  clampLayer(layer);
  invalidateSplit();
  setStatus(t("status.shapeChanged", { name: layer.name, shape: shapeLabel(shape) }));
  updateAll(false);
}

function setLayerLocked(id, locked) {
  if (state.workflowStep !== "adjust") {
    return;
  }
  const layer = state.layers.find((item) => item.id === id);
  if (!layer) {
    return;
  }
  layer.locked = locked;
  if (locked && state.selectedId === id) {
    state.selectedId = null;
  }
  setStatus(t(locked ? "status.locked" : "status.unlocked", { name: layer.name }));
  updateAll();
}

function updateSelectedNumber(prop, value) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) {
    return;
  }
  const layer = getSelectedLayer();
  if (layer?.shape === "circle" && (prop === "width" || prop === "height")) {
    updateSelected({ width: number, height: number });
    return;
  }
  updateSelected({ [prop]: number });
}

function moveSelected(direction) {
  const index = state.layers.findIndex((layer) => layer.id === state.selectedId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= state.layers.length) {
    return;
  }
  const [layer] = state.layers.splice(index, 1);
  state.layers.splice(nextIndex, 0, layer);
  invalidateSplit();
  updateAll();
}

function deleteSelected() {
  const index = state.layers.findIndex((layer) => layer.id === state.selectedId);
  if (index < 0) {
    return;
  }
  state.layers.splice(index, 1);
  state.selectedId = state.layers[Math.min(index, state.layers.length - 1)]?.id ?? null;
  invalidateSplit();
  setStatus(t("status.deleted"));
  updateAll();
}

async function exportPsdFile() {
  if (!state.loaded || state.layers.length === 0) {
    return;
  }
  if (!state.splitReady || !state.splitPayload) {
    setStatus(t("status.exportFirst"));
    return;
  }
  state.workflowStep = "export";
  setStatus(t("status.writingPsd"));
  await new Promise((resolve) => requestAnimationFrame(resolve));

  try {
    const composite = state.splitPayload.composite;
    const psdLayers = state.splitPayload.layers.map((layer) => ({ ...layer }));

    if (refs.includeReference.checked) {
      psdLayers.push({
        name: t("layer.reference"),
        x: 0,
        y: 0,
        width: sourceCanvas.width,
        height: sourceCanvas.height,
        opacity: 255,
        visible: false,
        pixels: composite,
      });
    }

    const buffer = encodePsd({
      width: sourceCanvas.width,
      height: sourceCanvas.height,
      composite,
      layers: psdLayers,
    });
    downloadBuffer(buffer, `${fileBaseName(state.imageName)}_layers.psd`);
    setStatus(t("status.exportDone", { count: psdLayers.length }));
    updateAll();
  } catch (error) {
    console.error(error);
    setStatus(t("status.exportFailed"));
    state.workflowStep = "split";
    updateAll();
  }
}

function extractLayerPixels(layer) {
  const canvas = document.createElement("canvas");
  canvas.width = layer.width;
  canvas.height = layer.height;
  const layerCtx = canvas.getContext("2d", { willReadFrequently: true });
  layerCtx.drawImage(
    sourceCanvas,
    layer.x,
    layer.y,
    layer.width,
    layer.height,
    0,
    0,
    layer.width,
    layer.height,
  );
  const imageData = layerCtx.getImageData(0, 0, layer.width, layer.height);
  applyHoles(imageData, layer);
  applyShapeMask(imageData, layer);
  return imageData;
}

function applyHoles(imageData, layer) {
  for (const hole of layer.holes) {
    const left = Math.max(layer.x, hole.x);
    const top = Math.max(layer.y, hole.y);
    const right = Math.min(layer.x + layer.width, hole.x + hole.width);
    const bottom = Math.min(layer.y + layer.height, hole.y + hole.height);
    if (right <= left || bottom <= top) {
      continue;
    }

    const startX = left - layer.x;
    const startY = top - layer.y;
    const endX = right - layer.x;
    const endY = bottom - layer.y;
    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        imageData.data[(y * layer.width + x) * 4 + 3] = 0;
      }
    }
  }
}

function applyShapeMask(imageData, layer) {
  if (!layer.shape || layer.shape === "rect") {
    return;
  }

  const width = imageData.width;
  const height = imageData.height;
  const radius = layer.shape === "rounded" ? roundedRadius({ width, height }) : Math.min(width, height) / 2;
  const centerX = width / 2;
  const centerY = height / 2;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inside =
        layer.shape === "circle"
          ? pointInsideCircle(x + 0.5, y + 0.5, centerX, centerY, radius)
          : pointInRoundedRect({ x: x + 0.5, y: y + 0.5 }, { x: 0, y: 0, width, height }, radius);
      if (!inside) {
        imageData.data[(y * width + x) * 4 + 3] = 0;
      }
    }
  }
}

function pointInsideCircle(x, y, centerX, centerY, radius) {
  const dx = x - centerX;
  const dy = y - centerY;
  return dx * dx + dy * dy <= radius * radius;
}

function downloadBuffer(buffer, filename) {
  const blob = new Blob([buffer], { type: "image/vnd.adobe.photoshop" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function updateAll(refreshList = true) {
  updateMode();
  drawStage();
  if (refreshList) {
    renderLayers();
  }
  renderInspector();
  updateWorkflowUi();
}

function updateMode() {
  const modeText =
    state.mode === "draw"
      ? t("mode.add")
      : state.mode === "preview"
        ? t("mode.preview")
        : state.mode === "split"
          ? t("mode.split")
          : t("mode.select");
  refs.modeLabel.textContent = `${t(STEP_LABELS[state.workflowStep])} / ${modeText}`;
  refs.drawButton.classList.toggle("active", state.mode === "draw");
}

function updateWorkflowUi() {
  const currentIndex = STEP_ORDER.indexOf(state.workflowStep);
  refs.workflowSteps.querySelectorAll("li").forEach((item) => {
    const index = STEP_ORDER.indexOf(item.dataset.step);
    item.classList.toggle("current", index === currentIndex);
    item.classList.toggle("done", index < currentIndex || (item.dataset.step === "split" && state.splitReady));
  });

  refs.scanButton.disabled = !state.loaded;
  refs.adjustButton.disabled = !state.loaded || state.layers.length === 0;
  refs.previewButton.disabled = !state.loaded || state.layers.length === 0;
  refs.splitButton.disabled = !state.loaded || state.layers.length === 0 || !state.previewReady;
  refs.exportButton.disabled = !state.splitReady;
  refs.drawButton.disabled = !state.loaded || state.workflowStep !== "adjust";
}

function invalidateSplit(updateStatus = true) {
  state.previewReady = false;
  state.splitReady = false;
  state.splitPayload = null;
  if (state.workflowStep === "preview" || state.workflowStep === "split" || state.workflowStep === "export") {
    state.workflowStep = "adjust";
    state.mode = "select";
    if (updateStatus) {
      setStatus(t("status.modified"));
    }
  }
}

function setStatus(message) {
  refs.statusText.textContent = message;
}

function getSelectedLayer() {
  return state.layers.find((layer) => layer.id === state.selectedId) ?? null;
}

function hitTest(point) {
  return state.layers.find((layer) => !layer.locked && pointInLayer(point, layer));
}

function pointInLayer(point, layer) {
  if (point.x < layer.x || point.x > layer.x + layer.width || point.y < layer.y || point.y > layer.y + layer.height) {
    return false;
  }

  if (layer.shape === "circle") {
    const radius = Math.min(layer.width, layer.height) / 2;
    const dx = point.x - (layer.x + layer.width / 2);
    const dy = point.y - (layer.y + layer.height / 2);
    return dx * dx + dy * dy <= radius * radius;
  }

  if (layer.shape === "rounded") {
    return pointInRoundedRect(point, layer, roundedRadius(layer));
  }

  return true;
}

function isInResizeHandle(layer, point) {
  const size = scaledHandleSize() * 1.5;
  return (
    point.x >= layer.x + layer.width - size &&
    point.x <= layer.x + layer.width + size &&
    point.y >= layer.y + layer.height - size &&
    point.y <= layer.y + layer.height + size
  );
}

function canvasPoint(event) {
  const rect = refs.stageCanvas.getBoundingClientRect();
  return {
    x: clamp(Math.round(((event.clientX - rect.left) / rect.width) * refs.stageCanvas.width), 0, refs.stageCanvas.width),
    y: clamp(Math.round(((event.clientY - rect.top) / rect.height) * refs.stageCanvas.height), 0, refs.stageCanvas.height),
  };
}

function rectFromPoints(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

function rectFromPointsForShape(a, b, shape) {
  if (shape !== "circle") {
    return rectFromPoints(a, b);
  }

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    x: dx < 0 ? a.x - size : a.x,
    y: dy < 0 ? a.y - size : a.y,
    width: size,
    height: size,
  };
}

function normalizeRect(rect) {
  const x = clamp(Math.round(rect.x), 0, sourceCanvas.width - 1);
  const y = clamp(Math.round(rect.y), 0, sourceCanvas.height - 1);
  return {
    x,
    y,
    width: clamp(Math.round(rect.width), 1, sourceCanvas.width - x),
    height: clamp(Math.round(rect.height), 1, sourceCanvas.height - y),
  };
}

function traceLayerShape(targetCtx, layer) {
  traceShapePath(targetCtx, layer, layer.shape);
}

function traceShapePath(targetCtx, rect, shape = "rect") {
  const x = rect.x;
  const y = rect.y;
  const width = rect.width;
  const height = rect.height;
  targetCtx.beginPath();

  if (shape === "circle") {
    const radius = Math.min(width, height) / 2;
    targetCtx.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2);
    targetCtx.closePath();
    return;
  }

  if (shape === "rounded") {
    const radius = roundedRadius(rect);
    targetCtx.moveTo(x + radius, y);
    targetCtx.lineTo(x + width - radius, y);
    targetCtx.quadraticCurveTo(x + width, y, x + width, y + radius);
    targetCtx.lineTo(x + width, y + height - radius);
    targetCtx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    targetCtx.lineTo(x + radius, y + height);
    targetCtx.quadraticCurveTo(x, y + height, x, y + height - radius);
    targetCtx.lineTo(x, y + radius);
    targetCtx.quadraticCurveTo(x, y, x + radius, y);
    targetCtx.closePath();
    return;
  }

  targetCtx.rect(x, y, width, height);
}

function roundedRadius(rect) {
  return Math.min(rect.width, rect.height) * 0.18;
}

function pointInRoundedRect(point, rect, radius) {
  const innerLeft = rect.x + radius;
  const innerRight = rect.x + rect.width - radius;
  const innerTop = rect.y + radius;
  const innerBottom = rect.y + rect.height - radius;

  if ((point.x >= innerLeft && point.x <= innerRight) || (point.y >= innerTop && point.y <= innerBottom)) {
    return true;
  }

  const cornerX = point.x < innerLeft ? innerLeft : innerRight;
  const cornerY = point.y < innerTop ? innerTop : innerBottom;
  const dx = point.x - cornerX;
  const dy = point.y - cornerY;
  return dx * dx + dy * dy <= radius * radius;
}

function syncShapeInputs(shape) {
  refs.shapeInputs.forEach((input) => {
    input.checked = input.value === shape;
  });
}

function clampRect(rect, width, height) {
  const x = clamp(Math.round(rect.x), 0, width - 1);
  const y = clamp(Math.round(rect.y), 0, height - 1);
  return {
    x,
    y,
    width: clamp(Math.round(rect.width), 1, width - x),
    height: clamp(Math.round(rect.height), 1, height - y),
  };
}

function clampLayer(layer) {
  layer.x = clamp(Math.round(layer.x), 0, sourceCanvas.width - 1);
  layer.y = clamp(Math.round(layer.y), 0, sourceCanvas.height - 1);
  layer.width = clamp(Math.round(layer.width), 1, sourceCanvas.width - layer.x);
  layer.height = clamp(Math.round(layer.height), 1, sourceCanvas.height - layer.y);
  layer.opacity = clamp(Number(layer.opacity), 0, 1);
  normalizeShapeBounds(layer);
}

function normalizeShapeBounds(layer) {
  layer.shape = layer.shape ?? "rect";
  if (layer.shape !== "circle" || !state.loaded) {
    return;
  }

  const maxSize = Math.max(1, Math.min(sourceCanvas.width - layer.x, sourceCanvas.height - layer.y));
  const size = clamp(Math.max(Math.round(layer.width), Math.round(layer.height)), 1, maxSize);
  layer.width = size;
  layer.height = size;
}

function scaledLineWidth(value) {
  return value / getCanvasScale();
}

function scaledHandleSize() {
  return 13 / getCanvasScale();
}

function getCanvasScale() {
  const rect = refs.stageCanvas.getBoundingClientRect();
  return rect.width > 0 ? rect.width / refs.stageCanvas.width : 1;
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function fileBaseName(filename) {
  return filename.replace(/\.[^.]+$/, "") || "image";
}

function formatAspect(width, height) {
  const ratio = width / height;
  const presets = [
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
    ["3:2", 3 / 2],
    ["2:3", 2 / 3],
    ["1:1", 1],
  ];
  const match = presets.find(([, value]) => Math.abs(ratio - value) < 0.035);
  return match ? match[0] : t("aspect.adaptive");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
