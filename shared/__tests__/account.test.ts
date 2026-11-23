import { cleanDisplayName, normaliseRecoveryCode, passwordProblem, usernameKey, usernameProblem } from '../account';

describe('usernameProblem', () => {
  it.each(['abc', 'Johan', 'j.schoultz', 'book_worm_2', 'a'.repeat(20)])('accepts %s', (name) => {
    expect(usernameProblem(name)).toBeNull();
  });

  it.each([
    ['ab', 'at least 3'],
    ['a'.repeat(21), 'at most 20'],
    ['has space', 'only letters'],
    ['émile', 'only letters'],
    ['jo-han', 'only letters'],
    ['.johan', 'dot'],
    ['johan.', 'dot'],
    ['jo..han', 'dot'],
  ])('refuses %s', (name, why) => {
    expect(usernameProblem(name)).toContain(why);
  });

  it('treats case as the same username', () => {
    expect(usernameKey(' Johan ')).toBe(usernameKey('johan'));
  });
});

describe('passwordProblem', () => {
  it('needs 10 to 200 characters', () => {
    expect(passwordProblem('123456789')).toContain('at least 10');
    expect(passwordProblem('1234567890')).toBeNull();
    expect(passwordProblem('x'.repeat(201))).toContain('at most 200');
  });
});

describe('cleanDisplayName', () => {
  it('trims, squeezes spaces and caps the length; empty is none', () => {
    expect(cleanDisplayName('  Johan   S  ')).toBe('Johan S');
    expect(cleanDisplayName('   ')).toBeNull();
    expect(cleanDisplayName(42)).toBeNull();
    expect(cleanDisplayName('x'.repeat(60))).toHaveLength(40);
  });
});

it('reads a recovery code however it is typed', () => {
  expect(normaliseRecoveryCode('7kq2 m9xa-0pzd 4rtb')).toBe('7KQ2M9XA0PZD4RTB');
});
