const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const REFERENCE_LENGTH = 8;

export const ORDER_REFERENCE_PREFIX = "SV-";
export const ORDER_REFERENCE_PATTERN = new RegExp(
  `^${ORDER_REFERENCE_PREFIX}[${ALPHABET}]{${REFERENCE_LENGTH}}$`,
);

export function isOrderReference(value: string) {
  return ORDER_REFERENCE_PATTERN.test(value);
}

export function createOrderReference(
  randomBytes: (length: number) => Uint8Array = defaultRandomBytes,
) {
  const bytes = randomBytes(REFERENCE_LENGTH);

  let reference = "";

  for (const byte of bytes) {
    reference += ALPHABET[byte % ALPHABET.length];
  }

  return `${ORDER_REFERENCE_PREFIX}${reference}`;
}

function defaultRandomBytes(length: number) {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function createPaymentReference(
  randomBytes: (length: number) => Uint8Array = defaultRandomBytes,
) {
  const bytes = randomBytes(16);

  let reference = "";

  for (const byte of bytes) {
    reference += ALPHABET[byte % ALPHABET.length];
  }

  return `sv_${reference.toLowerCase()}`;
}
