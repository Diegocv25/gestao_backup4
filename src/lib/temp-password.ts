// Senha temporária (não-final). Ainda assim, geramos algo que atende a política forte.
export function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const len = 12;
  const rnd = new Uint32Array(len);
  crypto.getRandomValues(rnd);
  const raw = Array.from(rnd)
    .map((n) => chars[n % chars.length])
    .join("");

  // garante ao menos 1 maiúscula e 1 número (regra forte)
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const r2 = new Uint32Array(2);
  crypto.getRandomValues(r2);
  return `${raw}${upper[r2[0] % upper.length]}${digits[r2[1] % digits.length]}`;
}
