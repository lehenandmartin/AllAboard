# AllAboard — Specification

## Goal
A web app (100 % in the browser, no server) to lay out storyboards: import
images, the app arranges them in a grid of identical size on one or more
slides, with text boxes, then exports a .pptx file (compatible with
PowerPoint, Google Slides, Keynote, LibreOffice).

## Languages
- Code, comments, tests and this specification are in English.
- The interface is translated into English and French. The default language
  is the browser's (first supported language among its preferred ones,
  English otherwise); it can be changed from the File menu (remembered in
  this browser).
- Texts live in `src/i18n/`: `en.ts` is the reference dictionary, `fr.ts`
  must provide exactly the same keys (checked by TypeScript). Texts with
  values are functions (plurals handled there). No i18n library.
- `useT()` gives the texts in a component (re-rendered when the language
  changes); `t()` gives them outside React.
- Numbers are shown with the language's decimal separator (1.25 / 1,25);
  input accepts both.
- Content created in the app follows the language at creation time: default
  project name, numbering prefix ("Shot " / "Plan "), default notice text,
  copy and continuation suffixes ("(copy)" / "(copie)", "(cont.)" /
  "(suite)"), object names in the exported .pptx.

## Tech stack
- Vite + React + TypeScript (strict)
- Zustand for state, with history for undo/redo (zundo)
- @dnd-kit for drag and drop
- PptxGenJS for the .pptx export
- JSZip for the project file
- IndexedDB (via idb-keyval) for autosave
- Vitest for the layout engine tests
- Static deployment: published on GitHub Pages (https://lehenandmartin.github.io/AllAboard/)
  by `.github/workflows/pages.yml` at every push to main (tests, then build with
  `--base=/AllAboard/`); any other static host works too

## Concepts
- **Project**: a presentation = a slide format + a list of boards.
- **Board**: a storyboard slide, with its images, texts and settings. Each
  board inherits the project default settings and can override them.
- **Frame**: a grid slot. It holds an image, or stays empty (shot not drawn
  yet: a placeholder frame is shown).

## Settings

### Project
- Slide format: 16:9 (33.867 × 19.05 cm), 4:3, A4 landscape, A4 portrait,
  custom.
- Default font, from a list of safe fonts (Arial, Helvetica, Calibri,
  Georgia…) so that the preview matches the export.

### Board (inheriting the project values)
- Columns: a number, or auto.
- Rows: a number, or auto.
- Frame ratio: 16:9, 1:1, 9:16, 4:5, 4:3, 2.39:1, custom, or "from the first
  image" (default).
- Image fit in the frame: fill with cropping (cover) or fit without cropping
  (contain).
- Margins: top, right, bottom, left (in cm).
- Horizontal gutter and vertical gutter, set separately.
- Title area at the top: on or off, height, title text.
- Text mode:
  - none;
  - **under each image**: a block as wide as the image;
  - **under each row**: a block from the left edge of the first column to
    the right edge of the last column of the grid (e.g. voice-over).
- Text block height and gap between the image and the text.
- Text style: size, alignment, color.
- Optional automatic numbering ("Shot 1", "1", "P01"…), with an editable
  prefix.
- Common notice on every image (e.g. a mandatory health notice such as
  "mangerbouger.fr"): free text, font, size (8 pt by default, proportional to
  the image by default: 8 pt for a 2 × 2 grid of 16:9 frames, adapted to the
  size of each image; or a fixed size), alignment, and placement in the
  bottom letterbox bar, or in a separate band at the bottom of the image
  (height in %, 7 % by default; offset from the bottom of the image or of the
  letterbox, in %, 3.5 % by default; black or white background, 40 % opacity
  by default; white text on black, black on white).
  In the export: an editable text box, grouped with the image.
- Alignment of an incomplete last row: left or centered.
- Image border: none, or width and color.
- Letterbox: black bars at the top and bottom of each image (black
  rectangles over the image; in the export, grouped with the image so they
  move together), whose height is chosen as a % of the image height.
  Shortcuts to the 1.85:1, 2:1 and 2.39:1 framings, computed from the frame
  ratio.

## Layout engine (src/core/layout.ts)
Pure functions, with no dependency on React, fully tested. It is the
**single source of truth**: the preview AND the export use exactly the same
computed rectangles.

Internal unit: inches (PptxGenJS's unit). The interface shows cm.
Conversions go through a single module (src/core/units.ts).

### Computation
- Available area:
  `W = slideWidth − marginL − marginR`
  `H = slideHeight − marginT − marginB − titleHeight`
- Height added per row: `t = textGap + textHeight` (0 without text). This
  formula applies to both text modes.
- For a grid of c columns and r rows, with ar the frame ratio
  (width / height):
  - `wMax = (W − (c−1) × gutterH) / c`
  - `hMax = (H − (r−1) × gutterV) / r − t`
  - frame width = `min(wMax, hMax × ar)` (0 if negative)
- Auto mode: try every combination (c, r) that respects the constraints set
  by the user and satisfies `c × r ≥ n`. Keep the largest frame width. On a
  tie (within 0.5 pt), prefer the fewest empty frames.
- The grid is centered in the available area.
- Output: the list of frame rectangles, text rectangles (per image or per
  row) and the title rectangle.

### Overflow
If the user fixes both columns AND rows and there are too many images, the
interface says so and offers to create a continuation board automatically
("Board 1 (cont.)") with the same settings.

### Expected tests
Auto cases for n = 1 to 24, 16:9 / 1:1 / 9:16 ratios, each text mode,
constraints on columns only, rows only, both, and impossible cases.

## Interface
- **Left sidebar**: the list of boards (thumbnails). Add, duplicate, delete,
  rename, reorder by drag and drop. A board's "…" menu and its right-click
  offer the same actions.
  - Selecting several boards: Shift+click (range), Cmd/Ctrl+click (one by
    one); the clicked board becomes the active board. On the selection: "…"
    menu and right-click (duplicate, delete), Cmd/Ctrl+D, Del (when no frame
    is selected). A project always keeps at least one board; deleting asks
    for confirmation if the boards contain frames.
  - Replace all the images of a board: the new files, sorted by name, take
    the place of the images in frame order (empty frames included). The
    board's texts, title and settings are kept; extra frames keep their
    image, extra images create frames at the end.
- **Center**: the faithful preview of the active slide, to scale, with the
  real proportions.
  - Drag an image onto another to move it (insertion); Alt + drag to swap
    two images.
  - An image can be dragged onto another board in the sidebar to move it
    there.
  - Texts (title, blocks) are edited right in the preview.
  - Multiple selection: click, Shift+click, Cmd/Ctrl+click.
  - Actions on a frame: delete, replace the image, insert an empty frame
    before or after, duplicate, crop. The same actions in the actions bar
    and on right-click (a frame outside the selection becomes the
    selection).
  - Cropping an image (double-click on the frame, or "Crop"): by default the
    image follows the board's fit mode; in crop mode, the whole image shows
    semi-transparent around the frame, it is moved by dragging, resized by
    its corners, with the wheel or with the slider of the crop bar (which
    replaces the actions bar: Fill, Whole image, Reset, Done). The crop is
    specific to the frame (src/core/crop.ts: center as a fraction of the
    frame, size relative to filling), takes precedence over the board's fit
    mode, stays valid if the size or ratio of the frames changes, and is
    dropped when the frame gets another image. In the export: the cropped
    image (srcRect) at the visible rectangle.
- **Right sidebar**: the active board's settings. Each overridden setting is
  flagged, with a "back to the project default" button. For a setting with
  several fields (notice, letterbox, border, numbering, text style,
  margins), each field is overridden and reset separately: the others stay
  inherited from the project.
  - Optional features (title, text, numbering, border, letterbox, notice):
    the switch is in the section header, and their settings only show when
    the option is on. Putting the switch back in the project's state clears
    the override. Small choices (text position, notice placement) are
    segmented buttons rather than dropdowns.
- **Import**: drag files or a folder anywhere, or the "Add images" button.
  - Sorted by file name in natural order (shot2 before shot10).
  - Accepted formats: JPG, PNG, WebP, GIF.
  - A single image dragged from the computer onto a preview frame replaces
    that frame's image (or fills an empty frame), keeping its text.
  - Option: spread the import automatically over several boards of N
    images.
- Keyboard shortcuts: undo / redo (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z), Del,
  arrows to move a selected image, Cmd/Ctrl+D to duplicate (the selected
  frames, otherwise the selected boards), Alt+N for a new board after the
  active board (Cmd/Ctrl+N is reserved by browsers).

## Appearance
A nod to PowerPoint for the web, without a ribbon or a copy, following
Microsoft's Fluent 2 design system (fluent2.microsoft.design):
- System font `"Segoe UI Variable Text", "Segoe UI", system-ui, …` (nothing
  to load). Base text 14 px; 13 px in the panes.
- Icons: Fluent UI System Icons (Microsoft, MIT;
  github.com/microsoft/fluentui-system-icons, npm package
  `@fluentui/svg-icons`), size 20 "regular", in
  `src/components/Icon/icons.ts` (only the ones used), through the
  `<Icon name="…" />` component. No CSS framework: CSS variables.
- Colors: PowerPoint's brick orange (PowerPoint's Fluent brand color)
  `#c43e1c`, reserved for actions, selection and overridden settings;
  Office's warm neutrals; amber = warning, red = danger. 4 px corners
  (controls) / 8 px (panels), light shadows.
- Structure: orange brand bar (app name, project title in the center, save
  status, help), white command bar (File, undo / redo, add images, empty
  frame, Export), boards pane on the left (like the slide pane: number,
  thumbnail, active board framed), slide in the center on a gray background,
  "Format" pane on the right (tabs, collapsible sections, each with its
  icon). Dark toasts at the bottom, menus, context menus and dialogs with a
  drop shadow.
- The File menu and the help dialog end with the app name, its version and a
  link to the source code on GitHub. The version comes from `package.json`
  (injected by Vite as `__APP_VERSION__`, read through `src/appInfo.ts`).

## Images
- Stored as Blobs in IndexedDB, never as base64 in the React state.
- On import, the original dimensions are stored.
- "Compress images" export option: maximum longest side (1920 px by
  default), adjustable JPEG quality. It avoids 200 MB .pptx files.

## .pptx export (src/export/pptx.ts)
- One slide per board, in order.
- Images are real images, placed at the rectangles computed by the engine.
  - In cover mode: use PptxGenJS's `sizing: { type: 'cover' }` option, and
    check the result in PowerPoint and in Google Slides.
  - In contain mode: compute the size and position ourselves.
- Texts are real editable text boxes: wrapping on, autofit off, small inner
  margins.
- Empty frames become a rectangle with a thin gray border.
- File name: project name + date.

## Project and saving
- Continuous autosave in IndexedDB, restored at startup.
- List of recent projects.
- Export / import of the whole project as a `.zip` file holding
  `project.json` and an `images/` folder. This format is used to archive
  and share a project that stays editable.

## Folder structure
```
src/
  core/        types.ts, units.ts, layout.ts, layout.test.ts, sort.ts, crop.ts…
  i18n/        en.ts (reference), fr.ts, locale.ts, index.ts
  store/       projectStore.ts (Zustand + history)
  storage/     imageStore.ts (IndexedDB), projectFile.ts (zip)
  export/      pptx.ts
  components/  BoardList/, Canvas/, Frame/, SettingsPanel/, Toolbar/, Import/
  App.tsx
```

## Development plan (one step at a time, with validation in between)
1. Project setup, then types and layout engine with its tests.
2. Static preview of a board, wired to the engine, and settings panel.
3. Image import (natural sort, IndexedDB storage).
4. Reordering by drag and drop, selection, empty frames.
5. Texts: title, per-image mode, per-row mode, direct editing.
6. .pptx export, to check in PowerPoint AND in Google Slides.
7. Several boards: list, settings inheritance, moving images between
   boards, overflow.
8. Autosave, .zip project file, undo / redo.
9. Polish: shortcuts, image compression, empty states, error messages.

## Principles
- The preview and the export must match to the millimeter: everything goes
  through the engine.
- No data leaves the browser.
- Simple, readable code; no unnecessary dependency.
