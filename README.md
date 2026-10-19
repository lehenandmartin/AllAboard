<h1 align="center">AllAboard</h1>
<h3 align="center">Lay out a storyboard in the browser and export it to PowerPoint: no slide to build by hand, no image to resize.</h3>

<p align="center">
  <img src="https://img.shields.io/github/v/release/lehenandmartin/AllAboard" alt="Latest release">
  <img src="https://img.shields.io/github/license/lehenandmartin/AllAboard" alt="License">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite 8">
</p>

<a href="https://lehenandmartin.github.io/AllAboard/"><img width="1920" height="1107" alt="Screenshot of AllAboard" src="https://github.com/user-attachments/assets/43f66aba-5b85-48fe-a514-4add15cea6d6" /></a>


<p align="center">
  <a href="https://lehenandmartin.github.io/AllAboard/"><strong>Open AllAboard</strong></a> — runs in your browser, nothing to install
</p>

---

Turning a folder of frames into a storyboard deck usually means placing every image by hand, resizing it to match the others, lining up the captions and starting again when a shot is added. With AllAboard, you drop the images (files or a whole folder) once: they are sorted by name, laid out in a grid of identical frames on one or more slides, with a text block under each image or each row, and exported as a `.pptx` that opens in PowerPoint, Google Slides, Keynote or LibreOffice.

Along the way, AllAboard keeps everything editable: in the exported file, images are real pictures and texts are real text boxes, so the deck can still be reworked by hand.

**What it is not**
- Not a drawing tool: draw the frames in your usual software; AllAboard lays them out.
- Not a presentation editor: no free-form slides, transitions or animations. The deck it exports is the place for that.
- Not a collaborative tool: no accounts, no sharing, no comments. Projects stay in your browser; a `.zip` project file is there to archive or pass one on.
- No server: everything runs in the browser, and no image ever leaves your computer.

The name is a play on the boards it lays out, and on the conductor's call before departure: every frame on board, in order, ready to go.

## Features

### Import
- Drag and drop images or a whole folder anywhere in the window, or use the "Add images" button
- Sorted by file name in natural order (`shot2` before `shot10`), folders by path
- JPG, PNG, WebP and GIF; other files are reported without blocking the import, system files (`.DS_Store`…) are ignored
- Option to spread an import over several boards of N images
- Drop a single image onto a frame to replace its image, keeping its text
- Replace all the images of a board at once, in frame order, keeping its texts and settings

### Layout
- Grid computed automatically to get the largest frames, or with a fixed number of columns and/or rows
- Frame ratio: 16:9, 1:1, 9:16, 4:5, 4:3, 2.39:1, custom, or taken from the first image
- Fill (with cropping) or fit (whole image), margins, horizontal and vertical gutters, last row aligned left or centered
- Empty frames for shots not drawn yet
- Per-frame crop: double-click an image to move and resize it inside its frame, PowerPoint-style
- Slide formats: 16:9, 4:3, A4 landscape and portrait, custom size

### Texts
- Title area, a text block under each image, or a block spanning each row (voice-over)
- Edited right on the slide, with the same margins, size and line height as in the export
- Automatic numbering ("Shot 1", "P01"…) with an editable prefix

### Overlays
- Letterbox bars to preview a wider framing (1.85:1, 2:1, 2.39:1 shortcuts)
- Common notice on every image (e.g. a mandatory health notice), in the letterbox or in a separate band, sized in proportion to each image
- Image border

### Boards
- Several boards (slides) per project, with thumbnails; reorder, duplicate, rename, delete, select several at once
- Project default settings, overridden board by board and field by field, with a reset next to each override
- When a fixed grid is too small, the extra frames move to a continuation board with the same settings
- Move frames between boards by dragging them onto the sidebar

### Export
- One slide per board, every item at the exact rectangle shown in the preview
- Real pictures and editable text boxes; letterbox bars and notices grouped with their image
- Optional image compression (longest side, JPEG quality) to avoid huge files; EXIF orientation fixed, WebP converted

