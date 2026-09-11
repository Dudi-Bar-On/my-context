// @basis TASK-pixel-parity-render-app-and-mockup-at-one-viewport-and-diff, CONST-zero-runtime-dependencies, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **A pixel diff that says WHAT differs, written with nothing added to
 * `package.json`.**
 *
 * ── WHY THIS FILE AND NOT A LIBRARY ────────────────────────────────────────
 *
 * `CONST-zero-runtime-dependencies` is about what ships, and `pixelmatch` and
 * `pngjs` would be `devDependencies` rather than runtime ones — but this
 * project enumerates those too, and adding one is the owner's call, not a
 * lane's. It also turns out to be unnecessary twice over:
 *
 *   - PNG is DEFLATE in a chunk wrapper, and `node:zlib` is built in. A
 *     decoder for the one shape Chromium emits — colour type 2 or 6, bit depth
 *     8, non-interlaced — is the hundred lines below.
 *   - `pixelmatch` answers "how many pixels differ", and this task's own body
 *     says that number is not the deliverable: *"a tolerance chosen to make a
 *     run green is a gate that measures nothing."* What is needed is a diff
 *     that separates a rasterisation fringe from an eight-pixel misalignment,
 *     and then says WHERE the misalignment is. That is not a threshold, it is
 *     a shape test, and it is the substance of this file.
 *
 * ── HOW A REAL DIFFERENCE IS TOLD FROM ANTIALIASING ────────────────────────
 *
 * Two properties, and neither of them is a tolerance dial:
 *
 *   1. **AMPLITUDE.** Subpixel text rasterisation moves a channel by a little,
 *      along a glyph edge. A wrong colour, a missing border or a shifted block
 *      moves it by a lot, across a region. `faintDelta` separates the two, and
 *      it is not chosen to make anything pass — `pixel-parity.spec.ts` MEASURES
 *      it by rendering the same unchanged mockup in both browser projects and
 *      reading what the engines disagree about with nothing else varying.
 *
 *   2. **SHAPE, which is the half a threshold cannot do.** An antialiasing
 *      difference is ONE PIXEL WIDE by construction: it lives on the boundary
 *      between glyph and ground, so its differing pixels have differing
 *      neighbours on one side and identical neighbours on the other. A real
 *      difference is SOLID — a band, a block, a bar. So every strongly
 *      differing pixel is required to have at least `minNeighbours` of its
 *      eight neighbours also differ strongly, which erases a one-pixel fringe
 *      entirely and leaves a 2px-or-thicker region untouched.
 *
 * Erosion alone would also erase a genuine hairline (a 1px border present on
 * one side and absent on the other). That case is not lost: it survives as a
 * `strong` count with zero `solid` pixels, which this file reports separately
 * and the spec reads as "a hairline, not a block".
 *
 * ── AND THEN IT SAYS WHERE ─────────────────────────────────────────────────
 *
 * Solid pixels are flood-filled into regions, the regions are merged when
 * their boxes nearly touch (a shifted line of text is one finding, not forty),
 * and each survivor reports its box and the MEAN COLOUR ON EACH SIDE. "A
 * 214×18 region at (0, 46) is #1b1f27 in the app and #151922 in the mockup" is
 * a sentence someone can act on. "412,003 pixels differ" is not.
 */
import { createHash } from 'node:crypto';
import { deflateSync, inflateSync } from 'node:zlib';

