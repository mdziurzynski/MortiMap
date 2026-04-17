# 🔬 MortiMap

A browser-based DNA sequence mapping tool that aligns user-provided sequences against a reference database of ITS2 centroid sequences - no server required. All computation runs locally in your browser using a custom Needleman-Wunsch alignment algorithm.

Goto: [https://mdziurzynski.github.io/MortiMap/](https://mdziurzynski.github.io/MortiMap/)

---

## What It Does

MortiMap accepts up to **10 DNA sequences** (max 2000 bp each) in FASTA format and maps them against a curated set of reference centroid sequences using a highly optimized **Needleman-Wunsch** (semi-global/end-gap-free) alignment algorithm. It reports which queries successfully cluster with a reference and provides alignment metrics for each hit.

**Results include:**
| Column | Description |
|---|---|
| Query Name | FASTA header of the input sequence |
| Cluster Hit | ID of the matched reference sequence |
| Identity (%) | Percentage of matching bases in the aligned block |
| Query Cov (%) | Proportion of the query covered by the alignment |
| Target Cov (%) | Proportion of the reference covered by the alignment |
| Status | `Mapped` / `Unmapped` based on predefined thresholds |

A sequence is considered **Mapped** only if it meets **both** thresholds simultaneously:
- **Identity ≥ 98%** (`PIDENT_THRESHOLD`)
- **Bidirectional coverage ≥ 99%** (`COVERAGE_THRESHOLD`) - applied independently to both query and target

---

## Tech Stack

| Component | Technology |
|---|---|
| Frontend framework | [React 18](https://reactjs.org/) via [Vite 5](https://vitejs.dev/) |
| UI components | [Material UI v5](https://mui.com/) |
| Alignment engine | Custom Needleman-Wunsch (JavaScript / Web Worker) |
| Test framework | [Vitest](https://vitest.dev/) |
| Deployment | [GitHub Pages](https://pages.github.com/) via GitHub Actions |

All alignment runs inside a dedicated Web Worker in the user's browser - no data leaves the client.

---

## Repository Structure

```
MortiMap/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions - auto-deploy to GitHub Pages on push to main
├── public/
│   └── references.fasta        # Reference centroid sequences
├── src/
│   ├── App.jsx                 # Main React application component
│   ├── nwaligner.js            # Core Needleman-Wunsch implementation
│   ├── mapper.worker.js        # Web Worker for background sequence alignment
│   ├── utils.js                # Parsing and hit selection utilities
│   ├── main.jsx                # React entry point
│   └── index.css               # Global CSS
├── index.html                  # Vite HTML entry point
├── vite.config.js              # Vite configuration
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
git clone https://github.com/mdziurzynski/MortiMap.git
cd MortiMap

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The app will be available at **http://localhost:5173/MortiMap/**

---

## Testing

MortiMap uses **[Vitest](https://vitest.dev/)** for unit and integration testing. Logic is decoupled from the UI for easy testability.

### 🏃 Running Tests

To run the full test suite once:
```bash
npm test
```

To run tests in watch mode (auto-rerun on changes):
```bash
npx vitest
```

### ✍️ Writing New Tests

Tests are located in `src/utils.test.js` and `src/nwaligner.test.js`.

- **Unit Tests**: Add tests to verify core logic (e.g., restricted ACGTN vocabulary or ranking criteria).
- **Mapping Scenarios**: Add mock alignment data to simulate how the system should handle specific reference hits.

---

## Using Your Own Reference Sequences

Replace the file at `public/references.fasta` with your own centroid sequences in standard multi-FASTA format:

```
>centroid_001
ATCGATCGATCG...
>centroid_002
GCTAGCTAGCTA...
```

Up to ~1000 sequences are supported. All references are fetching and processed locally in browser memory.

---

## Adjusting Thresholds

The mapping thresholds are defined as constants at the top of `src/App.jsx`:

```js
const PIDENT_THRESHOLD = 98;   // Minimum % identity to consider a hit valid
const COVERAGE_THRESHOLD = 99; // Minimum % coverage required on both query and target
```

Modify these values and save the file. The dev server will hot-reload automatically.

---

## Deployment to GitHub Pages

Deployment is fully automated via GitHub Actions. On every push to `main`, the workflow:
1. Installs dependencies (`npm install`)
2. Builds the static bundle (`npm run build` → `dist/`)
3. Deploys the `dist/` folder to the `gh-pages` environment

---

## Limitations

- Maximum **10 input sequences** per run (UI recommendation)
- Maximum **2000 bp** per sequence
- Entirely local processing - no server side communication beyond initial fetch

---

## License

[MIT](LICENSE)
