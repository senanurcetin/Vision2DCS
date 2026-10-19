/** Strict PNG container verification for offline, human-labelled benchmarks.
 * This checks chunk ordering, bounds, metadata and PNG CRC32 checksums.
 * It does not claim to decode pixels or detect malicious image content.
 */
export const MAX_BENCHMARK_PNG_DIMENSION = 16_384;
export const MAX_BENCHMARK_PNG_PIXELS = 100_000_000;
const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < CRC_TABLE.length; i++) {
  let entry = i;
  for (let bit = 0; bit < 8; bit++) {
    entry = (entry & 1) ? (0xedb88320 ^ (entry >>> 1)) : entry >>> 1;
  }
  CRC_TABLE[i] = entry >>> 0;
}
const chunkCrc = (bytes: Buffer, start: number, end: number): number => {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

export const validateBenchmarkPng = (bytes: Buffer): { width: number; height: number } => {
  if (bytes.length < 57 || !SIGNATURE.every((value, index) => bytes[index] === value)) {
    throw new Error('Missing PNG signature or required chunks.');
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let ihdr = false;
  let imageData = false;
  let ended = false;
  while (offset < bytes.length) {
    if (bytes.length - offset < 12) throw new Error('Truncated PNG chunk header.');
    const length = bytes.readUInt32BE(offset);
    // Subtract 12 before adding to avoid integer overflow and out-of-bounds reads.
    if (length > bytes.length - offset - 12) throw new Error('Truncated PNG chunk data.');
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (!/^[A-Za-z]{4}$/.test(type)) throw new Error('Invalid PNG chunk type.');
    const expected = bytes.readUInt32BE(offset + 8 + length);
    const actual = chunkCrc(bytes, offset + 4, offset + 8 + length);
    if (actual !== expected) throw new Error('Incorrect PNG chunk CRC.');

    if (!ihdr) {
      if (type !== 'IHDR' || length !== 13) throw new Error('PNG must start with a valid IHDR.');
      width = bytes.readUInt32BE(offset + 8);
      height = bytes.readUInt32BE(offset + 12);
      const bitDepth = bytes[offset + 16];
      const colorType = bytes[offset + 17];
      const compression = bytes[offset + 18];
      const filtering = bytes[offset + 19];
      const interlace = bytes[offset + 20];
      const depths: Record<number, readonly number[]> = {
        0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8],
        4: [8, 16], 6: [8, 16],
      };
      if (width < 1 || height < 1 ||
          width > MAX_BENCHMARK_PNG_DIMENSION || height > MAX_BENCHMARK_PNG_DIMENSION ||
          width * height > MAX_BENCHMARK_PNG_PIXELS ||
          !depths[colorType]?.includes(bitDepth) ||
          compression !== 0 || filtering !== 0 || (interlace !== 0 && interlace !== 1)) {
        throw new Error('Unsupported or unreasonable PNG dimensions or header fields.');
      }
      ihdr = true;
    } else if (type === 'IHDR') {
      throw new Error('Duplicate PNG IHDR chunk.');
    }

    if (type === 'IDAT') {
      if (!length) throw new Error('Empty PNG image data chunk.');
      imageData = true;
    }
    offset += length + 12;
    if (type === 'IEND') {
      if (length !== 0 || !imageData || offset !== bytes.length) {
        throw new Error('Invalid PNG end or trailing bytes.');
      }
      ended = true;
      break;
    }
  }
  if (!ended) throw new Error('PNG has no complete image data and terminal IEND chunk.');
  return { width, height };
};
