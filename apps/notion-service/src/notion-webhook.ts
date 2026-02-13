import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_PREFIX = 'sha256=';

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyNotionWebhookSignature(input: {
  body: string;
  signatureHeader: string | null;
  verificationToken: string;
}): boolean {
  const signature = input.signatureHeader?.trim();
  if (!signature) {
    return false;
  }

  const digest = createHmac('sha256', input.verificationToken)
    .update(input.body, 'utf8')
    .digest('hex');
  const expected = `${SIGNATURE_PREFIX}${digest}`;
  return safeEquals(signature, expected);
}
