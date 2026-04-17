export const dnaRegex = /^[ACGTN]+$/;

/**
 * Parses FASTA formatted text into an array of objects.
 * @param {string} text - The FASTA input.
 * @returns {object} - An object containing `sequences` (array of {id, seq}) and `errors` (array of strings).
 */
export const parseFasta = (text) => {
  const sequences = [];
  const errors = [];
  let currentId = '';
  let currentSeq = '';

  const saveEntry = () => {
    if (!currentId) return;

    // Remove any whitespaces/tabs from the internal sequence string
    const cleanedSeq = currentSeq.replace(/\s/g, '');
    if (cleanedSeq.length > 0 && !dnaRegex.test(cleanedSeq)) {
      errors.push(`Invalid characters in sequence: ${currentId}. Allowed nucleotides: ACGTN`);
    }

    sequences.push({ id: currentId, seq: cleanedSeq });
  };

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('>')) {
      saveEntry(); // Store previous entry
      currentId = trimmed.substring(1).trim();
      currentSeq = '';
    } else {
      currentSeq += trimmed.toUpperCase();
    }
  }

  saveEntry(); // Store final entry
  return { sequences, errors };
};

/**
 * Selects the best hit for each query sequence from an array of alignments.
 * Ranking: Identity > Query Coverage > Target Coverage (all DESC)
 * @param {array} allAlignments - Array of alignments ({id, reference, pidentNum, qCovNum, tCovNum})
 * @returns {Map} - Map of ID to best alignment object.
 */
export const selectBestHits = (allAlignments) => {
  const bestHitsMap = new Map();
  for (const hit of allAlignments) {
    if (!bestHitsMap.has(hit.id)) {
      bestHitsMap.set(hit.id, hit);
    } else {
      const currentBest = bestHitsMap.get(hit.id);
      
      // Rank primarily by matches (which combines identity and coverage),
      // then by identity, then by coverage.
      // This prevents tiny 100% identity matches from outweighing long 99% matches.
      const currentMatches = currentBest.matches || 0;
      const hitMatches = hit.matches || 0;
      
      const isBetter = hitMatches > currentMatches ||
        (hitMatches === currentMatches && hit.pidentNum > currentBest.pidentNum) ||
        (hitMatches === currentMatches && hit.pidentNum === currentBest.pidentNum && hit.qCovNum > currentBest.qCovNum);

      if (isBetter) {
        bestHitsMap.set(hit.id, hit);
      }
    }
  }
  return bestHitsMap;
};
