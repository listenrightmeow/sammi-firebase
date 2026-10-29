// CRC-32 (IEEE 802.3), hex. Used for [index] hashes, which detect documents edited in the ini while
// the Bridge was closed (rule 7). Not a security hash.
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let c = 0xffffffff;
  for (const b of bytes) c = (TABLE[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}