/** 8-bit RGBA, row-major, `width * height * 4` bytes. */
export interface Raster {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

/* ═══ PNG ═════════════════════════════════════════════════════════════════ */

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = ((): Int32Array => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** The Paeth predictor, spelled as the specification spells it. */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Decode the one PNG shape a browser screenshot is.
 *
 * **It refuses loudly rather than guessing.** A decoder that quietly mishandles
 * an interlaced or 16-bit image would produce a diff of its own arithmetic,
 * and this project has recorded the cost of a gate measuring itself often
 * enough that the refusal is worth more than the coverage.
 */
export function decodePng(buffer: Buffer): Raster {
  if (!buffer.subarray(0, 8).equals(PNG_MAGIC)) throw new Error('not a PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colour = 0;
  const idat: Buffer[] = [];
  let palette: Uint8Array | null = null;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8]!;
      colour = body[9]!;
      const interlace = body[12]!;
      if (depth !== 8) throw new Error(`PNG bit depth ${depth} is not supported (only 8)`);
      if (interlace !== 0) throw new Error('interlaced PNG is not supported');
      if (colour !== 2 && colour !== 6 && colour !== 3 && colour !== 0) {
        throw new Error(`PNG colour type ${colour} is not supported`);
      }
    } else if (type === 'PLTE') {
      palette = new Uint8Array(body);
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(body));
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  const channels = colour === 6 ? 4 : colour === 2 ? 3 : 1;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const lines = new Uint8Array(height * stride);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[source]!;
    source += 1;
    const row = y * stride;
    const prior = row - stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[source + x]!;
      const a = x >= channels ? lines[row + x - channels]! : 0;
      const b = y > 0 ? lines[prior + x]! : 0;
      const c = x >= channels && y > 0 ? lines[prior + x - channels]! : 0;
      let out: number;
      switch (filter) {
        case 0: out = value; break;
        case 1: out = value + a; break;
        case 2: out = value + b; break;
        case 3: out = value + ((a + b) >> 1); break;
        case 4: out = value + paeth(a, b, c); break;
        default: throw new Error(`unknown PNG filter ${filter} on row ${y}`);
      }
      lines[row + x] = out & 0xff;
    }
    source += stride;
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0, p = 0; i < width * height; i += 1, p += 4) {
    if (channels === 4) {
      data[p] = lines[i * 4]!; data[p + 1] = lines[i * 4 + 1]!;
      data[p + 2] = lines[i * 4 + 2]!; data[p + 3] = lines[i * 4 + 3]!;
    } else if (channels === 3) {
      data[p] = lines[i * 3]!; data[p + 1] = lines[i * 3 + 1]!;
      data[p + 2] = lines[i * 3 + 2]!; data[p + 3] = 255;
    } else if (colour === 3 && palette !== null) {
      const index = lines[i]! * 3;
      data[p] = palette[index]!; data[p + 1] = palette[index + 1]!;
      data[p + 2] = palette[index + 2]!; data[p + 3] = 255;
    } else {
      data[p] = lines[i]!; data[p + 1] = lines[i]!; data[p + 2] = lines[i]!; data[p + 3] = 255;
    }
  }
  return { width, height, data };
}

