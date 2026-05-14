const MAX_ANALYSIS_SIZE = 520;
const MAX_LOW_LAYERS = 5;
const MAX_FINE_LAYERS = 140;

export function detectGenericLayers(sourceCanvas, options = {}) {
  const analysis = buildAnalysis(sourceCanvas);
  const metrics = buildMetrics(analysis);
  const lines = detectStructuralLines(analysis, metrics);
  const granularity = options.granularity ?? "high";

  if (granularity === "low") {
    return withBackground(sourceCanvas, buildLowLayerPlan(analysis, metrics, lines));
  }

  if (granularity === "medium") {
    const logicalLayers = buildMediumLayoutPlan(sourceCanvas, analysis, metrics, lines);
    return withBackground(sourceCanvas, logicalLayers.length >= 2 ? logicalLayers : buildLowLayerPlan(analysis, metrics, lines));
  }

  const fineLayers = buildFineLayerPlan(sourceCanvas, analysis, metrics, lines);

  if (fineLayers.length >= 2) {
    return withBackground(sourceCanvas, fineLayers);
  }

  const logicalLayers = buildMediumLayoutPlan(sourceCanvas, analysis, metrics, lines);

  if (logicalLayers.length >= 2) {
    return withBackground(sourceCanvas, logicalLayers);
  }

  return withBackground(sourceCanvas, buildLowLayerPlan(analysis, metrics, lines));
}

function buildLowLayerPlan(analysis, metrics, lines) {
  const visualLayers = rankAndDedupeLayers(
    [...detectGridMediaBlocks(analysis, metrics, lines), ...detectVisualBlocks(analysis, metrics)],
    5,
    false,
  );
  const textLayers = detectTextBlocks(analysis, metrics, visualLayers);
  return rankAndDedupeLayers([...textLayers, ...visualLayers], MAX_LOW_LAYERS);
}

function withBackground(sourceCanvas, layers) {
  return [
    ...layers,
    {
      name: "Background",
      rect: { x: 0, y: 0, width: sourceCanvas.width, height: sourceCanvas.height },
      holes: layers.map((layer) => layer.rect),
    },
  ];
}

function buildAnalysis(sourceCanvas) {
  const scale = Math.min(1, MAX_ANALYSIS_SIZE / Math.max(sourceCanvas.width, sourceCanvas.height));
  const width = Math.max(1, Math.round(sourceCanvas.width * scale));
  const height = Math.max(1, Math.round(sourceCanvas.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, width, height);

  return {
    data: ctx.getImageData(0, 0, width, height).data,
    height,
    scaleX: sourceCanvas.width / width,
    scaleY: sourceCanvas.height / height,
    sourceHeight: sourceCanvas.height,
    sourceWidth: sourceCanvas.width,
    width,
  };
}

function buildMetrics(analysis) {
  const total = analysis.width * analysis.height;
  const background = estimateBackground(analysis);
  const luminance = new Float32Array(total);
  const saturation = new Float32Array(total);
  const bgDistance = new Float32Array(total);
  const edge = new Float32Array(total);

  for (let y = 0; y < analysis.height; y += 1) {
    for (let x = 0; x < analysis.width; x += 1) {
      const pos = y * analysis.width + x;
      const offset = pos * 4;
      const r = analysis.data[offset];
      const g = analysis.data[offset + 1];
      const b = analysis.data[offset + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);

      luminance[pos] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      saturation[pos] = max - min;
      bgDistance[pos] = colorDistance(r, g, b, background.r, background.g, background.b);

      let localEdge = 0;
      if (x > 0) {
        localEdge = Math.max(localEdge, pixelDistance(analysis.data, offset, offset - 4));
      }
      if (y > 0) {
        localEdge = Math.max(localEdge, pixelDistance(analysis.data, offset, offset - analysis.width * 4));
      }
      edge[pos] = localEdge;
    }
  }

  return { background, bgDistance, edge, luminance, saturation };
}

function estimateBackground({ data, width, height }) {
  const step = Math.max(1, Math.floor(Math.min(width, height) / 100));
  const samples = [];

  for (let x = 0; x < width; x += step) {
    samples.push(pixelAt(data, width, x, 0));
    samples.push(pixelAt(data, width, x, height - 1));
  }
  for (let y = 0; y < height; y += step) {
    samples.push(pixelAt(data, width, 0, y));
    samples.push(pixelAt(data, width, width - 1, y));
  }

  const r = median(samples.map((sample) => sample.r));
  const g = median(samples.map((sample) => sample.g));
  const b = median(samples.map((sample) => sample.b));
  return {
    r,
    g,
    b,
    luminance: 0.2126 * r + 0.7152 * g + 0.0722 * b,
  };
}

function detectStructuralLines(analysis, metrics) {
  const verticalScores = new Float32Array(analysis.width);
  const horizontalScores = new Float32Array(analysis.height);
  const subtleThreshold = 13;

  for (let y = 0; y < analysis.height; y += 1) {
    for (let x = 1; x < analysis.width; x += 1) {
      const pos = y * analysis.width + x;
      const offset = pos * 4;
      const diff = pixelDistance(analysis.data, offset, offset - 4);
      const subtleLine =
        metrics.bgDistance[pos] > subtleThreshold &&
        metrics.bgDistance[pos] < 90 &&
        metrics.saturation[pos] < 75 &&
        Math.abs(metrics.luminance[pos] - metrics.background.luminance) > 7;
      if (diff > 32 || subtleLine) {
        verticalScores[x] += 1;
      }
    }
  }

  for (let y = 1; y < analysis.height; y += 1) {
    for (let x = 0; x < analysis.width; x += 1) {
      const pos = y * analysis.width + x;
      const offset = pos * 4;
      const diff = pixelDistance(analysis.data, offset, offset - analysis.width * 4);
      const subtleLine =
        metrics.bgDistance[pos] > subtleThreshold &&
        metrics.bgDistance[pos] < 90 &&
        metrics.saturation[pos] < 75 &&
        Math.abs(metrics.luminance[pos] - metrics.background.luminance) > 7;
      if (diff > 32 || subtleLine) {
        horizontalScores[y] += 1;
      }
    }
  }

  return {
    horizontal: findLinePeaks(horizontalScores, analysis.width, analysis.scaleY, analysis.sourceHeight),
    vertical: findLinePeaks(verticalScores, analysis.height, analysis.scaleX, analysis.sourceWidth),
  };
}

function findLinePeaks(scores, crossAxisSize, sourceScale, sourceLimit) {
  const smoothed = smoothScores(scores, 2);
  const threshold = Math.max(18, crossAxisSize * 0.16);
  const candidates = [];
  let start = -1;
  let strength = 0;
  let weighted = 0;

  for (let index = 0; index <= smoothed.length; index += 1) {
    const value = index < smoothed.length ? smoothed[index] : 0;
    if (value >= threshold) {
      if (start === -1) {
        start = index;
        strength = 0;
        weighted = 0;
      }
      strength += value;
      weighted += value * index;
    } else if (start !== -1) {
      const center = weighted / Math.max(1, strength);
      candidates.push({ pos: Math.round(center * sourceScale), strength });
      start = -1;
    }
  }

  const merged = mergeLineCandidates(candidates, Math.max(7, sourceLimit * 0.006));
  return merged
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 24)
    .map((candidate) => clamp(Math.round(candidate.pos), 0, sourceLimit))
    .sort((a, b) => a - b);
}

