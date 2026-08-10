import type { Theme } from "@earendil-works/pi-coding-agent";
import {
  getCapabilities,
  Image,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import { deflateSync } from "node:zlib";

type Rgb = [number, number, number];
type Pixel = "fill" | "shadow" | undefined;

const WIDTH = 19;
const HEIGHT = 16;
const IMAGE_WIDTH = WIDTH * 8;
const IMAGE_HEIGHT = HEIGHT * 8;
const IMAGE_ID = 0x5049;
const RESET = "\x1b[39m\x1b[49m";

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1)
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

const mix = (a: number, b: number, amount: number) =>
  Math.round(a + (b - a) * amount);
const shade = (color: Rgb, amount: number): Rgb =>
  color.map((channel) =>
    amount < 0 ? Math.round(channel * (1 + amount)) : mix(channel, 255, amount),
  ) as Rgb;
const fg = ([r, g, b]: Rgb) => `\x1b[38;2;${r};${g};${b}m`;
const bg = ([r, g, b]: Rgb) => `\x1b[48;2;${r};${g};${b}m`;

const accent = (theme: Theme): Rgb | undefined => {
  const match = theme.getFgAnsi("accent").match(/38;2;(\d+);(\d+);(\d+)m/);
  return match ? (match.slice(1).map(Number) as Rgb) : undefined;
};

const shape = (x: number, y: number, width: number, height: number) => {
  const gx = (x / width) * WIDTH;
  const gy = (y / height) * HEIGHT;
  return (
    (gy < 3 && gx < WIDTH) ||
    (gy >= 3 && gy < 15 && ((gx >= 5 && gx < 9) || (gx >= 11 && gx < 15)))
  );
};

const pixel = (x: number, y: number, width: number, height: number): Pixel => {
  if (shape(x, y, width, height)) return "fill";
  if (shape(x - width / WIDTH / 2, y - height / HEIGHT / 2, width, height))
    return "shadow";
};

const shimmerColor = (
  base: Rgb,
  x: number,
  y: number,
  width: number,
  height: number,
  sweep: number,
  shadow: boolean,
) => {
  const center = sweep - (y / Math.max(height - 1, 1)) * 0.48;
  const distance = Math.abs(x / Math.max(width - 1, 1) - center);
  const intensity =
    distance <= 0.2 ? 0.5 * (1 + Math.cos((Math.PI * distance) / 0.2)) : 0;
  return shade(
    shadow ? shade(base, -0.45) : base,
    intensity * (shadow ? 0.25 : 0.45),
  );
};

export const centerText = (text: string, width: number, offset = 0) => {
  const padding = " ".repeat(
    Math.max(0, Math.floor((width - visibleWidth(text)) / 2) + offset),
  );
  return truncateToWidth(padding + text, width, "");
};

export const shimmerText = (text: string, theme: Theme, sweep: number) => {
  const base = accent(theme);
  if (!base) return theme.fg("accent", text);
  return [...text]
    .map((character, index, characters) => {
      if (character === " ") return character;
      return `${fg(shimmerColor(base, index, 0, characters.length, 1, sweep, false))}${character}\x1b[39m`;
    })
    .join("");
};

export const usesPixelLogo = () =>
  process.env.HERDR_ENV !== "1" && Boolean(getCapabilities().images);

const renderHalfCell = (base: Rgb, sweep: number, width: number) =>
  Array.from({ length: HEIGHT / 2 }, (_, row) => {
    const topY = row * 2;
    const bottomY = topY + 1;
    let line = "";
    for (let x = 0; x < WIDTH; x += 1) {
      const top = pixel(x, topY, WIDTH, HEIGHT);
      const bottom = pixel(x, bottomY, WIDTH, HEIGHT);
      if (!top && !bottom) line += " ";
      else if (top && bottom)
        line +=
          fg(
            shimmerColor(base, x, topY, WIDTH, HEIGHT, sweep, top === "shadow"),
          ) +
          bg(
            shimmerColor(
              base,
              x,
              bottomY,
              WIDTH,
              HEIGHT,
              sweep,
              bottom === "shadow",
            ),
          ) +
          `▀${RESET}`;
      else if (top)
        line +=
          fg(
            shimmerColor(base, x, topY, WIDTH, HEIGHT, sweep, top === "shadow"),
          ) + `▀${RESET}`;
      else
        line +=
          fg(
            shimmerColor(
              base,
              x,
              bottomY,
              WIDTH,
              HEIGHT,
              sweep,
              bottom === "shadow",
            ),
          ) + `▄${RESET}`;
    }
    return centerText(line, width);
  });

const chunk = (name: string, data: Buffer) => {
  const type = Buffer.from(name);
  const body = Buffer.concat([type, data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0);
  type.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return output;
};

const png = (pixels: Buffer) => {
  const scanlines = Buffer.alloc((IMAGE_WIDTH * 4 + 1) * IMAGE_HEIGHT);
  for (let y = 0; y < IMAGE_HEIGHT; y += 1)
    pixels.copy(
      scanlines,
      y * (IMAGE_WIDTH * 4 + 1) + 1,
      y * IMAGE_WIDTH * 4,
      (y + 1) * IMAGE_WIDTH * 4,
    );
  const header = Buffer.alloc(13);
  header.writeUInt32BE(IMAGE_WIDTH, 0);
  header.writeUInt32BE(IMAGE_HEIGHT, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines, { level: 1 })),
    chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
};

const renderPixels = (base: Rgb, sweep: number) => {
  const pixels = Buffer.alloc(IMAGE_WIDTH * IMAGE_HEIGHT * 4);
  for (let y = 0; y < IMAGE_HEIGHT; y += 1) {
    for (let x = 0; x < IMAGE_WIDTH; x += 1) {
      const value = pixel(x, y, IMAGE_WIDTH, IMAGE_HEIGHT);
      if (!value) continue;
      const offset = (y * IMAGE_WIDTH + x) * 4;
      pixels.set(
        [
          ...shimmerColor(
            base,
            x,
            y,
            IMAGE_WIDTH,
            IMAGE_HEIGHT,
            sweep,
            value === "shadow",
          ),
          255,
        ],
        offset,
      );
    }
  }
  return png(pixels);
};

export const renderAnimatedLogo = (
  theme: Theme,
  sweep: number,
  width: number,
) => {
  const base = accent(theme);
  if (!base) return [centerText(theme.fg("accent", "π"), width)];
  if (!usesPixelLogo()) return renderHalfCell(base, sweep, width);

  const image = new Image(
    renderPixels(base, sweep),
    "image/png",
    {
      fallbackColor: (text) => theme.fg("muted", text),
    },
    {
      maxWidthCells: WIDTH,
      maxHeightCells: HEIGHT / 2,
      imageId: IMAGE_ID,
    },
    { widthPx: IMAGE_WIDTH, heightPx: IMAGE_HEIGHT },
  );
  const lines = image.render(width);
  lines[0] =
    " ".repeat(Math.max(0, Math.floor((width - WIDTH) / 2))) + (lines[0] ?? "");
  return lines;
};
