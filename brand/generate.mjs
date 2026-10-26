// Renders every app icon from `logo-master.png` and `bg-only.svg` beside this
// file. From the mobile root: `npm run icons`.
import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MOBILE = join(HERE, "..");
// The admin is a separate repo checked out beside this one. It shares the
// mark, so it gets its icons from the same run — when it is there. Someone
// who cloned only the app still gets a working generator.
const ADMIN = join(MOBILE, "..", "admin");

// sharp is a ~30MB native library that this script needs a few times a year,
// so it is nobody's dependency: take it wherever it already exists. Normal
// resolution first, so `npm i -D sharp` is all it takes if the server tree
// ever moves.
const require = createRequire(import.meta.url);
const sharp = (() => {
  for (const id of ["sharp", join(MOBILE, "..", "server", "node_modules", "sharp")]) {
    try {
      return require(id);
    } catch {}
  }
  throw new Error("brand/generate.mjs needs sharp — run `npm i -D sharp` here.");
})();

/** Resolve an output path, creating its folder. @returns absolute path */
const out = (root, rel) => {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  return path;
};
const to = (rel) => out(MOBILE, rel);
const toAdmin = (rel) => out(ADMIN, rel);

// ─── the mark ────────────────────────────────────────────────────────────────
// logo-master.png is the delivered logo: the mark over a teal field, with the
// GROWEN CITY wordmark beneath it. Icons want the mark alone — a wordmark is
// illegible at 48px — so it is cut out here rather than kept as a second file
// that could drift from the master.
//
// The field is teal (blue channel above red) and the mark is gold (red well
// above blue), so red-minus-blue separates them cleanly and, because it rides
// through zero across the logo's own antialiased edge, it doubles as the alpha
// ramp. It also drops the drop shadow, which is darker than the field but
// still teal.
const KEY_LO = 2; //   r-b at or below this is field: fully transparent
const KEY_HI = 26; //  r-b at or above this is mark: fully opaque

/** The mark cut off its field, trimmed to its own bounds. @returns sharp input */
async function cutMark() {
  const { data, info } = await sharp(join(HERE, "logo-master.png"))
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;

  // The wordmark sits below the mark with clear field between them; only the
  // band above that gap counts towards the mark's bounds.
  const GAP = 700;

  const out = Buffer.alloc(w * h * 4);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * c;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const a = Math.round(
        255 * Math.min(1, Math.max(0, (r - b - KEY_LO) / (KEY_HI - KEY_LO))),
      );
      const o = (y * w + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a;
      // Bounds off the solid core only: the ramp's tail would pull the box out
      // to every faint warm speck in the field's noise.
      if (a > 128 && y < GAP) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }

  return sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .png()
    .toBuffer();
}

const MARK = await cutMark();
const markMeta = await sharp(MARK).metadata();

/**
 * The mark scaled to fit a box `inner` on its longer side, centred on a
 * transparent canvas of `canvas`. The master is ~450×490, so anything past
 * 1024 is an upscale — kernel and a light sharpen keep the metal edges crisp
 * rather than waxy.
 */
