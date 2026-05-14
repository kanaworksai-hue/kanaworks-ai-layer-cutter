const RGB_CHANNELS = [
  { id: 0, offset: 0 },
  { id: 1, offset: 1 },
  { id: 2, offset: 2 },
  { id: -1, offset: 3 },
];

class Writer {
  constructor() {
    this.parts = [];
    this.length = 0;
  }

  writeU8(value) {
    const bytes = new Uint8Array(1);
    bytes[0] = value & 255;
    this.writeBytes(bytes);
  }

  writeU16(value) {
    const bytes = new Uint8Array(2);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, value, false);
    this.writeBytes(bytes);
  }

  writeI16(value) {
    const bytes = new Uint8Array(2);
    const view = new DataView(bytes.buffer);
    view.setInt16(0, value, false);
    this.writeBytes(bytes);
  }

  writeU32(value) {
    const bytes = new Uint8Array(4);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, value, false);
    this.writeBytes(bytes);
  }

  writeI32(value) {
    const bytes = new Uint8Array(4);
    const view = new DataView(bytes.buffer);
    view.setInt32(0, value, false);
    this.writeBytes(bytes);
  }

  writeAscii(text) {
    const bytes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index += 1) {
      bytes[index] = text.charCodeAt(index) & 255;
    }
    this.writeBytes(bytes);
  }

  writeBytes(bytes) {
    if (!bytes || bytes.length === 0) {
      return;
    }
    this.parts.push(bytes);
    this.length += bytes.length;
  }

  toUint8Array() {
    const bytes = new Uint8Array(this.length);
    let offset = 0;
    for (const part of this.parts) {
      bytes.set(part, offset);
      offset += part.length;
    }
    return bytes;
  }
}

export function encodePsd({ width, height, composite, layers }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("Invalid PSD size.");
  }

  const compositePixels = normalizePixels(composite, width, height, "composite");
  const normalizedLayers = layers.map((layer) => normalizeLayer(layer, width, height));
  const file = new Writer();

  writeHeader(file, width, height);
  file.writeU32(0);
  file.writeU32(0);
  writeLayerAndMaskInfo(file, normalizedLayers);
  writeCompositeImage(file, compositePixels, width, height);

  return file.toUint8Array().buffer;
}

function writeHeader(file, width, height) {
  file.writeAscii("8BPS");
  file.writeU16(1);
  file.writeBytes(new Uint8Array(6));
  file.writeU16(3);
  file.writeU32(height);
  file.writeU32(width);
  file.writeU16(8);
  file.writeU16(3);
}

function writeLayerAndMaskInfo(file, layers) {
  const layerInfo = new Writer();

  if (layers.length > 0) {
    layerInfo.writeI16(layers.length);
    for (const layer of layers) {
      writeLayerRecord(layerInfo, layer);
    }
    for (const layer of layers) {
      writeLayerChannelData(layerInfo, layer);
    }
    if (layerInfo.length % 2 === 1) {
      layerInfo.writeU8(0);
    }
  }

  const layerAndMaskInfo = new Writer();
  layerAndMaskInfo.writeU32(layerInfo.length);
  layerAndMaskInfo.writeBytes(layerInfo.toUint8Array());
  layerAndMaskInfo.writeU32(0);
  if (layerAndMaskInfo.length % 2 === 1) {
    layerAndMaskInfo.writeU8(0);
  }

  file.writeU32(layerAndMaskInfo.length);
  file.writeBytes(layerAndMaskInfo.toUint8Array());
}

function writeLayerRecord(writer, layer) {
  writer.writeI32(layer.y);
  writer.writeI32(layer.x);
  writer.writeI32(layer.y + layer.height);
  writer.writeI32(layer.x + layer.width);
  writer.writeU16(RGB_CHANNELS.length);

  const channelLength = 2 + layer.width * layer.height;
  for (const channel of RGB_CHANNELS) {
    writer.writeI16(channel.id);
    writer.writeU32(channelLength);
  }

  writer.writeAscii("8BIM");
  writer.writeAscii("norm");
  writer.writeU8(layer.opacity);
  writer.writeU8(0);
  writer.writeU8(layer.visible ? 0 : 2);
  writer.writeU8(0);

  const extra = new Writer();
  extra.writeU32(0);
  extra.writeU32(0);
  writePascalLayerName(extra, layer.name);
  writeUnicodeLayerName(extra, layer.name);

  writer.writeU32(extra.length);
  writer.writeBytes(extra.toUint8Array());
}

function writeLayerChannelData(writer, layer) {
  for (const channel of RGB_CHANNELS) {
    writer.writeU16(0);
    writeChannelPlane(writer, layer.pixels, layer.width, layer.height, channel.offset);
  }
}

function writeCompositeImage(writer, pixels, width, height) {
  writer.writeU16(0);
  writeChannelPlane(writer, pixels, width, height, 0);
  writeChannelPlane(writer, pixels, width, height, 1);
  writeChannelPlane(writer, pixels, width, height, 2);
}

function writeChannelPlane(writer, pixels, width, height, channelOffset) {
  const plane = new Uint8Array(width * height);
  for (let pixel = 0, offset = channelOffset; pixel < plane.length; pixel += 1, offset += 4) {
    plane[pixel] = pixels[offset];
  }
  writer.writeBytes(plane);
}

function writePascalLayerName(writer, name) {
  const fallback = asciiFallback(name).slice(0, 255);
  writer.writeU8(fallback.length);
  writer.writeAscii(fallback);
  const used = 1 + fallback.length;
  const padding = (4 - (used % 4)) % 4;
  if (padding) {
    writer.writeBytes(new Uint8Array(padding));
  }
}

function writeUnicodeLayerName(writer, name) {
  const data = new Writer();
  data.writeU32(name.length);
  for (let index = 0; index < name.length; index += 1) {
    data.writeU16(name.charCodeAt(index));
  }
  writeTaggedBlock(writer, "luni", data.toUint8Array());
}

function writeTaggedBlock(writer, key, data) {
  writer.writeAscii("8BIM");
  writer.writeAscii(key);
  writer.writeU32(data.length);
  writer.writeBytes(data);
  if (data.length % 2 === 1) {
    writer.writeU8(0);
  }
}

function asciiFallback(value) {
  const text = String(value || "Layer").trim() || "Layer";
  return text.replace(/[^\x20-\x7e]/g, "_");
}

function normalizeLayer(layer, documentWidth, documentHeight) {
  const x = clampInteger(layer.x, 0, documentWidth - 1);
  const y = clampInteger(layer.y, 0, documentHeight - 1);
  const width = clampInteger(layer.width, 1, documentWidth - x);
  const height = clampInteger(layer.height, 1, documentHeight - y);

  return {
    name: String(layer.name || "Layer"),
    x,
    y,
    width,
    height,
    opacity: clampInteger(layer.opacity ?? 255, 0, 255),
    visible: layer.visible !== false,
    pixels: normalizePixels(layer.pixels, width, height, layer.name || "layer"),
  };
}

function normalizePixels(input, width, height, label) {
  const data = input?.data ?? input;
  if (!data || data.length !== width * height * 4) {
    throw new Error(`Invalid pixel data for ${label}.`);
  }
  return data;
}

function clampInteger(value, min, max) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) {
    return min;
  }
  return Math.min(max, Math.max(min, number));
}