function detectVisualBlocks(analysis, metrics) {
  const mask = new Uint8Array(analysis.width * analysis.height);

  for (let index = 0; index < mask.length; index += 1) {
    const colorful = metrics.saturation[index] > 38 && metrics.bgDistance[index] > 24;
    const textured =
      metrics.edge[index] > 62 &&
      metrics.bgDistance[index] > 30 &&
      metrics.saturation[index] > 12;
    const darkImageArea = metrics.luminance[index] < 85 && metrics.bgDistance[index] > 55 && metrics.saturation[index] > 8;
    if (colorful || textured || darkImageArea) {
      mask[index] = 1;
    }
  }

  const components = findComponents(dilateMask(mask, analysis.width, analysis.height, 2, 2), analysis);
  const docArea = analysis.sourceWidth * analysis.sourceHeight;

  return components
    .map((component) => enrichComponent(component, analysis, metrics, "visual"))
    .filter((component) => {
      const area = rectArea(component.rect);
      if (area > docArea * 0.86) {
        return false;
      }
      const largeVisualRegion =
        component.rect.width >= analysis.sourceWidth * 0.035 &&
        component.rect.height >= analysis.sourceHeight * 0.035 &&
        area >= docArea * 0.006 &&
        (component.density > 0.18 || component.avgSaturation > 24 || component.avgEdge > 34);
      const compactColorRegion =
        component.avgSaturation > 60 &&
        component.rect.width >= analysis.sourceWidth * 0.03 &&
        component.rect.height >= analysis.sourceHeight * 0.03 &&
        area >= docArea * 0.002;
      return largeVisualRegion || compactColorRegion;
    })
    .map((component) => ({
      name: component.density > 0.42 || component.avgSaturation > 42 ? "Image block" : "Graphic element",
      rect: expandRect(component.rect, 4, analysis.sourceWidth, analysis.sourceHeight),
      score: component.score,
    }));
}

function detectGridMediaBlocks(analysis, metrics, lines) {
  const vertical = normalizeLinePositions([0, ...lines.vertical, analysis.sourceWidth], analysis.sourceWidth);
  const horizontal = normalizeLinePositions([0, ...lines.horizontal, analysis.sourceHeight], analysis.sourceHeight);
  const columns = segmentsFromLines(vertical, Math.max(90, analysis.sourceWidth * 0.08));
  const rows = segmentsFromLines(horizontal, Math.max(90, analysis.sourceHeight * 0.08));
  const docArea = analysis.sourceWidth * analysis.sourceHeight;

  if (columns.length < 2 || rows.length < 2 || columns.length > 10 || rows.length > 10) {
    return [];
  }

  const layers = [];
  for (const column of columns) {
    for (const row of rows) {
      const cell = {
        x: column.start,
        y: row.start,
        width: column.end - column.start,
        height: row.end - row.start,
      };
      const cellArea = rectArea(cell);
      if (cellArea < docArea * 0.012 || cell.width < analysis.sourceWidth * 0.08 || cell.height < analysis.sourceHeight * 0.09) {
        continue;
      }

      const media = scanMediaInsideRect(cell, analysis, metrics);
      if (!media) {
        continue;
      }

      const coverage = rectArea(media.rect) / Math.max(1, cellArea);
      if (media.density > 0.16 && coverage > 0.18) {
        layers.push({
          name: "Image block",
          rect: expandRect(media.rect, 5, analysis.sourceWidth, analysis.sourceHeight),
          score: coverage * 35 + media.density * 25 + cellArea / docArea * 20,
        });
      }
    }
  }

  return layers;
}

function buildFineLayerPlan(sourceCanvas, analysis, metrics, lines) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const docArea = width * height;
  const mediumLayers = buildMediumLayoutPlan(sourceCanvas, analysis, metrics, lines);
  const imageLayers = mediumLayers
    .filter((layer) => layer.name.startsWith("Image"))
    .map((layer) => ({
      name: "Image block",
      rect: layer.rect,
      score: 130 + rectArea(layer.rect) / Math.max(1, docArea) * 80,
      type: "image",
    }));

  const fallbackImageLayers =
    imageLayers.length > 0
      ? []
      : rankAndDedupeLayers(
          [...detectGridMediaBlocks(analysis, metrics, lines), ...detectVisualBlocks(analysis, metrics)]
            .filter((layer) => rectArea(layer.rect) >= docArea * 0.004)
            .map((layer) => ({ ...layer, name: "Image block", type: "image" })),
          24,
          false,
        );
  const primaryImages = imageLayers.length > 0 ? imageLayers : fallbackImageLayers;
  const graphicLayers = detectFineGraphicBlocks(analysis, metrics, primaryImages);
  const textExclusions = [
    ...primaryImages,
    ...graphicLayers.filter(
      (layer) =>
        layer.type === "graphic" &&
        rectArea(layer.rect) < docArea * 0.0035 &&
        layer.rect.width < width * 0.06 &&
        layer.rect.height < height * 0.065,
    ),
  ];
  const textLayers = detectFineTextBlocks(analysis, metrics, textExclusions);
  const layers = dedupeFineLayers([...primaryImages, ...graphicLayers, ...textLayers], width, height);

  if (layers.length === 0 && isMostlyImageDocument(analysis, metrics)) {
    layers.push({
      name: "Image block",
      rect: { x: 0, y: 0, width, height },
      score: 90,
      type: "image",
    });
  }

  return numberFineLayersByType(layers)
    .filter((layer) => layer.rect.width > 1 && layer.rect.height > 1)
    .map(({ name, rect }) => ({ name, rect, holes: [] }));
}

