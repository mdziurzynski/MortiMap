import { describe, it, expect } from 'vitest';
import { nwAlign } from './nwaligner';

describe('Needleman-Wunsch Aligner', () => {
  it('should optimally align identical sequences', () => {
    const seq = "ATCGATCGAATCG";
    const res = nwAlign(seq, seq);
    expect(res.identity).toBe(1);
    expect(res.qcov).toBe(1);
    expect(res.matches).toBe(seq.length);
  });

  it('should handle terminal mismatches without dropping coverage (semi-global)', () => {
    // User reported bug: changing last A to G caused 1.6% coverage
    const seq1 = "AACACCTCAAAGCCTTTTTTCTTTTTTTGAAGAAAGACTTTGGACTTGAGCAATCCCAACACTATCTCTTGAGATTGGGGGCGGGTTGCTTGAAATGCAGGTGCAGCTGGACTTTCTCCTGAGCTAAAAGCATATTCATTTAGTCCCGTCAAACGGATTATTACTTTTGCTGCAGCTAACATAAAGGGAGTTTGACCATTTTGGCTGACTGATGCAGGATTTTCACAAGAGTCTTCAAAAACCCTTGTTAA";
    const seq2 = "AACACCTCAAAGCCTTTTTTCTTTTTTTGAAGAAAGACTTTGGACTTGAGCAATCCCAACACTATCTCTTGAGATTGGGGGCGGGTTGCTTGAAATGCAGGTGCAGCTGGACTTTCTCCTGAGCTAAAAGCATATTCATTTAGTCCCGTCAAACGGATTATTACTTTTGCTGCAGCTAACATAAAGGGAGTTTGACCATTTTGGCTGACTGATGCAGGATTTTCACAAGAGTCTTCAAAAACCCTTGTTAG";
    
    const res = nwAlign(seq1, seq2);
    
    // In semi-global, it might choose to gap the end to maintain 100% identity,
    // or include it as a mismatch. Either way, coverage should be near 100%.
    expect(res.qcov).toBeGreaterThan(0.99);
    expect(res.tcov).toBeGreaterThan(0.99);
    expect(res.matches).toBeGreaterThan(249);
  });

  it('should handle gaps optimally', () => {
    const seq1 = "ATCGATCGAATCG";
    const seq2 = "ATCG---GAATCG"; // 3bp gap
    const res = nwAlign(seq1, seq2);
    expect(res.matches).toBe(10);
    expect(res.alnLength).toBe(13);
  });
});
