# Accessibility verification

Semantix keeps chart data available as semantic tables and checks the shared
small-text color tokens against the WCAG AA 4.5:1 contrast requirement.

## Contrast matrix

The ratios below use the composited token colors from `frontend/src/index.css`.

| Foreground | Background | Ratio | Normal text |
| --- | --- | ---: | --- |
| `--text-muted` | `--ink` | 6.79:1 | Pass |
| `--text-muted` | `--surface` | 6.58:1 | Pass |
| `--text-faint` | `--ink` | 5.18:1 | Pass |
| `--text-faint` | `--surface` | 5.05:1 | Pass |
| `--coral-text` | `--ink` | 5.85:1 | Pass |
| `--coral-text` | `--surface` | 5.48:1 | Pass |
| `--ink` | `--coral-text` | 5.85:1 | Pass |

The darker `--coral` token remains available for borders, plot marks, and
decorative accents. Small coral text uses `--coral-text`.

## Manual visual review

Check the following at desktop and mobile widths:

- muted labels and faint explanatory copy remain readable on both primary
  backgrounds;
- coral errors, destructive actions, and MISS labels are readable without
  appearing brighter than primary content;
- focus outlines remain visible when navigating with the keyboard;
- evaluation line charts and similarity histograms retain their visible
  presentation while exposing the same values in a screen-reader table;
- measured threshold points use outlined circles, projected points use filled
  squares, and every chart table names the value kind without relying on color;
- benchmark controls use no more than two columns at 744, 768, 820, and 834 px
  portrait widths, preserve 44 px interaction targets, and have no page-level
  horizontal overflow at 320, 1024, or 1280 px;
- the advanced sweep disclosure works with Enter and Space, reports
  `aria-expanded`, and announces validation and run status without moving
  focus;
- empty histogram bins have no visible bar.

Navigation verification also covers:

- a compact menu from 320 through 834 CSS pixels and expanded navigation from
  1024 CSS pixels;
- native Enter and Space activation, Escape closure, conditional focus return,
  and route-change closure;
- portrait and landscape tablet widths, 200% zoom-equivalent layouts,
  increased text size, and long navigation labels;
- no horizontal overflow at any checked viewport.

Evaluation workspace review additionally covers long dataset names, visible
focus, and the provider warning in normal reading order.

Run the automated token check with:

```powershell
cd frontend
npm run test -- tests/shared/accessibility/contrast.test.ts
```
