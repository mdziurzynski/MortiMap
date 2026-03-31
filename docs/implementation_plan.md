# DNA Sequence Mapping App (MortiMap)

This plan outlines the process of creating a simple, low-maintenance static web application hosted on GitHub Pages that maps user-provided DNA sequences (up to 10 sequences, max 2000 bp) against a reference database of ~1000 centroid sequences.

## Proposed Architecture

We will build the frontend using **Vite + React** because it provides an outstanding developer experience and a robust foundation for a modern, beautiful UI, while remaining extremely easy to deploy as a static site.

### 1. App initialization and UI Development
- Bootstrap a modern web frontend (Vite + React with vanilla CSS for premium aesthetics).
- Build a clean layout featuring:
  - An input area for one or multiple DNA sequences (FASTA format).
  - A subtle loading state showing mapping progress.
  - A beautiful tabular results dashboard showing which input sequence mapped to which reference centroid, including metrics like identity %, overlap length, and bidirectional coverage.
- **Thresholds**: We will use predefined thresholds for `pident` (Percentage Identity) and bidirectional coverage. These will be hardcoded in the logic, without UI sliders.

### 2. Sequence Mapping Engine using BioWasm (Minimap2)
- **Tool**: We will map user sequences to centroid sequences using **Minimap2** from BioWasm (`https://biowasm.com/cdn/v3/minimap2/2.22/`).
- **Web Worker**: To guarantee a flawless user experience, the Minimap2 execution will happen inside a Background Web Worker, preventing any browser freezing.
- **Configuration**: We will configure Minimap2 with standard parameters suitable for ITS2 region alignment.
- **Centroids**: We will bundle a `public/references.fasta` file containing the ~1000 reference sequences. The web app will automatically load this file to use as the mapping target.

### 3. GitHub Pages Deployment Setup
- Create a simple GitHub Actions workflow (`.github/workflows/deploy.yml`) to automatically build (`npm run build`) and deploy the static app to GitHub Pages whenever changes are pushed to the `main` branch.

## Iteration Process
1. I will initialize the Vite + React app.
2. I will build the BioWasm `minimap2` web worker integration.
3. I will create the beautiful tabular UI.
4. I will start the local development server (`npm run dev`) so you can test it directly in your browser.
