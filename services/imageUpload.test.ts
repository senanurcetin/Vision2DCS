import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES, scaleToFit, validateImageFile } from './imageUpload';

describe('validateImageFile', () => {
  it('accepts supported images within the size limit', () => {
    expect(validateImageFile({ type: 'image/png', size: 1024 })).toBeNull();
    expect(validateImageFile({ type: 'image/webp', size: MAX_UPLOAD_BYTES })).toBeNull();
  });

  it('rejects other types and oversized files with a reason', () => {
    expect(validateImageFile({ type: 'application/pdf', size: 1024 })).toMatch(/Unsupported/);
    expect(validateImageFile({ type: 'image/gif', size: 1024 })).toMatch(/Unsupported/);
    expect(validateImageFile({ type: 'image/jpeg', size: MAX_UPLOAD_BYTES + 1 })).toMatch(/too large/);
  });
});

describe('scaleToFit', () => {
  it('keeps images that already fit', () => {
    expect(scaleToFit(1600, 1200, 2048)).toEqual({ width: 1600, height: 1200 });
  });

  it('shrinks the longest side to the limit and keeps the aspect ratio', () => {
    expect(scaleToFit(4096, 2048, 2048)).toEqual({ width: 2048, height: 1024 });
    expect(scaleToFit(3000, 6000, 2048)).toEqual({ width: 1024, height: 2048 });
  });
});