function buildMediumLayoutPlan(sourceCanvas, analysis, metrics, lines) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const vertical = normalizeLinePositions([0, ...lines.vertical, width], width);
  const horizontal = normalizeLinePositions([0, ...lines.horizontal, height], height);
  let columns = segmentsFromLines(vertical, Math.max(96, width * 0.08));
  columns = regularizeRepeatedColumns(columns, width);

  if (columns.length < 2 || columns.length > 8) {
    return [];
  }

  const topBoundary = chooseTopBoundary(horizontal, height, analysis, metrics);
  const bottomBoundary = chooseBottomBoundary(horizontal, height, topBoundary);
  const contentTop = topBoundary ?? 0;
  const contentBottom = bottomBoundary ?? height;
  const contentHeight = contentBottom - contentTop;

  if (contentHeight < height * 0.28) {
    return [];
  }

  const layers = [];
  if (contentTop >= height * 0.055) {
    layers.push({
      name: "Title text",
      rect: {
        x: 0,
        y: 0,
        width,
        height: contentTop,
      },
      score: 100,
    });
  }

  const rowLines = normalizeLinePositions(
    [contentTop, ...horizontal.filter((line) => line > contentTop && line < contentBottom), contentBottom],
    height,
  );
  const rows = segmentsFromLines(rowLines, Math.max(24, height * 0.022));

  columns.forEach((column, columnIndex) => {
    const columnRect = {
      x: column.start,
      y: contentTop,
      width: column.end - column.start,
      height: contentHeight,
    };
    const columnMedia = [];
    const imageFrame = buildColumnImageFrame(columnRect, horizontal, contentTop, contentBottom, width, height);

    if (imageFrame) {
      const frameMedia = scanMediaInsideRect(imageFrame, analysis, metrics);
      if (frameMedia && frameMedia.density > 0.045) {
        columnMedia.push({
          name: `Image ${columnIndex + 1}`,
          rect: imageFrame,
          coverage: rectArea(frameMedia.rect) / Math.max(1, rectArea(imageFrame)),
          density: frameMedia.density,
          framed: true,
        });
      }
    }

    rows.forEach((row) => {
      const cell = insetRect(
        {
          x: column.start,
          y: row.start,
          width: column.end - column.start,
          height: row.end - row.start,
        },
        Math.max(4, width * 0.003),
        Math.max(3, height * 0.003),
      );
      const media = scanMediaInsideRect(cell, analysis, metrics);
      if (!media) {
        return;
      }

      const coverage = rectArea(media.rect) / Math.max(1, rectArea(cell));
      const rect = expandRect(media.rect, 5, width, height);
      const centerY = rect.y + rect.height / 2;
      const usefulImage =
        coverage > 0.07 &&
        media.density > 0.075 &&
        rect.width > columnRect.width * 0.22 &&
        rect.height > height * 0.028 &&
        rect.y < contentTop + contentHeight * 0.68 &&
        centerY < contentTop + contentHeight * 0.62;

      if (usefulImage) {
        columnMedia.push({
          name: `Image ${columnIndex + 1}`,
          rect,
          coverage,
          density: media.density,
        });
      }
    });

    if (!imageFrame) {
      const imageBandTop = guessPrimaryImageTop(horizontal, contentTop, contentBottom, height);
      const primaryBand = insetRect(
        {
          x: column.start,
          y: imageBandTop,
          width: column.end - column.start,
          height: Math.min(contentBottom - imageBandTop, contentHeight * 0.58),
        },
        Math.max(4, width * 0.003),
        Math.max(3, height * 0.003),
      );
      const broadMedia = scanMediaInsideRect(primaryBand, analysis, metrics);
      if (broadMedia && broadMedia.density > 0.045) {
        const rect = expandRect(broadMedia.rect, 5, width, height);
        if (rect.width > columnRect.width * 0.25 && rect.height > height * 0.05) {
          columnMedia.push({
            name: `Image ${columnIndex + 1}`,
            rect,
            coverage: rectArea(rect) / Math.max(1, rectArea(primaryBand)),
            density: broadMedia.density,
          });
        }
      }
    }

    const imageLayers = pickColumnImageLayer(columnMedia, columnRect, contentTop, contentBottom, width, height, columnIndex + 1);
    layers.push(...imageLayers);

    const imageRect = imageLayers[0]?.rect ?? null;
    const textRegions = buildColumnTextRegions(columnRect, imageRect, horizontal, contentTop, contentBottom, width, height);
    textRegions.forEach((region) => {
      const text = scanTextInsideRect(region.rect, analysis, metrics, imageLayers.map((layer) => layer.rect));
      if (!text) {
        return;
      }

      const textArea = rectArea(text.rect);
      if (
        textArea < width * height * 0.00025 ||
        text.rect.width < columnRect.width * 0.12 ||
        text.rect.height < Math.max(11, height * 0.011) ||
        overlapAny(text.rect, imageLayers.map((layer) => layer.rect), 0.22)
      ) {
        return;
      }

      layers.push({
        name: `${region.name} ${columnIndex + 1}`,
        rect: expandRect(text.rect, 4, width, height),
        score: region.score,
      });
    });
  });

  if (contentBottom <= height * 0.965 && height - contentBottom >= Math.max(28, height * 0.028)) {
    const footerRect = {
      x: 0,
      y: contentBottom,
      width,
      height: height - contentBottom,
    };
    const footerText = scanTextInsideRect(insetRect(footerRect, Math.max(12, width * 0.008), 3), analysis, metrics, []);
    layers.push({
      name: "Footer text",
      rect: footerText ? expandRect(footerText.rect, 5, width, height) : footerRect,
      score: 80,
    });
  }

  return rankAndDedupeLayers(layers, 32, false)
    .filter((layer) => layer.rect.width > width * 0.035 && layer.rect.height > height * 0.01)
    .map(({ name, rect }) => ({ name, rect, holes: [] }));
}

