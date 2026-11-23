import { constantTimeEqual, fromBase64Url, hashPassword, recoveryCode, toBase64Url, verifyPassword } from '../crypto';

describe('passwords', () => {
  it('hashes with a fresh salt and checks the right password only', async () => {
    const a = await hashPassword('correct horse battery', 1000);
    const b = await hashPassword('correct horse battery', 1000);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(await verifyPassword('correct horse battery', a)).toBe(true);
    expect(await verifyPassword('correct horse batterY', a)).toBe(false);
  });

  it('uses the most iterations Workers allow by default', async () => {
    expect((await hashPassword('correct horse battery')).iterations).toBe(100_000);
  });
});

it('compares strings of any length without short cuts', () => {
  expect(constantTimeEqual('abc', 'abc')).toBe(true);
  expect(constantTimeEqual('abc', 'abd')).toBe(false);
  expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  expect(constantTimeEqual('', '')).toBe(true);
});

it('round-trips base64url', () => {
  const bytes = new Uint8Array([0, 251, 255, 62, 63, 1]);
  expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
  expect(toBase64Url(bytes)).not.toMatch(/[+/=]/);
});

it('makes recovery codes of four groups of four', () => {
  expect(recoveryCode()).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
  expect(recoveryCode()).not.toBe(recoveryCode());
});