async function markOn(inner, canvas, { crisp = true } = {}) {
  let mark = sharp(MARK).resize(inner, inner, { fit: "inside", kernel: "lanczos3" });
  if (crisp) mark = mark.sharpen({ sigma: 0.7 });
  mark = await mark.png().toBuffer();
  const { width, height } = await sharp(mark).metadata();
  return sharp({
    create: {
      width: canvas, height: canvas, channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([
    {
      input: mark,
      top: Math.round((canvas - height) / 2),
      left: Math.round((canvas - width) / 2),
    },
  ]);
}

// ─── the field ───────────────────────────────────────────────────────────────
// density, not resize-from-small: librsvg rasterises at this DPI first, so a
// high value is what keeps the 1024px icons free of resampling softness.
const field = (size, rx = 0) => {
  const svg = readFileSync(join(HERE, "bg-only.svg"), "utf8").replace(
    '<rect width="64" height="64"',
    `<rect width="64" height="64" rx="${rx}"`,
  );
  return sharp(Buffer.from(svg), { density: 2048 }).resize(size, size);
};

/**
 * The icon tile: the mark on the brand field, at `fill` of the tile's width.
 *
 * Square tiles drop their alpha channel — the field is opaque anyway, and the
 * App Store rejects an icon that carries one. A rounded tile keeps it, since
 * the corners it rounds off are the transparency.
 */
async function tile(size, fill = 0.72, rx = 0) {
  const mark = await (await markOn(Math.round(size * fill), size))
    .png()
    .toBuffer();
  const out = field(size, rx).composite([{ input: mark }]);
  return (rx ? out : out.removeAlpha()).png({ compressionLevel: 9 });
}

// ─── outputs ─────────────────────────────────────────────────────────────────
await (await tile(1024)).toFile(to("assets/icon.png"));
await (await tile(1024)).toFile(to("assets/images/icon.png"));
await (await tile(512)).toFile(to("assets/images/brand-emblem.png"));

// Browsers draw a favicon at 16px and do not mask it, so it brings its own
// rounded corners and wears the mark a little larger.
await (await tile(48, 0.82, 15)).toFile(to("assets/images/favicon.png"));

// The mark alone, gold on nothing: splash, Android foreground, and the header
// chip on surfaces that bring their own background.
await (await markOn(1024, 1024)).png({ compressionLevel: 9 })
  .toFile(to("assets/images/splash-emblem.png"));
await (await markOn(512, 512)).png({ compressionLevel: 9 })
  .toFile(to("assets/images/brand-mark.png"));

// Android note: the foreground and the monochrome place the mark at 700/1024
// of the canvas. Launcher masks crop the outer third, so foreground content
// has to stay inside the central ~66% — if you enlarge the mark, check it
// against a circular mask before shipping.
await field(1024).png({ compressionLevel: 9 })
  .toFile(to("assets/images/android-icon-background.png"));
await (await markOn(700, 1024)).png({ compressionLevel: 9 })
  .toFile(to("assets/images/android-icon-foreground.png"));

// Android 13 themed icons: the launcher tints a silhouette, so colour is
// thrown away and only the mark's alpha carries the shape — which keeps the
// house and its window as outlines rather than flattening them into a block.
// No sharpen here: its ringing survives the alpha cutoff below as a ragged
// fringe, which colour would have hidden and a flat tint does not.
const silhouette = await (await markOn(700, 1024, { crisp: false }))
  .ensureAlpha()
  .raw()
  .toBuffer();
for (let i = 0; i < silhouette.length; i += 4) {
  silhouette[i] = 255; silhouette[i + 1] = 255; silhouette[i + 2] = 255;
  // The ramp's faint tail reads as grey haze once the launcher tints it.
  silhouette[i + 3] = silhouette[i + 3] < 48 ? 0 : silhouette[i + 3];
}
await sharp(silhouette, { raw: { width: 1024, height: 1024, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toFile(to("assets/images/android-icon-monochrome.png"));

// ─── the admin, when it is checked out beside us ─────────────────────────────
if (existsSync(ADMIN)) {
  await (await tile(512)).toFile(toAdmin("public/emblem.png"));

  // Its SVG favicon: a vector frame around the raster mark, so the tab strip
  // gets the real logo instead of a redrawn approximation of it. 128px and a
  // palette keep the inlined mark to a few tens of KB — a favicon is fetched
  // on every cold load, and nothing ever draws this one above 64px.
  const inline = (
    await (await markOn(128, 128)).png({ palette: true, quality: 90 }).toBuffer()
  ).toString("base64");
  writeFileSync(
    toAdmin("public/favicon.svg"),
    readFileSync(join(HERE, "bg-only.svg"), "utf8")
      .replace('<rect width="64" height="64"', '<rect width="64" height="64" rx="15"')
      .replace(
        "</svg>",
        `  <image x="5.8" y="5.8" width="52.4" height="52.4" href="data:image/png;base64,${inline}"/>\n</svg>\n`,
      ),
  );
}

console.log(
  `brand assets regenerated from a ${markMeta.width}×${markMeta.height} mark` +
    (existsSync(ADMIN) ? "" : " — admin/ not found beside us, skipped its two"),
);