function detectFineGraphicBlocks(analysis, metrics, imageLayers) {
  const mask = new Uint8Array(analysis.width * analysis.height);
  const docArea = analysis.sourceWidth * analysis.sourceHeight;

  for (let y = 0; y < analysis.height; y += 1) {
    for (let x = 0; x < analysis.width; x += 1) {
      if (isAnalysisPointInsideAnyRect(x, y, imageLayers, analysis)) {
        continue;
      }

      const pos = y * analysis.width + x;
      const textLike =
        metrics.saturation[pos] < 26 &&
        metrics.luminance[pos] < metrics.background.luminance - 34 &&
        (metrics.edge[pos] > 18 || metrics.bgDistance[pos] > 105);
      const graphicLike =
        (metrics.saturation[pos] > 24 && metrics.bgDistance[pos] > 18 && Math.abs(metrics.luminance[pos] - metrics.background.luminance) > 12) ||
        (metrics.saturation[pos] > 42 && metrics.bgDistance[pos] > 22) ||
        (metrics.edge[pos] > 54 && metrics.bgDistance[pos] > 28 && metrics.saturation[pos] > 12) ||
        (metrics.luminance[pos] < 92 && metrics.saturation[pos] > 18 && metrics.bgDistance[pos] > 48);
      if (!textLike && graphicLike) {
        mask[pos] = 1;
      }
    }
  }

  return findComponents(dilateMask(mask, analysis.width, analysis.height, 1, 1), analysis)
    .map((component) => enrichComponent(component, analysis, metrics, "visual"))
    .filter((component) => {
      const area = rectArea(component.rect);
      if (area < docArea * 0.000025 || area > docArea * 0.24) {
        return false;
      }
      if (component.rect.width < Math.max(5, analysis.sourceWidth * 0.0035) || component.rect.height < Math.max(5, analysis.sourceHeight * 0.004)) {
        return false;
      }
      if (imageLayers.some((layer) => overlapRatio(component.rect, layer.rect) > 0.34 || rectCenterInRect(component.rect, layer.rect))) {
        return false;
      }

      const iconLike =
        area <= docArea * 0.009 &&
        component.density > 0.025 &&
        (component.avgSaturation > 10 || component.avgLuminance < metrics.background.luminance - 16);
      const smallImageLike =
        component.rect.width >= analysis.sourceWidth * 0.025 &&
        component.rect.height >= analysis.sourceHeight * 0.025 &&
        (component.avgSaturation > 28 || (component.density > 0.22 && component.avgEdge > 38));
      return iconLike || smallImageLike;
    })
    .map((component) => {
      const area = rectArea(component.rect);
      const largeEnoughImage =
        area > docArea * 0.0035 ||
        (component.rect.width > analysis.sourceWidth * 0.055 && component.rect.height > analysis.sourceHeight * 0.055);
      const imageLike =
        largeEnoughImage &&
        (component.avgSaturation > 24 || component.density > 0.22);
      const textLikeGraphic =
        !imageLike &&
        component.rect.width > component.rect.height * 1.35 &&
        component.rect.height > Math.max(9, analysis.sourceHeight * 0.008) &&
        component.rect.height < analysis.sourceHeight * 0.07 &&
        component.density < 0.72;
      const type = textLikeGraphic ? "text" : imageLike ? "image" : "graphic";
      return {
        name: textLikeGraphic ? "Text" : imageLike ? "Image block" : "Icon / graphic",
        rect: expandRect(component.rect, imageLike ? 3 : 2, analysis.sourceWidth, analysis.sourceHeight),
        score: component.score + (imageLike ? 24 : textLikeGraphic ? 18 : 12),
        type,
      };
    });
}

function detectFineTextBlocks(analysis, metrics, imageLayers) {
  const mask = new Uint8Array(analysis.width * analysis.height);
  const darkThreshold = Math.min(152, Math.max(72, metrics.background.luminance - 24));
  const docArea = analysis.sourceWidth * analysis.sourceHeight;

  for (let y = 0; y < analysis.height; y += 1) {
    for (let x = 0; x < analysis.width; x += 1) {
      if (isAnalysisPointInsideAnyRect(x, y, imageLayers, analysis)) {
        continue;
      }

      const pos = y * analysis.width + x;
      const likelyInk =
        (metrics.luminance[pos] < darkThreshold && metrics.saturation[pos] < 105) ||
        (metrics.edge[pos] > 42 && metrics.luminance[pos] < 182 && metrics.saturation[pos] < 92);
      if (likelyInk) {
        mask[pos] = 1;
      }
    }
  }

  const components = findComponents(dilateMask(mask, analysis.width, analysis.height, 3, 1), analysis)
    .map((component) => enrichComponent(component, analysis, metrics, "text"))
    .filter((component) => {
      const area = rectArea(component.rect);
      const height = component.rect.height;
      const width = component.rect.width;
      if (area < docArea * 0.000015 || area > docArea * 0.045) {
        return false;
      }
      if (height < Math.max(5, analysis.sourceHeight * 0.0045) || height > analysis.sourceHeight * 0.09) {
        return false;
      }
      if (width < Math.max(5, analysis.sourceWidth * 0.0035)) {
        return false;
      }
      if (imageLayers.some((layer) => overlapRatio(component.rect, layer.rect) > 0.28 || rectCenterInRect(component.rect, layer.rect))) {
        return false;
      }
      const looksLikeText =
        component.avgSaturation < 112 &&
        component.density > 0.01 &&
        component.density < 0.82 &&
        (component.avgEdge > 6 || component.avgLuminance < metrics.background.luminance - 3);
      return looksLikeText;
    })
    .map((component) => ({
      name: "Text",
      rect: expandRect(component.rect, 2, analysis.sourceWidth, analysis.sourceHeight),
      score: component.score + 30,
      type: "text",
    }));

  return mergeFineTextLines(components, analysis.sourceWidth, analysis.sourceHeight);
}

function mergeFineTextLines(layers, sourceWidth, sourceHeight) {
  const sorted = [...layers].sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  const merged = [];

  for (const layer of sorted) {
    const target = merged.find((item) => {
      const centerDelta = Math.abs(rectCenterY(item.rect) - rectCenterY(layer.rect));
      const verticalOverlap = intersectionHeight(item.rect, layer.rect) / Math.max(1, Math.min(item.rect.height, layer.rect.height));
      const horizontalGap = Math.max(0, Math.max(item.rect.x, layer.rect.x) - Math.min(item.rect.x + item.rect.width, layer.rect.x + layer.rect.width));
      const sameLine = verticalOverlap > 0.46 || centerDelta < Math.max(7, Math.min(item.rect.height, layer.rect.height) * 0.55);
      const closeEnough = horizontalGap < Math.max(14, sourceWidth * 0.014);
      const mergedWidth = unionRect(item.rect, layer.rect).width;
      return sameLine && closeEnough && mergedWidth < sourceWidth * 0.34;
    });

    if (target) {
      target.rect = unionRect(target.rect, layer.rect);
      target.score += layer.score;
    } else {
      merged.push({ ...layer });
    }
  }

  return merged.map((layer) => ({
    ...layer,
    rect: expandRect(layer.rect, 1, sourceWidth, sourceHeight),
  }));
}

function dedupeFineLayers(layers, width, height) {
  const typePriority = { image: 3, text: 2, graphic: 1 };
  const ordered = layers
    .filter((layer) => layer.rect && layer.rect.width > 1 && layer.rect.height > 1)
    .map((layer) => ({
      ...layer,
      rect: clipRectToRect(layer.rect, { x: 0, y: 0, width, height }),
    }))
    .filter((layer) => layer.rect)
    .sort((a, b) => {
      const priorityDelta = (typePriority[b.type] ?? 0) - (typePriority[a.type] ?? 0);
      if (priorityDelta) {
        return priorityDelta;
      }
      return (b.score ?? rectArea(b.rect)) - (a.score ?? rectArea(a.rect));
    });
  const accepted = [];

  for (const layer of ordered) {
    const duplicate = accepted.some((item) => rectIou(item.rect, layer.rect) > 0.62 || overlapRatio(item.rect, layer.rect) > 0.92);
    if (!duplicate) {
      accepted.push(layer);
    }
  }

  return accepted
    .sort((a, b) => (b.score ?? rectArea(b.rect)) - (a.score ?? rectArea(a.rect)))
    .slice(0, MAX_FINE_LAYERS)
    .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
}

