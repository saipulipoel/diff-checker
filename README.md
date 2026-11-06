# Diff Tool

Static web tool: **Text Compare** and **Zip Diff Check**. Plain HTML/CSS/JS. Everything runs in the browser; no files are uploaded anywhere.

`favicon.svg` is used as the tab icon and header logo.

Libraries (CDN, pinned): jsdiff 5.2.0, JSZip 3.10.1. For offline use, download them into `js/` and update the two `<script>` tags in `index.html`.

## Deploy to GitHub Pages
1. Create a repository and push these files to the `main` branch (`index.html` at the repo root).
2. Repository **Settings → Pages**.
3. Under **Build and deployment**, set Source to **Deploy from a branch**, choose `main` and `/ (root)`, then Save.
4. After about a minute the site is live at `https://<user>.github.io/<repo>/`.

## Copy isolation
Each side is its own scroll container. Line numbers are CSS `::before` content (not selectable, not copied). On mouse/touch down in one pane, the other pane gets `user-select: none`.
