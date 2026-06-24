# Original User Request

## Initial Request — 2026-06-19T09:26:26Z

Convert the OCMS project into a completely AI-free, local-first headless CMS, replacing all paid or local LLM dependencies with fast, deterministic, and free developer tools.

Working directory: D:\MODEL\ocms
Integrity mode: demo

## Requirements

### R1. Visual Element Inspector (0% AI Scraper Replacement)
Implement a click-to-select visual inspector inside the preview iframe. When active, hovering elements shows a colored border; clicking an element extracts its CSS selector, tag name, type, and content, immediately adding it as an editable field in the CMS sidebar.

### R2. Deterministic AST/Regex Code Patcher (0% AI Publisher Replacement)
Replace the Gemini model inside `/api/publish-changes` with a robust, deterministic AST-based code patcher (or a precise regex-based selector replacement engine) that directly edits values inside the React JSX/TSX source code.

### R3. PBR Material Presets Library (0% AI Texture Replacement)
Replace the AI texture generator inside the 3D Model options modal with a library of preset PBR materials (e.g. Brushed Chrome, Gold, Leather, Pine Wood, Carbon Fiber). Selecting a preset applies its pre-configured roughness, metalness, and tileable texture maps.

### R4. Sidebar Filter Bar & Color Generator (0% AI Copywriting/Color Replacements)
- Add a text filter bar in the Content fields sidebar to filter fields by label or selector instantly.
- Replace AI color extraction with a standard color-harmony generator library (generating analogous, triad, and monochromatic palettes locally in JS).
- Replace AI copy variations with curated copywriting templates (e.g. marketing templates, technical taglines) selectable from a dropdown.

### R5. Local File Synchronizer
Ensure that visual edits are written back directly to the local workspace code files as well as GitHub.

## Acceptance Criteria

### Visual Inspector (R1)
- [ ] Clicking a "Visual Inspect" button in the preview allows clicking any heading, paragraph, button, image, or link.
- [ ] Clicking an element adds it to the sidebar schema without reloading.

### Deterministic Publisher (R2)
- [ ] Saving updates patches the React code files directly using Javascript AST/regex logic, with no external AI calls.
- [ ] Successfully modifies targeted elements in the file.

### Presets Grid (R3)
- [ ] 3D Model modal displays a grid of material presets. Clicking a preset updates the model's roughness/metalness and loads the preset texture.

### Filter & Colors (R4)
- [ ] Sidebar filter bar updates the field list in real time as the user types.
- [ ] Theme color generator calculates complementary and triad palettes locally inside the browser.