function numberFineLayersByType(layers) {
  const counters = { image: 0, graphic: 0, text: 0 };
  const labels = { image: "Image block", graphic: "Icon / graphic", text: "Text" };
  return layers.map((layer) => {
    const type = layer.type ?? "graphic";
    counters[type] = (counters[type] ?? 0) + 1;
    return {
      ...layer,
      name: `${labels[type] ?? "Element"} ${String(counters[type]).padStart(2, "0")}`,
    };
  });
}

function isMostlyImageDocument(analysis, metrics) {
  let visualPixels = 0;
  for (let index = 0; index < metrics.bgDistance.length; index += 1) {
    if (metrics.bgDistance[index] > 32 || metrics.saturation[index] > 28 || metrics.edge[index] > 36) {
      visualPixels += 1;
    }
  }
  return visualPixels / Math.max(1, analysis.width * analysis.height) > 0.34;
}

function chooseTopBoundary(lines, height, analysis, metrics) {
  const ruleCandidates = lines
    .filter((line) => line > height * 0.045 && line < height * 0.28)
    .map((line) => ({
      line,
      ruleScore: measureHorizontalRuleScore(line, analysis, metrics),
    }));
  const strongRule = ruleCandidates.find((candidate) => candidate.ruleScore > 0.18);
  if (strongRule) {
    return strongRule.line;
  }

  const candidates = lines.filter((line) => line > height * 0.075 && line < height * 0.34);
  if (candidates.length === 0) {
    const fallback = lines.filter((line) => line > height * 0.045 && line < height * 0.34);
    return fallback[0] ?? null;
  }
  return candidates[0];
}

function measureHorizontalRuleScore(line, analysis, metrics) {
  const y = clamp(Math.round(line / analysis.scaleY), 0, analysis.height - 1);
  const radius = 2;
  let rulePixels = 0;
  let total = 0;

  for (let yy = Math.max(0, y - radius); yy <= Math.min(analysis.height - 1, y + radius); yy += 1) {
    for (let x = 0; x < analysis.width; x += 1) {
      const pos = yy * analysis.width + x;
      const ruleLike =
        metrics.bgDistance[pos] > 7 &&
        metrics.bgDistance[pos] < 115 &&
        metrics.saturation[pos] < 70 &&
        Math.abs(metrics.luminance[pos] - metrics.background.luminance) > 5;
      if (ruleLike) {
        rulePixels += 1;
      }
      total += 1;
    }
  }

  return rulePixels / Math.max(1, total);
}

function chooseBottomBoundary(lines, height, topBoundary) {
  const candidates = lines.filter((line) => line > height * 0.58 && line < height * 0.975);
  if (candidates.length === 0) {
    return null;
  }

  const footerCandidate = [...candidates].reverse().find((line) => height - line >= Math.max(24, height * 0.028));
  if (footerCandidate && (!topBoundary || footerCandidate - topBoundary > height * 0.3)) {
    return footerCandidate;
  }
  return null;
}

function buildColumnImageFrame(columnRect, horizontalLines, contentTop, contentBottom, width, height) {
  const contentHeight = Math.max(1, contentBottom - contentTop);
  const imageTop = guessPrimaryImageTop(horizontalLines, contentTop, contentBottom, height);
  const minimumImageHeight = Math.max(72, height * 0.075);
  const imageBottom =
    horizontalLines.find(
      (line) =>
        line > imageTop + minimumImageHeight &&
        line < contentTop + contentHeight * 0.76 &&
        line < contentBottom - Math.max(18, height * 0.018),
    ) ?? null;

  if (!imageBottom || imageBottom - imageTop < minimumImageHeight) {
    return null;
  }

  return insetRect(
    {
      x: columnRect.x,
      y: imageTop,
      width: columnRect.width,
      height: imageBottom - imageTop,
    },
    Math.max(5, width * 0.004),
    Math.max(2, height * 0.002),
  );
}

function guessPrimaryImageTop(horizontalLines, contentTop, contentBottom, height) {
  const contentHeight = Math.max(1, contentBottom - contentTop);
  return (
    horizontalLines.find(
      (line) =>
        line > contentTop + Math.max(24, height * 0.024) &&
        line < contentTop + contentHeight * 0.34,
    ) ?? contentTop
  );
}

function buildColumnTextRegions(columnRect, imageRect, horizontalLines, contentTop, contentBottom, width, height) {
  const insetX = Math.max(8, width * 0.006);
  const insetY = Math.max(4, height * 0.004);
  const regions = [];

  if (!imageRect) {
    regions.push({
      name: "Text group",
      rect: insetRect(columnRect, insetX, insetY),
      score: 60,
    });
    return regions;
  }

  const imageTop = clamp(imageRect.y, contentTop, contentBottom);
  const imageBottom = clamp(imageRect.y + imageRect.height, contentTop, contentBottom);
  const splitAfterImage =
    horizontalLines.find(
      (line) =>
        line > imageBottom + Math.max(70, height * 0.068) &&
        line < contentBottom - Math.max(26, height * 0.025),
    ) ?? null;

  const titleTop = Math.max(0, contentTop - Math.max(14, height * 0.014));
  const titleBottom = Math.max(imageTop, contentTop + Math.max(48, height * 0.047));
  if (titleBottom - titleTop > Math.max(24, height * 0.024)) {
    regions.push({
      name: "Title text",
      rect: insetRect(
        {
          x: columnRect.x,
          y: titleTop,
          width: columnRect.width,
          height: Math.min(contentBottom, titleBottom) - titleTop,
        },
        insetX,
        insetY,
      ),
      score: 76,
    });
  }

  const descriptionBottom = splitAfterImage ?? contentBottom;
  if (descriptionBottom - imageBottom > Math.max(28, height * 0.028)) {
    regions.push({
      name: "Description text",
      rect: insetRect(
        {
          x: columnRect.x,
          y: imageBottom,
          width: columnRect.width,
          height: descriptionBottom - imageBottom,
        },
        insetX,
        insetY,
      ),
      score: 70,
    });
  }

  if (splitAfterImage && contentBottom - splitAfterImage > Math.max(44, height * 0.043)) {
    regions.push({
      name: "Info text",
      rect: insetRect(
        {
          x: columnRect.x,
          y: splitAfterImage,
          width: columnRect.width,
          height: contentBottom - splitAfterImage,
        },
        insetX,
        insetY,
      ),
      score: 68,
    });
  }

  return regions;
}

