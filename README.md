# 🔬 MortiMap

A browser-based DNA sequence mapping tool that aligns user-provided sequences against a reference database of ITS2 centroid sequences — no server required. All computation runs locally in your browser via WebAssembly.

---

## What It Does

MortiMap accepts up to **10 DNA sequences** (max 2000 bp each) in FASTA format and maps them against a curated set of reference centroid sequences using **Minimap2** compiled to WebAssembly via [BioWasm](https://biowasm.com/). It reports which queries successfully cluster with a reference and provides alignment metrics for each hit.

**Results include:**
| Column | Description |
|---|---|
| Query Name | FASTA header of the input sequence |
| Centroid Hit | ID of the matched reference sequence |
| Identity (%) | Percentage of matching bases in the aligned block |
| Query Cov (%) | Proportion of the query covered by the alignment |
| Target Cov (%) | Proportion of the reference covered by the alignment |
| Status | `Mapped` / `Unmapped` based on predefined thresholds |

A sequence is considered **Mapped** only if it meets **both** thresholds simultaneously:
- **Identity ≥ 90%** (`PIDENT_THRESHOLD`)
- **Bidirectional coverage ≥ 70%** (`COVERAGE_THRESHOLD`) — applied independently to both query and target

---

## Tech Stack

| Component | Technology |
|---|---|
| Frontend framework | [React 18](https://reactjs.org/) via [Vite 5](https://vitejs.dev/) |
| UI components | [Material UI v5](https://mui.com/) |
| Alignment engine | [Minimap2 2.22](https://github.com/lh3/minimap2) via [BioWasm / Aioli](https://biowasm.com/) |
| Deployment | [GitHub Pages](https://pages.github.com/) via GitHub Actions |

All alignment runs inside a WebAssembly sandbox in the user's browser — no data leaves the client.

---

## Repository Structure

```
MortiMap/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions — auto-deploy to GitHub Pages on push to main
├── docs/
│   └── implementation_plan.md  # Project architecture and design decisions
├── public/
│   └── references.fasta        # Reference centroid sequences (replace with your real database)
├── src/
│   ├── App.jsx                 # Main React application component
│   ├── main.jsx                # React entry point
│   └── index.css               # Global CSS (minimal — MUI handles most styling)
├── index.html                  # Vite HTML entry point
├── vite.config.js              # Vite configuration (base path set to /MortiMap/ for GH Pages)
└── package.json
```

---

## Running Locally

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- npm ≥ 9

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/MortiMap.git
cd MortiMap

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The app will be available at **http://localhost:5173/MortiMap/**

> **Note:** The first time you click "Map to Centroids", the browser will download the Minimap2 WebAssembly binary from BioWasm CDN (~10 MB). Subsequent runs within the same session are faster.

---

## Using Your Own Reference Sequences

Replace the placeholder file at `public/references.fasta` with your own centroid sequences in standard multi-FASTA format:

```
>centroid_001
ATCGATCGATCG...
>centroid_002
GCTAGCTAGCTA...
```

Up to ~1000 sequences are supported. There is no server-side processing — the entire reference database is fetched and loaded into browser memory on each run.

---

## Adjusting Thresholds

The mapping thresholds are defined as constants at the top of `src/App.jsx`:

```js
const PIDENT_THRESHOLD = 90;   // Minimum % identity to consider a hit valid
const COVERAGE_THRESHOLD = 70; // Minimum % coverage required on both query and target
```

Modify these values and save the file. The dev server will hot-reload automatically.

---

## Deployment to GitHub Pages

Deployment is fully automated via GitHub Actions. On every push to `main`, the workflow:
1. Installs dependencies (`npm install`)
2. Builds the static bundle (`npm run build` → `dist/`)
3. Deploys the `dist/` folder to the `gh-pages` environment

To enable this in your fork:
1. Go to **Settings → Pages** in your GitHub repository
2. Set the source to **GitHub Actions**
3. Push to `main` — the site will be live at `https://<your-username>.github.io/MortiMap/`

---

## Limitations

- Maximum **10 input sequences** per run
- Maximum **2000 bp** per sequence
- Requires an internet connection on first use (to fetch the Minimap2 Wasm binary from BioWasm CDN)
- Alignment parameters are fixed to Minimap2's `-x sr` preset (tuned for short reads / ITS2 region)

---

## License

[MIT](LICENSE)
