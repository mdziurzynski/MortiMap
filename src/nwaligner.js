/**
 * Needleman-Wunsch semi-global (end-gap-free) aligner
 *
 * Identity  = matches / alignment_length
 * Query cov = aligned_query_bases / query_length
 * Target cov= aligned_target_bases / target_length
 */

let M = new Int32Array(0);
let IX = new Int32Array(0);
let IY = new Int32Array(0);

function ensureCapacity(n, m) {
  const required = (n + 1) * (m + 1);
  if (M.length < required) {
    const newSize = Math.max(required * 1.2, 10000); // add 20% buffer
    M = new Int32Array(newSize);
    IX = new Int32Array(newSize);
    IY = new Int32Array(newSize);
  }
}

/**
 * Core NW engine with affine gap penalties and semi-global (end-gap-free) initialization.
 */
export function nwAlign(a, b, match = 2, mismatch = -4, gapOpen = 20, gapExt = 2) {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return { score: 0, identity: 0, qcov: 0, tcov: 0, alnLength: 0, matches: 0, qAln: '', tAln: '', midline: '' };

  ensureCapacity(n, m);
  const cols = m + 1;
  const MIN_SCORE = -1e9;

  // Initialize row 0 and col 0 for semi-global (0 penalty for terminal gaps)
  for (let i = 0; i <= n; i++) {
    const idx = i * cols;
    M[idx] = 0;
    IX[idx] = MIN_SCORE;
    IY[idx] = MIN_SCORE;
  }
  for (let j = 0; j <= m; j++) {
    const idx = j; // 0 * cols + j
    M[idx] = 0;
    IX[idx] = MIN_SCORE;
    IY[idx] = MIN_SCORE;
  }
  M[0] = 0;

  for (let i = 1; i <= n; i++) {
    let idx = i * cols + 1;
    let idx_diag = (i - 1) * cols;
    let idx_up = (i - 1) * cols + 1;
    let idx_left = i * cols;

    for (let j = 1; j <= m; j++) {
      const s = a[i - 1] === b[j - 1] ? match : mismatch;

      const m_diag = M[idx_diag], ix_diag = IX[idx_diag], iy_diag = IY[idx_diag];
      let max_diag = m_diag;
      if (ix_diag > max_diag) max_diag = ix_diag;
      if (iy_diag > max_diag) max_diag = iy_diag;
      M[idx] = max_diag + s;

      const m_up = M[idx_up], ix_up = IX[idx_up], iy_up = IY[idx_up];
      let ix_new = m_up - gapOpen;
      if (ix_up - gapExt > ix_new) ix_new = ix_up - gapExt;
      if (iy_up - gapOpen > ix_new) ix_new = iy_up - gapOpen;
      IX[idx] = ix_new;

      const m_left = M[idx_left], ix_left = IX[idx_left], iy_left = IY[idx_left];
      let iy_new = m_left - gapOpen;
      if (ix_left - gapOpen > iy_new) iy_new = ix_left - gapOpen;
      if (iy_left - gapExt > iy_new) iy_new = iy_left - gapExt;
      IY[idx] = iy_new;

      idx++; idx_diag++; idx_up++; idx_left++;
    }
  }

  // Semi-global traceback starts at the maximum score in the last row or last column
  let maxScore = MIN_SCORE;
  let max_i = n, max_j = m;

  for (let j = 0; j <= m; j++) {
    const idx = n * cols + j;
    const score = Math.max(M[idx], IX[idx], IY[idx]);
    if (score >= maxScore) {
      maxScore = score;
      max_i = n;
      max_j = j;
    }
  }
  for (let i = 0; i <= n; i++) {
    const idx = i * cols + m;
    const score = Math.max(M[idx], IX[idx], IY[idx]);
    if (score > maxScore) {
      maxScore = score;
      max_i = i;
      max_j = m;
    }
  }

  let qAln = '', tAln = '', midline = '';
  let i = max_i, j = max_j;

  let state = 0; // 0=M, 1=IX, 2=IY
  const start_idx = max_i * cols + max_j;
  const start_max = Math.max(M[start_idx], IX[start_idx], IY[start_idx]);
  if (start_max === M[start_idx]) state = 0;
  else if (start_max === IX[start_idx]) state = 1;
  else state = 2;

  while (i > 0 && j > 0) {
    const idx = i * cols + j;
    if (state === 0) {
      const s = a[i - 1] === b[j - 1] ? match : mismatch;
      const idx_diag = (i - 1) * cols + (j - 1);
      qAln = a[i - 1] + qAln;
      tAln = b[j - 1] + tAln;
      midline = (a[i - 1] === b[j - 1] ? '|' : 'x') + midline;
      const val = M[idx] - s;
      if (val === M[idx_diag]) state = 0;
      else if (val === IX[idx_diag]) state = 1;
      else state = 2;
      i--; j--;
    } else if (state === 1) {
      const idx_up = (i - 1) * cols + j;
      qAln = a[i - 1] + qAln;
      tAln = '-' + tAln;
      midline = '-' + midline;
      const val = IX[idx];
      if (val === M[idx_up] - gapOpen) state = 0;
      else if (val === IX[idx_up] - gapExt) state = 1;
      else state = 2;
      i--;
    } else if (state === 2) {
      const idx_left = i * cols + (j - 1);
      qAln = '-' + qAln;
      tAln = b[j - 1] + tAln;
      midline = '-' + midline;
      const val = IY[idx];
      if (val === M[idx_left] - gapOpen) state = 0;
      else if (val === IX[idx_left] - gapOpen) state = 1;
      else state = 2;
      j--;
    }
  }

  const alnLength = qAln.length;
  let matches = 0;
  for (let k = 0; k < alnLength; k++) {
    if (qAln[k] === tAln[k] && qAln[k] !== '-') matches++;
  }

  const identity = alnLength > 0 ? matches / alnLength : 0;
  const aligned_q = qAln.replace(/-/g, '').length;
  const qcov = n > 0 ? aligned_q / n : 0;
  const aligned_t = tAln.replace(/-/g, '').length;
  const tcov = m > 0 ? aligned_t / m : 0;

  return { score: maxScore, identity, qcov, tcov, alnLength, matches, qAln, tAln, midline };
}