function pickColumnImageLayer(candidates, columnRect, contentTop, contentBottom, width, height, columnNumber) {
  if (candidates.length === 0) {
    return [];
  }

  const contentHeight = Math.max(1, contentBottom - contentTop);
  const clipRect = { ...columnRect, y: contentTop, height: contentHeight };
  const usable = candidates
    .map((candidate) => ({
      ...candidate,
      rect: clipRectToRect(candidate.rect, clipRect),
    }))
    .filter((candidate) => {
      if (!candidate.rect) {
        return false;
      }
      const centerY = candidate.rect.y + candidate.rect.height / 2;
      return (
        candidate.rect.width >= columnRect.width * 0.24 &&
        candidate.rect.height >= height * 0.028 &&
        candidate.rect.y < contentTop + contentHeight * 0.7 &&
        centerY < contentTop + contentHeight * 0.64
      );
    })
    .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);

  if (usable.length === 0) {
    return [];
  }

  const clusters = [];
  usable.forEach((candidate) => {
    const target = clusters.find((cluster) => shouldMergeColumnMedia(cluster.rect, candidate.rect, columnRect, height));
    if (target) {
      const targetArea = rectArea(target.rect);
      const candidateArea = rectArea(candidate.rect);
      const area = targetArea + candidateArea;
      const mergedRect = unionRect(target.rect, candidate.rect);
      const frameRect = target.framed ? target.rect : candidate.framed ? candidate.rect : null;
      target.rect = frameRect
        ? {
            x: frameRect.x,
            y: mergedRect.y,
            width: frameRect.width,
            height: mergedRect.height,
          }
        : mergedRect;
      target.density = (target.density * targetArea + candidate.density * candidateArea) / Math.max(1, area);
      target.coverage = Math.max(target.coverage, candidate.coverage ?? 0);
      target.framed = target.framed || candidate.framed;
    } else {
      clusters.push({
        rect: candidate.rect,
        density: candidate.density,
        coverage: candidate.coverage ?? 0,
        framed: Boolean(candidate.framed),
      });
    }
  });

  const best = clusters
    .map((cluster) => {
      const rect = clipRectToRect(expandRect(cluster.rect, 3, width, height), clipRect);
      const areaRatio = rectArea(rect) / Math.max(1, rectArea(columnRect));
      const widthRatio = rect.width / Math.max(1, columnRect.width);
      const heightRatio = rect.height / Math.max(1, contentHeight);
      const topOffset = (rect.y - contentTop) / contentHeight;
      const primaryBandScore = clamp(1 - Math.abs(topOffset - 0.18) / 0.34, 0, 1);
      return {
        ...cluster,
        rect,
        score: areaRatio * 90 + widthRatio * 24 + heightRatio * 36 + cluster.density * 24 + primaryBandScore * 18 + (cluster.framed ? 40 : 0),
      };
    })
    .filter((cluster) => cluster.rect.width >= columnRect.width * 0.32 && cluster.rect.height >= height * 0.065)
    .sort((a, b) => b.score - a.score)[0];

  return best
    ? [
        {
          name: `Image ${columnNumber}`,
          rect: best.rect,
          score: 82 + best.score,
        },
      ]
    : [];
}

function shouldMergeColumnMedia(a, b, columnRect, height) {
  const verticalGap = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height));
  const horizontalOverlap = intersectionWidth(a, b) / Math.max(1, Math.min(a.width, b.width));
  const bothColumnWide = a.width > columnRect.width * 0.42 && b.width > columnRect.width * 0.42;
  return verticalGap <= Math.max(34, height * 0.035) && (horizontalOverlap > 0.12 || bothColumnWide);
}

function activeRowBounds(rowCounts, scanWidth) {
  let maxCount = 0;
  for (const count of rowCounts) {
    maxCount = Math.max(maxCount, count);
  }
  if (maxCount < 4) {
    return null;
  }

  const threshold = Math.max(3, Math.min(scanWidth * 0.12, maxCount * 0.28));
  let start = -1;
  let end = -1;
  for (let index = 0; index < rowCounts.length; index += 1) {
    const smoothed =
      rowCounts[index] +
      (index > 0 ? rowCounts[index - 1] : 0) * 0.5 +
      (index < rowCounts.length - 1 ? rowCounts[index + 1] : 0) * 0.5;
    if (smoothed >= threshold) {
      if (start === -1) {
        start = index;
      }
      end = index;
    }
  }

  return start === -1 ? null : { start, end };
}

