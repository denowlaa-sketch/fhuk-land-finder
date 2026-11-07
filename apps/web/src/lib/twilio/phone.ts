/**
 * Normalise UK phone numbers to E.164. Rejects sample / placeholder numbers
 * used in fixtures so we never dial them live.
 */

const SAMPLE_PATTERNS = [
  /^(\+44|0)?7{3,}0{2,}9{2,}/, // classic Ofcom / sample ranges
  /555/,
  /^(\+44|0)?7700\s*900/,
  /^(\+44|0)?7900\s*000/,
];

export function isSamplePhone(raw: string): boolean {
  const compact = raw.replace(/[\s()-]/g, "");
  return SAMPLE_PATTERNS.some((re) => re.test(compact));
}

/** Extract first phone-looking token from contact field ("07123… / email"). */
export function extractPhone(contact: string | null | undefined): string | null {
  if (!contact?.trim()) return null;
  const match = contact.match(
    /(\+?\d[\d\s().-]{8,}\d)/,
  );
  return match ? match[1].trim() : null;
}

export function toUkE164(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("+")) {
    const rest = digits.slice(1).replace(/\D/g, "");
    if (rest.startsWith("44") && rest.length >= 12) return `+${rest}`;
    return null;
  }
  const only = digits.replace(/\D/g, "");
  if (only.startsWith("44") && only.length >= 12) return `+${only}`;
  if (only.startsWith("0") && only.length === 11) {
    return `+44${only.slice(1)}`;
  }
  if (only.length === 10 && only.startsWith("7")) {
    return `+44${only}`;
  }
  return null;
}

export function assertDialableUkPhone(contact: string | null | undefined): string {
  const extracted = extractPhone(contact);
  if (!extracted) {
    throw new Error("Lead has no dialable phone number");
  }
  if (isSamplePhone(extracted)) {
    throw new Error("Refusing to dial sample / placeholder phone number");
  }
  const e164 = toUkE164(extracted);
  if (!e164) {
    throw new Error(`Phone is not a valid UK E.164 number: ${extracted}`);
  }
  return e164;
}
