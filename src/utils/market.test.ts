import { describe, expect, it } from 'vitest';
import { pickMidPrice, toNumber } from './market.js';

describe('toNumber', () => {
  it('passes finite numbers through', () => {
    expect(toNumber(146.123)).toBe(146.123);
    expect(toNumber(0)).toBe(0);
    expect(toNumber(-3.14)).toBe(-3.14);
  });

  it('parses numeric strings', () => {
    expect(toNumber('146.123')).toBe(146.123);
    expect(toNumber('0')).toBe(0);
  });

  it('returns undefined for nullish / empty', () => {
    expect(toNumber(undefined)).toBeUndefined();
    expect(toNumber(null)).toBeUndefined();
    expect(toNumber('')).toBeUndefined();
  });

  it('returns undefined for NaN and non-finite', () => {
    expect(toNumber('not-a-number')).toBeUndefined();
    expect(toNumber(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(toNumber(Number.NaN)).toBeUndefined();
  });
});

describe('pickMidPrice', () => {
  it('prefers latestMidPrice when present', () => {
    expect(pickMidPrice({ latestMidPrice: 146.5, bidPrice: 140, askPrice: 150 })).toBe(146.5);
  });

  it('falls back to (bid + ask) / 2 when mid is absent', () => {
    expect(pickMidPrice({ bidPrice: 140, askPrice: 150 })).toBe(145);
  });

  it('coerces string-form fields', () => {
    expect(pickMidPrice({ latestMidPrice: '146.123' })).toBe(146.123);
    expect(pickMidPrice({ bidPrice: '140', askPrice: '150' })).toBe(145);
  });

  it('returns undefined when no usable price exists', () => {
    expect(pickMidPrice({})).toBeUndefined();
    expect(pickMidPrice({ bidPrice: 140 })).toBeUndefined(); // need both bid AND ask for fallback
    expect(pickMidPrice(undefined)).toBeUndefined();
    expect(pickMidPrice(null)).toBeUndefined();
    expect(pickMidPrice({ latestMidPrice: 'NaN-ish' })).toBeUndefined();
  });
});