/**
 * Align multiple query sequences against multiple reference sequences.
 */
export function alignAll(queries, references, opts = {}) {
  const {
    match = 2,
    mismatch = -4,
    gapOpen = 20,
    gapExt = 2,
    minIdentity = 0,
    minQcov = 0,
    minTcov = 0,
    topHitOnly = false,
  } = opts;

  const results = [];

  for (const query of queries) {
    const qSeq = query.seq.toUpperCase().replace(/[^ACGTN]/g, '');
    const queryHits = [];

    for (const ref of references) {
      const rSeq = ref.seq.toUpperCase().replace(/[^ACGTN]/g, '');

      const aln = nwAlign(qSeq, rSeq, match, mismatch, gapOpen, gapExt);

      if (
        aln.identity < minIdentity ||
        aln.qcov < minQcov ||
        aln.tcov < minTcov
      ) continue;

      queryHits.push({
        queryId: query.id,
        targetId: ref.id,
        score: aln.score,
        identity: aln.identity,
        identityPct: (aln.identity * 100).toFixed(2) + '%',
        qcov: aln.qcov,
        qcovPct: (aln.qcov * 100).toFixed(2) + '%',
        tcov: aln.tcov,
        tcovPct: (aln.tcov * 100).toFixed(2) + '%',
        alnLength: aln.alnLength,
        matches: aln.matches,
        qAln: aln.qAln,
        tAln: aln.tAln,
        midline: aln.midline,
      });
    }

    queryHits.sort((a, b) => b.identity - a.identity);

    if (topHitOnly && queryHits.length > 0) {
      results.push(queryHits[0]);
    } else {
      results.push(...queryHits);
    }
  }

  return results;
}