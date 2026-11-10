/** Unbiased d20 result, independent of the board's movement dice. */
export function rollD20(): number {
  const buffer = new Uint32Array(1);
  const limit = 0x100000000 - (0x100000000 % 20);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return (buffer[0] % 20) + 1;
}
