import { describe, it, expect } from 'vitest';
import { parseFasta, selectBestHits } from './utils';

describe('parseFasta', () => {
  it('correctly parses a single sequence', () => {
    const input = '>seq1\nATGC';
    const { sequences, errors } = parseFasta(input);
    expect(sequences).toHaveLength(1);
    expect(sequences[0]).toEqual({ id: 'seq1', seq: 'ATGC' });
    expect(errors).toHaveLength(0);
  });

  it('correctly parses multiple sequences', () => {
    const input = '>seq1\nATGC\n>seq2\nGGCC';
    const { sequences, errors } = parseFasta(input);
    expect(sequences).toHaveLength(2);
    expect(sequences[0].id).toBe('seq1');
    expect(sequences[1].id).toBe('seq2');
    expect(errors).toHaveLength(0);
  });

  it('handles sequences with whitespaces and multiline sequences', () => {
    const input = '>seq 1\nAT GC\n ATGC';
    const { sequences, errors } = parseFasta(input);
    expect(sequences[0].id).toBe('seq 1');
    expect(sequences[0].seq).toBe('ATGCATGC');
  });

  it('detects invalid IUPAC characters', () => {
    const input = '>seq1\nATG Z'; // 'Z' is not valid in IUPAC DNA/RNA
    const { errors } = parseFasta(input);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Invalid characters');
  });

  it('handles trailing spaces in header correctly', () => {
    const input = '>seq1   \nATGC';
    const { sequences } = parseFasta(input);
    expect(sequences[0].id).toBe('seq1');
  });

  it('correctly handles ID with spaces by preserving them', () => {
    const input = '>Sample ID 123\nATGC';
    const { sequences } = parseFasta(input);
    expect(sequences[0].id).toBe('Sample ID 123');
  });
});

describe('selectBestHits', () => {
  it('picks the only hit when only one exists', () => {
    const hits = [{ id: 'q1', reference: 'refA', pidentNum: 95, qCovNum: 80, tCovNum: 80 }];
    const best = selectBestHits(hits);
    expect(best.get('q1').reference).toBe('refA');
  });

  it('ranks by identity primarily', () => {
    const hits = [
      { id: 'q1', reference: 'refA', pidentNum: 95, qCovNum: 100, tCovNum: 100 },
      { id: 'q1', reference: 'refB', pidentNum: 98, qCovNum: 50, tCovNum: 50 }
    ];
    const best = selectBestHits(hits);
    expect(best.get('q1').reference).toBe('refB');
  });

  it('ranks by query coverage secondarily', () => {
    const hits = [
      { id: 'q1', reference: 'refA', pidentNum: 98, qCovNum: 80, tCovNum: 100 },
      { id: 'q1', reference: 'refB', pidentNum: 98, qCovNum: 90, tCovNum: 50 }
    ];
    const best = selectBestHits(hits);
    expect(best.get('q1').reference).toBe('refB');
  });

  it('ranks by target coverage tertiarily', () => {
    const hits = [
      { id: 'q1', reference: 'refA', pidentNum: 98, qCovNum: 90, tCovNum: 100 },
      { id: 'q1', reference: 'refB', pidentNum: 98, qCovNum: 90, tCovNum: 80 }
    ];
    const best = selectBestHits(hits);
    expect(best.get('q1').reference).toBe('refA');
  });
});

describe('Mapping Scenarios (Reference Dataset Examples)', () => {
  it('correctly selects hit for Cluster 1 representative', () => {
    // In a real scenario, this would come from minimap2 output via Aioli
    const mockAlignments = [
      {
        id: 'MySequence',
        reference: 'Cluster_1/Cluster A',
        pidentNum: 100.0,
        qCovNum: 100.0,
        tCovNum: 100.0
      },
      {
        id: 'MySequence',
        reference: 'Cluster_2/Cluster B',
        pidentNum: 85.0,
        qCovNum: 90.0,
        tCovNum: 90.0
      }
    ];

    const best = selectBestHits(mockAlignments);
    const hit = best.get('MySequence');
    expect(hit.reference).toBe('Cluster_1/Cluster A');
    expect(hit.pidentNum).toBe(100.0);
  });

  it('correctly selects hit for Cluster 2 representative', () => {
    const mockAlignments = [
      {
        id: 'MySequence2',
        reference: 'Cluster_2/Cluster B',
        pidentNum: 99.5,
        qCovNum: 100.0,
        tCovNum: 100.0
      },
      {
        id: 'MySequence2',
        reference: 'Cluster_1/Cluster A',
        pidentNum: 80.0,
        qCovNum: 85.0,
        tCovNum: 85.0
      }
    ];

    const best = selectBestHits(mockAlignments);
    const hit = best.get('MySequence2');
    expect(hit.reference).toBe('Cluster_2/Cluster B');
    expect(hit.pidentNum).toBe(99.5);
  });
});
