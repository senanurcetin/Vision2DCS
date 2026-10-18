import { describe, expect, it } from 'vitest';
import { scoreExplicitSignalConnections, summarizeTopology } from './topology';

const tags = ['FT-101', 'FIC-101', 'FCV-101'];
const labels = [
  { source: 'FT-101', target: 'FIC-101' },
  { source: 'FIC-101', target: 'FCV-101' },
];

describe('explicit directed signal-connection scoring', () => {
  it('canonicalizes endpoints and counts correct, missing and spurious directions', () => {
    const score = scoreExplicitSignalConnections(labels, tags, [
      { tagName: ' ft101 ', connectedTo: 'fic101' },
      { tagName: 'FIC-101', connectedTo: 'FT 101' },
      { tagName: 'FCV-101' },
    ]);
    expect(score).toEqual({
      expected: 2, extracted: 2, matched: 1,
      missed: ['FIC-101 -> FCV-101'], unexpected: ['FIC-101 -> FT-101'],
    });
  });

  it('does not claim inferred React Flow loop chains as model predictions', () => {
    const score = scoreExplicitSignalConnections(labels, tags, tags.map(tagName => ({ tagName })));
    expect(score).toMatchObject({ expected: 2, extracted: 0, matched: 0 });
    expect(summarizeTopology([score])).toEqual({ precision: 0, recall: 0, f1: 0 });
  });

  it('counts dangling and self-referencing model links as spurious, not correct', () => {
    const score = scoreExplicitSignalConnections(labels, tags, [
      { tagName: 'FT-101', connectedTo: 'UNREADABLE-999' },
      { tagName: 'FIC-101', connectedTo: 'FIC-101' },
    ]);
    expect(score.matched).toBe(0);
    expect(score.unexpected).toEqual(['FIC-101 -> FIC-101', 'FT-101 -> UNREADABLE-999']);
  });

  it('rejects ambiguous duplicates instead of selecting the latest topology guess', () => {
    expect(() => scoreExplicitSignalConnections(labels, tags, [
      { tagName: 'ft101', connectedTo: 'FIC-101' },
      { tagName: 'FT-101', connectedTo: 'FCV-101' },
    ])).toThrow('Conflicting extracted signal connection');
    expect(scoreExplicitSignalConnections(labels, tags, [
      { tagName: 'ft101', connectedTo: 'FIC-101' },
      { tagName: 'FT-101', connectedTo: 'FIC 101' },
    ]).extracted).toBe(1);
  });

  it('fails on duplicate, unknown or self-referential engineer labels', () => {
    expect(() => scoreExplicitSignalConnections([labels[0], { source: 'ft101', target: 'FIC 101' }], tags, []))
      .toThrow('Duplicate expected signal connection');
    expect(() => scoreExplicitSignalConnections([{ source: 'FT-101', target: 'PT-777' }], tags, []))
      .toThrow('unknown or self-referencing');
    expect(() => scoreExplicitSignalConnections([{ source: 'FT-101', target: 'FT-101' }], tags, []))
      .toThrow('unknown or self-referencing');
    expect(() => scoreExplicitSignalConnections(labels, ['FT-101', 'ft 101', 'FCV-101'], []))
      .toThrow('Duplicate canonical reference tag');
  });

  it('microaverages across drawings without averaging percentages', () => {
    const a = scoreExplicitSignalConnections(labels, tags, [
      { tagName: 'FT-101', connectedTo: 'FIC-101' },
    ]);
    const b = scoreExplicitSignalConnections([{ source: 'LT-201', target: 'LIC-201' }],
      ['LT-201', 'LIC-201'], [
        { tagName: 'LT-201', connectedTo: 'LIC-201' },
        { tagName: 'LIC-201', connectedTo: 'FT-999' },
      ]);
    const summary = summarizeTopology([a, b]);
    expect(summary.precision).toBeCloseTo(2 / 3);
    expect(summary.recall).toBeCloseTo(2 / 3);
    expect(summary.f1).toBeCloseTo(2 / 3);
  });

  it('does not fabricate perfect topology accuracy on empty labels and predictions', () => {
    expect(summarizeTopology([scoreExplicitSignalConnections([], [], [])]))
      .toEqual({ precision: 0, recall: 0, f1: 0 });
  });
});
