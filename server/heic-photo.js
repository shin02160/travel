import decode from 'heic-decode';
import jpeg from 'jpeg-js';

const MAX_FILE_BYTES = 24 * 1024 * 1024;
const MAX_PIXELS = 50_000_000;
const MAX_EDGE = 2048;

async function readFile(response) {
  const reader = response.body.getReader();
  try {
    if (Number(response.headers.get('content-length')) > MAX_FILE_BYTES) return null;
    let length = 0;
    const chunks = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return Buffer.concat(chunks, length);
      length += value.byteLength;
      if (length > MAX_FILE_BYTES) return null;
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
}

function resize({ width, height, data }) {
  const scale = MAX_EDGE / Math.max(width, height);
  if (scale >= 1) return { width, height, data };
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const pixels = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sourceY = Math.floor(y * height / h);
    for (let x = 0; x < w; x++) {
      const source = (sourceY * width + Math.floor(x * width / w)) * 4;
      const target = (y * w + x) * 4;
      pixels[target] = data[source];
      pixels[target + 1] = data[source + 1];
      pixels[target + 2] = data[source + 2];
      pixels[target + 3] = 255;
    }
  }
  return { width: w, height: h, data: pixels };
}

export async function heicToJpeg(response) {
  const buffer = await readFile(response);
  if (!buffer) return null;
  const images = await decode.all({ buffer });
  try {
    const image = images[0];
    if (image.width <= 0 || image.height <= 0 || image.width * image.height > MAX_PIXELS) return null;
    return jpeg.encode(resize(await image.decode()), 85).data;
  } finally {
    images.dispose();
  }
}