function chunk(type: string, body: Uint8Array): Buffer {
  const out = Buffer.alloc(body.length + 12);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(body).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

/** Write an RGBA raster back out, so a finding has a picture beside it. */
export function encodePng(raster: Raster): Buffer {
  const { width, height, data } = raster;
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * stride, stride)
      .copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    PNG_MAGIC, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/* ═══ THE DIFF ════════════════════════════════════════════════════════════ */

export interface Rect {
  readonly x: number; readonly y: number;
  readonly width: number; readonly height: number;
}

export interface Cluster extends Rect {
  /** Solid pixels inside the box — never the box's area, which is larger. */
  readonly pixels: number;
  /** Mean colour of those pixels on each side, `#rrggbb`. */
  readonly left: string;
  readonly right: string;
}

export interface DiffResult {
  /** The overlap actually compared. */
  readonly width: number;
  readonly height: number;
  readonly compared: number;
  /** Sizes, when they disagree — itself a finding, and the diff is of the overlap. */
  readonly sizes: { readonly left: Rect; readonly right: Rect } | null;
  /** Any channel moved at all. The number this file exists to not report alone. */
  readonly different: number;
  /** Moved by no more than `faintDelta`: the rasterisation floor. */
  readonly faint: number;
  /** Moved by more than `faintDelta`. */
  readonly strong: number;
  /** Strong AND part of a region at least two pixels thick. What a person sees. */
  readonly solid: number;
  /** Where the solid pixels are, largest first. */
  readonly clusters: readonly Cluster[];
  /** The largest channel delta anywhere, for a run that reports nothing solid. */
  readonly peak: number;
}

export interface DiffOptions {
  /**
   * The amplitude below which a difference is called rasterisation. MEASURED by
   * the caller against an unchanged page rendered by both engines, never picked.
   */
  readonly faintDelta?: number;
  /** How many of the eight neighbours must also differ strongly. Default 5. */
  readonly minNeighbours?: number;
  /** Regions smaller than this are dropped as speckle. Default 30 pixels. */
  readonly minCluster?: number;
  /** Boxes within this many pixels of each other are one finding. Default 8. */
  readonly mergeGap?: number;
  /** At most this many clusters are reported, largest first. Default 12. */
  readonly maxClusters?: number;
}

function hex(r: number, g: number, b: number): string {
  const two = (v: number): string => Math.round(v).toString(16).padStart(2, '0');
  return `#${two(r)}${two(g)}${two(b)}`;
}

/**
 * Compare two rasters over their common top-left overlap.
 *
 * The overlap rather than a failure, because DIFFERENT SIZES ARE THEMSELVES
 * THE FINDING and refusing to diff would throw it away: `sizes` reports it and
 * the pixels that do overlap are still measured.
 */
export function diffRasters(
  left: Raster, right: Raster, options: DiffOptions = {},
): DiffResult {
  const faintDelta = options.faintDelta ?? 12;
  const minNeighbours = options.minNeighbours ?? 5;
  const minCluster = options.minCluster ?? 30;
  const mergeGap = options.mergeGap ?? 8;
  const maxClusters = options.maxClusters ?? 12;

  const width = Math.min(left.width, right.width);
  const height = Math.min(left.height, right.height);
  const sizes = left.width === right.width && left.height === right.height
    ? null
    : {
      left: { x: 0, y: 0, width: left.width, height: left.height },
      right: { x: 0, y: 0, width: right.width, height: right.height },
    };

  const strongMask = new Uint8Array(width * height);
  let different = 0;
  let faint = 0;
  let strong = 0;
  let peak = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const la = (y * left.width + x) * 4;
      const ra = (y * right.width + x) * 4;
      const dr = Math.abs(left.data[la]! - right.data[ra]!);
      const dg = Math.abs(left.data[la + 1]! - right.data[ra + 1]!);
      const db = Math.abs(left.data[la + 2]! - right.data[ra + 2]!);
      const delta = dr > dg ? (dr > db ? dr : db) : (dg > db ? dg : db);
      if (delta === 0) continue;
      different += 1;
      if (delta > peak) peak = delta;
      if (delta <= faintDelta) { faint += 1; continue; }
      strong += 1;
      strongMask[y * width + x] = 1;
    }
  }

  // EROSION — the shape half. A one-pixel-wide fringe has too few strong
  // neighbours and vanishes; a band, a block or a bar keeps every interior
  // pixel. See this file's header.
  const solidMask = new Uint8Array(width * height);
  let solid = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (strongMask[y * width + x] !== 1) continue;
      let neighbours = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (strongMask[ny * width + nx] === 1) neighbours += 1;
        }
      }
      if (neighbours >= minNeighbours) { solidMask[y * width + x] = 1; solid += 1; }
    }
  }

  // FLOOD FILL, iterative — a recursive fill over a 1280×720 region is a stack
  // overflow rather than a measurement.
  interface Raw { x0: number; y0: number; x1: number; y1: number; pixels: number[] }
  const seen = new Uint8Array(width * height);
  const raws: Raw[] = [];
  const stack: number[] = [];
  for (let start = 0; start < solidMask.length; start += 1) {
    if (solidMask[start] !== 1 || seen[start] === 1) continue;
    seen[start] = 1;
    stack.length = 0;
    stack.push(start);
    const group: Raw = {
      x0: start % width, y0: (start / width) | 0,
      x1: start % width, y1: (start / width) | 0, pixels: [],
    };
    while (stack.length > 0) {
      const index = stack.pop()!;
      const x = index % width;
      const y = (index / width) | 0;
      group.pixels.push(index);
      if (x < group.x0) group.x0 = x;
      if (x > group.x1) group.x1 = x;
      if (y < group.y0) group.y0 = y;
      if (y > group.y1) group.y1 = y;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const n = ny * width + nx;
          if (solidMask[n] !== 1 || seen[n] === 1) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    if (group.pixels.length >= minCluster) raws.push(group);
  }

  // MERGE — a shifted line of text is one finding, not forty glyph boxes.
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < raws.length; i += 1) {
      for (let j = i + 1; j < raws.length; j += 1) {
        const a = raws[i]!;
        const b = raws[j]!;
        const apart = a.x1 + mergeGap < b.x0 || b.x1 + mergeGap < a.x0
          || a.y1 + mergeGap < b.y0 || b.y1 + mergeGap < a.y0;
        if (apart) continue;
        a.x0 = Math.min(a.x0, b.x0); a.y0 = Math.min(a.y0, b.y0);
        a.x1 = Math.max(a.x1, b.x1); a.y1 = Math.max(a.y1, b.y1);
        // A LOOP, never `push(...b.pixels)`. Spreading an array into arguments
        // is bounded by the ARGUMENT COUNT LIMIT, not by memory: measured here
        // on 2026-09-11, two gradient regions of ~10,000 pixels each merged
        // fine and a later pair did not — `RangeError: Maximum call stack size
        // exceeded`, from a line that looks like a copy. The failure is in the
        // size of the data, so it appears only on the screens worth measuring.
        for (const pixel of b.pixels) a.pixels.push(pixel);
        raws.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }

  raws.sort((a, b) => b.pixels.length - a.pixels.length);
  const clusters: Cluster[] = raws.slice(0, maxClusters).map((group) => {
    let lr = 0; let lg = 0; let lb = 0; let rr = 0; let rg = 0; let rb = 0;
    for (const index of group.pixels) {
      const x = index % width;
      const y = (index / width) | 0;
      const la = (y * left.width + x) * 4;
      const ra = (y * right.width + x) * 4;
      lr += left.data[la]!; lg += left.data[la + 1]!; lb += left.data[la + 2]!;
      rr += right.data[ra]!; rg += right.data[ra + 1]!; rb += right.data[ra + 2]!;
    }
    const n = group.pixels.length;
    return {
      x: group.x0, y: group.y0,
      width: group.x1 - group.x0 + 1, height: group.y1 - group.y0 + 1,
      pixels: n,
      left: hex(lr / n, lg / n, lb / n),
      right: hex(rr / n, rg / n, rb / n),
    };
  });

  return {
    width, height, compared: width * height, sizes,
    different, faint, strong, solid, clusters, peak,
  };
}