function scanMediaInsideRect(rect, analysis, metrics) {
  const left = clamp(Math.floor(rect.x / analysis.scaleX), 0, analysis.width - 1);
  const top = clamp(Math.floor(rect.y / analysis.scaleY), 0, analysis.height - 1);
  const right = clamp(Math.ceil((rect.x + rect.width) / analysis.scaleX), left + 1, analysis.width);
  const bottom = clamp(Math.ceil((rect.y + rect.height) / analysis.scaleY), top + 1, analysis.height);
  let count = 0;
  let minX = analysis.width;
  let minY = analysis.height;
  let maxX = 0;
  let maxY = 0;
  const rowCounts = new Uint16Array(bottom - top);

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const pos = y * analysis.width + x;
      const textLike =
        metrics.saturation[pos] < 24 &&
        metrics.luminance[pos] < metrics.background.luminance - 34 &&
        (metrics.edge[pos] > 18 || metrics.bgDistance[pos] > 105);
      const mediaLike =
        (metrics.saturation[pos] > 30 && metrics.bgDistance[pos] > 20) ||
        (metrics.edge[pos] > 58 && metrics.saturation[pos] > 10 && metrics.bgDistance[pos] > 28) ||
        (metrics.luminance[pos] < 95 && metrics.saturation[pos] > 8 && metrics.bgDistance[pos] > 55);
      if (!textLike && mediaLike) {
        count += 1;
        rowCounts[y - top] += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const area = (right - left) * (bottom - top);
  if (count < area * 0.08 || minX > maxX || minY > maxY) {
    return null;
  }

  const rowTrim = activeRowBounds(rowCounts, right - left);
  if (rowTrim) {
    minY = Math.max(minY, top + rowTrim.start);
    maxY = Math.min(maxY, top + rowTrim.end);
  }

  const x = Math.floor(minX * analysis.scaleX);
  const y = Math.floor(minY * analysis.scaleY);
  const sourceRight = Math.ceil((maxX + 1) * analysis.scaleX);
  const sourceBottom = Math.ceil((maxY + 1) * analysis.scaleY);
  return {
    density: count / area,
    rect: {
      x,
      y,
      width: Math.max(1, sourceRight - x),
      height: Math.max(1, sourceBottom - y),
    },
  };
}

function scanTextInsideRect(rect, analysis, metrics, excludedRects) {
  const left = clamp(Math.floor(rect.x / analysis.scaleX), 0, analysis.width - 1);
  const top = clamp(Math.floor(rect.y / analysis.scaleY), 0, analysis.height - 1);
  const right = clamp(Math.ceil((rect.x + rect.width) / analysis.scaleX), left + 1, analysis.width);
  const bottom = clamp(Math.ceil((rect.y + rect.height) / analysis.scaleY), top + 1, analysis.height);
  const darkThreshold = Math.min(150, Math.max(72, metrics.background.luminance - 26));
  let count = 0;
  let minX = analysis.width;
  let minY = analysis.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const sourceX = x * analysis.scaleX;
      const sourceY = y * analysis.scaleY;
      if (excludedRects.some((excluded) => pointInRect(sourceX, sourceY, excluded))) {
        continue;
      }

      const pos = y * analysis.width + x;
      const likelyInk =
        (metrics.luminance[pos] < darkThreshold && metrics.saturation[pos] < 115) ||
        (metrics.edge[pos] > 46 && metrics.luminance[pos] < 178 && metrics.saturation[pos] < 95);
      if (likelyInk) {
        count += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const analysisArea = Math.max(1, (right - left) * (bottom - top));
  if (count < Math.max(6, analysisArea * 0.004) || minX > maxX || minY > maxY) {
    return null;
  }

  const x = Math.floor(minX * analysis.scaleX);
  const y = Math.floor(minY * analysis.scaleY);
  const sourceRight = Math.ceil((maxX + 1) * analysis.scaleX);
  const sourceBottom = Math.ceil((maxY + 1) * analysis.scaleY);
  return {
    density: count / analysisArea,
    rect: {
      x,
      y,
      width: Math.max(1, sourceRight - x),
      height: Math.max(1, sourceBottom - y),
    },
  };
}

function detectTextBlocks(analysis, metrics, visualLayers) {
  const mask = new Uint8Array(analysis.width * analysis.height);
  const darkThreshold = Math.min(150, Math.max(70, metrics.background.luminance - 28));

  for (let index = 0; index < mask.length; index += 1) {
    const likelyInk =
      metrics.luminance[index] < darkThreshold ||
      (metrics.edge[index] > 48 && metrics.luminance[index] < 178 && metrics.saturation[index] < 110);
    if (likelyInk) {
      mask[index] = 1;
    }
  }

  const expanded = dilateMask(mask, analysis.width, analysis.height, 4, 1);
  const components = findComponents(expanded, analysis);
  const docArea = analysis.sourceWidth * analysis.sourceHeight;
  const initial = components
    .map((component) => enrichComponent(component, analysis, metrics, "text"))
    .filter((component) => {
      const area = rectArea(component.rect);
      const insideVisual = visualLayers.some((layer) => overlapRatio(component.rect, layer.rect) > 0.72);
      return (
        !insideVisual &&
        component.rect.width >= analysis.sourceWidth * 0.018 &&
        component.rect.height >= Math.max(8, analysis.sourceHeight * 0.008) &&
        component.rect.height <= analysis.sourceHeight * 0.16 &&
        area >= docArea * 0.00035 &&
        area <= docArea * 0.18
      );
    })
    .map((component) => ({
      name: "Text / mark",
      rect: expandRect(component.rect, 3, analysis.sourceWidth, analysis.sourceHeight),
      score: component.score * 0.9,
    }));

  return mergeTextLayers(initial, analysis.sourceWidth, analysis.sourceHeight);
}

function enrichComponent(component, analysis, metrics, mode) {
  let sat = 0;
  let edge = 0;
  let luminance = 0;
  for (const pos of component.sample) {
    sat += metrics.saturation[pos];
    edge += metrics.edge[pos];
    luminance += metrics.luminance[pos];
  }
  const sampleCount = Math.max(1, component.sample.length);
  const rect = expandRect(component.rect, mode === "text" ? 1 : 2, analysis.sourceWidth, analysis.sourceHeight);
  const analysisArea = Math.max(1, (component.maxX - component.minX + 1) * (component.maxY - component.minY + 1));
  const density = component.count / analysisArea;
  const areaScore = rectArea(rect) / (analysis.sourceWidth * analysis.sourceHeight);

  return {
    ...component,
    avgEdge: edge / sampleCount,
    avgLuminance: luminance / sampleCount,
    avgSaturation: sat / sampleCount,
    density,
    rect,
    score: areaScore * 100 + density * 12 + edge / sampleCount / 12 + sat / sampleCount / 18,
  };
}

function findComponents(mask, analysis) {
  const { width, height, scaleX, scaleY } = analysis;
  const visited = new Uint8Array(mask.length);
  const stack = new Int32Array(mask.length);
  const components = [];

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) {
      continue;
    }

    let top = 0;
    let count = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    const sample = [];
    stack[top++] = start;
    visited[start] = 1;

    while (top > 0) {
      const pos = stack[--top];
      const x = pos % width;
      const y = Math.floor(pos / width);
      count += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      if (sample.length < 300) {
        sample.push(pos);
      }

      const neighbors = [pos - 1, pos + 1, pos - width, pos + width];
      for (const next of neighbors) {
        if (next < 0 || next >= mask.length || visited[next] || !mask[next]) {
          continue;
        }
        if ((next === pos - 1 && x === 0) || (next === pos + 1 && x === width - 1)) {
          continue;
        }
        visited[next] = 1;
        stack[top++] = next;
      }
    }

    if (count < 6) {
      continue;
    }

    const x = Math.floor(minX * scaleX);
    const y = Math.floor(minY * scaleY);
    const right = Math.ceil((maxX + 1) * scaleX);
    const bottom = Math.ceil((maxY + 1) * scaleY);
    components.push({
      count,
      maxX,
      maxY,
      minX,
      minY,
      rect: { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) },
      sample,
    });
  }

  return components;
}

function mergeTextLayers(layers, sourceWidth, sourceHeight) {
  const sorted = [...layers].sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  const merged = [];

  for (const layer of sorted) {
    const target = merged.find((item) => {
      const verticalGap = Math.max(0, Math.max(item.rect.y, layer.rect.y) - Math.min(item.rect.y + item.rect.height, layer.rect.y + layer.rect.height));
      const horizontalOverlap = intersectionWidth(item.rect, layer.rect) / Math.max(1, Math.min(item.rect.width, layer.rect.width));
      return verticalGap < Math.max(18, sourceHeight * 0.018) && horizontalOverlap > 0.18;
    });

    if (target) {
      target.rect = unionRect(target.rect, layer.rect);
      target.score += layer.score;
    } else {
      merged.push({ ...layer });
    }
  }

  return merged.map((layer) => ({
    ...layer,
    rect: expandRect(layer.rect, 2, sourceWidth, sourceHeight),
  }));
}

