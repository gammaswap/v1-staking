export function expandDecimals(n, decimals) {
  return BigInt(n) * BigInt(10 ** decimals);
}