/**
 * The two pictures side by side with the solid regions boxed in red, for the
 * owner's review. Faint pixels are NOT drawn: this project's whole complaint
 * about a diff image is that a red haze over every glyph edge buries the one
 * band that matters.
 */
export function annotate(left: Raster, right: Raster, clusters: readonly Cluster[]): Raster {
  const gap = 8;
  const width = left.width + gap + right.width;
  const height = Math.max(left.height, right.height);
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4 + 0] = 24; data[i * 4 + 1] = 24; data[i * 4 + 2] = 28; data[i * 4 + 3] = 255;
  }
  const blit = (source: Raster, dx: number): void => {
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const s = (y * source.width + x) * 4;
        const d = (y * width + x + dx) * 4;
        data[d] = source.data[s]!; data[d + 1] = source.data[s + 1]!;
        data[d + 2] = source.data[s + 2]!; data[d + 3] = 255;
      }
    }
  };
  blit(left, 0);
  blit(right, left.width + gap);
  const box = (rect: Rect, dx: number): void => {
    const paint = (x: number, y: number): void => {
      if (x < 0 || y < 0 || x + dx >= width || y >= height) return;
      const d = (y * width + x + dx) * 4;
      data[d] = 255; data[d + 1] = 64; data[d + 2] = 64; data[d + 3] = 255;
    };
    for (let x = rect.x - 1; x <= rect.x + rect.width; x += 1) {
      paint(x, rect.y - 1); paint(x, rect.y + rect.height);
    }
    for (let y = rect.y - 1; y <= rect.y + rect.height; y += 1) {
      paint(rect.x - 1, y); paint(rect.x + rect.width, y);
    }
  };
  for (const cluster of clusters) { box(cluster, 0); box(cluster, left.width + gap); }
  return { width, height, data };
}

/** A stable name for a raster, so two runs can be compared without the bytes. */
export function rasterDigest(raster: Raster): string {
  return createHash('sha256').update(raster.data).digest('hex').slice(0, 16);
}

/** Crop, for comparing one region of a screen rather than all of it. */
export function crop(raster: Raster, rect: Rect): Raster {
  const x0 = Math.max(0, Math.round(rect.x));
  const y0 = Math.max(0, Math.round(rect.y));
  const width = Math.max(0, Math.min(Math.round(rect.width), raster.width - x0));
  const height = Math.max(0, Math.min(Math.round(rect.height), raster.height - y0));
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const s = ((y + y0) * raster.width + (x + x0)) * 4;
      const d = (y * width + x) * 4;
      data[d] = raster.data[s]!; data[d + 1] = raster.data[s + 1]!;
      data[d + 2] = raster.data[s + 2]!; data[d + 3] = raster.data[s + 3]!;
    }
  }
  return { width, height, data };
}