function rankAndDedupeLayers(layers, maxLayers, rename = true) {
  const sorted = layers
    .filter((layer) => layer.rect.width > 1 && layer.rect.height > 1)
    .sort((a, b) => (b.score ?? rectArea(b.rect)) - (a.score ?? rectArea(a.rect)));
  const accepted = [];

  for (const layer of sorted) {
    const duplicate = accepted.some((item) => rectIou(item.rect, layer.rect) > 0.68 || overlapRatio(item.rect, layer.rect) > 0.9);
    if (!duplicate) {
      accepted.push(layer);
    }
    if (accepted.length >= maxLayers) {
      break;
    }
  }

  return accepted
    .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)
    .map((layer, index) => ({
      name: rename ? numberedName(layer.name, index + 1) : layer.name,
      rect: layer.rect,
      holes: layer.holes ?? [],
      score: layer.score,
    }));
}

function numberedName(name, number) {
  return /\d+$/.test(name) ? name : `${name} ${number}`;
}

function segmentsFromLines(lines, minSize) {
  const segments = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    const start = lines[index];
    const end = lines[index + 1];
    if (end - start >= minSize) {
      segments.push({ start, end });
    }
  }
  return segments;
}

function regularizeRepeatedColumns(columns, width) {
  if (columns.length < 4 || columns.length > 6) {
    return columns;
  }

  const widths = columns.map((column) => column.end - column.start);
  const minWidth = Math.min(...widths);
  const maxWidth = Math.max(...widths);
  const leftGap = columns[0].start;
  const coverage = columns[columns.length - 1].end - columns[0].start;
  const looksLikeRepeatedLayout =
    coverage > width * 0.84 &&
    leftGap > width * 0.035 &&
    maxWidth / Math.max(1, minWidth) > 1.9;

  if (!looksLikeRepeatedLayout) {
    return columns;
  }

  const step = width / columns.length;
  return Array.from({ length: columns.length }, (_, index) => ({
    start: Math.round(index * step),
    end: Math.round((index + 1) * step),
  }));
}

function normalizeLinePositions(lines, limit) {
  return [...new Set(lines.map((line) => clamp(Math.round(line), 0, limit)))]
    .sort((a, b) => a - b)
    .reduce((acc, line) => {
      if (acc.length === 0 || line - acc[acc.length - 1] > Math.max(8, limit * 0.006)) {
        acc.push(line);
      }
      return acc;
    }, []);
}

function mergeLineCandidates(candidates, gap) {
  const sorted = [...candidates].sort((a, b) => a.pos - b.pos);
  const merged = [];
  for (const candidate of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && candidate.pos - previous.pos <= gap) {
      const strength = previous.strength + candidate.strength;
      previous.pos = (previous.pos * previous.strength + candidate.pos * candidate.strength) / strength;
      previous.strength = strength;
    } else {
      merged.push({ ...candidate });
    }
  }
  return merged;
}

function smoothScores(scores, radius) {
  const smoothed = new Float32Array(scores.length);
  for (let index = 0; index < scores.length; index += 1) {
    let total = 0;
    let count = 0;
    for (let delta = -radius; delta <= radius; delta += 1) {
      const pos = index + delta;
      if (pos >= 0 && pos < scores.length) {
        total += scores[pos];
        count += 1;
      }
    }
    smoothed[index] = total / count;
  }
  return smoothed;
}

function dilateMask(mask, width, height, radiusX, radiusY) {
  const output = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = 0;
      for (let dy = -radiusY; dy <= radiusY && !value; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) {
          continue;
        }
        for (let dx = -radiusX; dx <= radiusX; dx += 1) {
          const xx = x + dx;
          if (xx >= 0 && xx < width && mask[yy * width + xx]) {
            value = 1;
            break;
          }
        }
      }
      output[y * width + x] = value;
    }
  }
  return output;
}

function pixelAt(data, width, x, y) {
  const offset = (y * width + x) * 4;
  return {
    r: data[offset],
    g: data[offset + 1],
    b: data[offset + 2],
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function pixelDistance(data, a, b) {
  return colorDistance(data[a], data[a + 1], data[a + 2], data[b], data[b + 1], data[b + 2]);
}

function colorDistance(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function expandRect(rect, amount, width, height) {
  const x = clamp(rect.x - amount, 0, width - 1);
  const y = clamp(rect.y - amount, 0, height - 1);
  const right = clamp(rect.x + rect.width + amount, x + 1, width);
  const bottom = clamp(rect.y + rect.height + amount, y + 1, height);
  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
}

function insetRect(rect, insetX, insetY) {
  const x = rect.x + insetX;
  const y = rect.y + insetY;
  return {
    x,
    y,
    width: Math.max(1, rect.width - insetX * 2),
    height: Math.max(1, rect.height - insetY * 2),
  };
}

function unionRect(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}

function clipRectToRect(rect, bounds) {
  const x = Math.max(rect.x, bounds.x);
  const y = Math.max(rect.y, bounds.y);
  const right = Math.min(rect.x + rect.width, bounds.x + bounds.width);
  const bottom = Math.min(rect.y + rect.height, bounds.y + bounds.height);
  if (right <= x || bottom <= y) {
    return null;
  }
  return { x, y, width: right - x, height: bottom - y };
}

function intersectionWidth(a, b) {
  return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
}

function rectIou(a, b) {
  const intersection = intersectionArea(a, b);
  return intersection / Math.max(1, rectArea(a) + rectArea(b) - intersection);
}

function overlapRatio(a, b) {
  return intersectionArea(a, b) / Math.max(1, Math.min(rectArea(a), rectArea(b)));
}

function overlapAny(rect, others, threshold) {
  return others.some((other) => overlapRatio(rect, other) > threshold);
}

function isAnalysisPointInsideAnyRect(x, y, rects, analysis) {
  const sourceX = x * analysis.scaleX;
  const sourceY = y * analysis.scaleY;
  return rects.some((layer) => pointInRect(sourceX, sourceY, layer.rect ?? layer));
}

function rectCenterInRect(rect, bounds) {
  return pointInRect(rect.x + rect.width / 2, rect.y + rect.height / 2, bounds);
}

function rectCenterY(rect) {
  return rect.y + rect.height / 2;
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function intersectionArea(a, b) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function intersectionHeight(a, b) {
  return Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
}

function rectArea(rect) {
  return rect.width * rect.height;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