### Saving
- Continuous autosave in the browser (IndexedDB), restored when the page opens
- Recent projects in the File menu
- Undo / redo for every change
- `.zip` project file (`project.json` + `images/`) to archive or share a project that stays editable

### Languages
- Interface in English and French, following the browser by default, changeable from the File menu
- Numbers, default texts and the names of the exported objects follow the language

## Stack

| Layer | Technology |
|---|---|
| Interface | [React 19](https://react.dev), TypeScript (strict), [Vite](https://vite.dev) |
| State | [Zustand](https://github.com/pmndrs/zustand), with undo / redo by [zundo](https://github.com/charkour/zundo) |
| Drag and drop | [dnd-kit](https://dndkit.com) |
| Export | [PptxGenJS](https://gitbrent.github.io/PptxGenJS/), plus a few touch-ups of the slide XML |
| Storage | IndexedDB via [idb-keyval](https://github.com/jakearchibald/idb-keyval), project files with [JSZip](https://stuk.github.io/jszip/) |
| CSS | Custom stylesheet after [Fluent 2](https://fluent2.microsoft.design), [Fluent UI System Icons](https://github.com/microsoft/fluentui-system-icons) |
| Tests | [Vitest](https://vitest.dev) |

## Installation

### Use it online

Open **[lehenandmartin.github.io/AllAboard](https://lehenandmartin.github.io/AllAboard/)**: it is the full app, not a demo. It runs entirely in your browser: images and projects are stored on your computer (IndexedDB) and are never uploaded. The page is updated at every push to `main`.

### Static hosting

To host your own copy:

1. Clone the repository and build the site:
   ```bash
   git clone https://github.com/lehenandmartin/AllAboard.git
   cd AllAboard
   npm install
   npm run build
   ```
2. Publish the `dist/` folder as is on any static host: GitHub Pages, Netlify, Vercel, or a plain web server. There is no server code and no database.
3. To host it in a subfolder (for example `https://user.github.io/allaboard/`), give Vite that path when building:
   ```bash
   npx vite build --base=/allaboard/
   ```

Projects are stored in each visitor's browser: the same deployment can serve several people without them ever seeing each other's work.

### Local development

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Requirements

- Node.js 20.19+ or 22.12+ to build
- A recent browser (Chrome, Edge, Firefox, Safari) with IndexedDB available; strict private browsing modes may prevent saving

## Tests

```bash
npm test            # all tests
npm test -- crop    # only test files whose name contains "crop"
npm run typecheck   # type checking
npm run lint        # oxlint
```

The layout engine (`src/core/`) is pure TypeScript, with no React, and fully tested: automatic grids for 1 to 24 images, every ratio and text mode, fixed constraints and impossible cases. The preview and the export both draw from it, so what you see is what you export. Export tests open the generated `.pptx` and check its XML.

## Translations

Interface texts live in `src/i18n/`: `en.ts` is the reference dictionary and `fr.ts` the French translation. Both have exactly the same keys, which TypeScript checks: a missing or extra text does not build. Texts that take values are functions, so plurals are handled in each language. Components read them with `useT()`, other code with `t()`.

## About

This project was built with the assistance of [Claude](https://claude.ai), under the author's direction and review.

## License

[MIT](LICENSE) — © 2026 Martin Le Hénand

Third-party components: [Fluent UI System Icons](https://github.com/microsoft/fluentui-system-icons) (MIT, see `src/components/Icon/ICONS-LICENSE.txt`), and the npm dependencies [React](https://react.dev), [Zustand](https://github.com/pmndrs/zustand), [zundo](https://github.com/charkour/zundo), [dnd-kit](https://dndkit.com) and [PptxGenJS](https://gitbrent.github.io/PptxGenJS/) (MIT), [JSZip](https://stuk.github.io/jszip/) (MIT or GPL-3.0, used under MIT) and [idb-keyval](https://github.com/jakearchibald/idb-keyval) (Apache-2.0).
