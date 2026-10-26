# Brand assets — the Growen City mark

Every icon in the apps is rendered from the two sources in this folder. Replace
a source, re-run the generator below, and all platforms stay in step. Do not
retouch the generated PNGs by hand: they are build output, and the next
regeneration overwrites them.

## The mark

Gold towers behind a pitched-roof house, with a veined leaf across the front
and a swoosh sweeping under both — the logo as delivered, not an
interpretation of it. Earlier versions of these icons carried a hand-drawn
leaf alone; the real mark is the leaf *and* the buildings, and approximating
that in paths would be a different mark wearing the brand's colours.

| Colour | Hex | Where |
| --- | --- | --- |
| Field, lit | `#1D4247` | tile gradient, top-left |
| Field, mid | `#112E33` | tile gradient — and `#102E33` is the splash / adaptive-icon background |
| Field, deep | `#0A1C20` | tile gradient, bottom-right — and the dark splash |

The mark's own golds come from the master and are not re-specified here.

## Sources

| File | What it is |
| --- | --- |
| `logo-master.png` | The delivered logo: the mark on its field with the GROWEN CITY wordmark beneath. The generator cuts the mark out of it — the wordmark is illegible at icon sizes, so no icon carries it. |
| `bg-only.svg` | The field alone. Android adaptive background, and the ground under every tile. |

### How the cut-out works

The field is teal (blue above red) and the mark is gold (red well above blue),
so red-minus-blue separates them. It rides through zero across the logo's own
antialiased edge, so the same number doubles as the alpha ramp, and the drop
shadow — darker than the field but still teal — falls away with it. Thresholds
are `KEY_LO`/`KEY_HI` in the generator. A new master in the same palette needs
no change; one on a different ground does.

The mark comes out around 460×490, so the 1024px icons are an upscale. Lanczos
plus a light sharpen is what keeps the metal edges crisp instead of waxy — if
you get a higher-resolution master, drop it in and the sharpen matters less.

## Regenerating

From the mobile root:

```sh
npm run icons
```

It writes, under `assets/`: `icon.png`, `images/icon.png`,
`images/brand-emblem.png`, `images/brand-mark.png`, `images/favicon.png`,
`images/splash-emblem.png`, and
`images/android-icon-{background,foreground,monochrome}.png`.

The admin is its own repo. When it is checked out beside this one — i.e.
`../admin` exists — the same run also writes its `public/emblem.png` and
`public/favicon.svg`, so the two apps cannot drift apart. When it is not, the
run says so and skips those two; nothing here depends on it.

`android/` and `ios/` are gitignored — `npx expo prebuild --clean` regenerates
the launcher icons there from `app.json`, and EAS does it on every build.

### sharp

sharp is a ~30MB native library this script needs a few times a year, so it is
nobody's dependency. It is taken from wherever it already exists: normal
resolution first, then `../server/node_modules`. If neither has it,
`npm i -D sharp` here is enough — the script finds it and says nothing more
about it.

Android note: `android-icon-foreground.png` and `android-icon-monochrome.png`
place the mark at 700/1024 of the canvas. Launcher masks crop the outer third,
so foreground content has to stay inside the central ~66% — if you enlarge the
mark, check it against a circular mask before shipping.
