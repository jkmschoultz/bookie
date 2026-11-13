import {
  checkHeight,
  checkIsbn,
  checkPageCount,
  checkReadingDates,
  checkSeriesIndex,
  checkYear,
  cleanGenre,
  decimalOnly,
  digitsOnly,
  formatDateTyping,
  isbnChars,
  isValidDate,
  isValidIsbn,
} from '../fields';

describe('typing filters', () => {
  it('keeps digits only, up to a length', () => {
    expect(digitsOnly('1,2a34 pages', 4)).toBe('1234');
    expect(digitsOnly('20245', 4)).toBe('2024');
  });

  it('keeps one decimal point', () => {
    expect(decimalOnly('2.5')).toBe('2.5');
    expect(decimalOnly('2..5.1')).toBe('2.51');
    expect(decimalOnly('#3')).toBe('3');
  });

  it('keeps ISBN characters', () => {
    expect(isbnChars('978-0-441 01359x!')).toBe('978-0-441 01359X');
  });
});

describe('field checks', () => {
  it('accepts empty fields', () => {
    for (const check of [checkPageCount, checkYear, checkHeight, checkSeriesIndex, checkIsbn]) expect(check('')).toBeNull();
  });

  it('checks page counts', () => {
    expect(checkPageCount('412')).toBeNull();
    expect(checkPageCount('0')).toMatch(/1 to 20,000/);
    expect(checkPageCount('99999')).toMatch(/1 to 20,000/);
  });

  it('checks years against next year', () => {
    const now = new Date('2026-11-13');
    expect(checkYear('1965', now)).toBeNull();
    expect(checkYear('2027', now)).toBeNull();
    expect(checkYear('2028', now)).toMatch(/1 to 2027/);
    expect(checkYear('0', now)).toMatch(/1 to 2027/);
  });

  it('checks heights and series numbers', () => {
    expect(checkHeight('198')).toBeNull();
    expect(checkHeight('12')).toMatch(/50 to 500/);
    expect(checkSeriesIndex('2.5')).toBeNull();
    expect(checkSeriesIndex('.')).not.toBeNull();
  });

  it('checks ISBN check digits', () => {
    expect(isValidIsbn('9780441013593')).toBe(true);
    expect(isValidIsbn('978-0-441-01359-3')).toBe(true);
    expect(isValidIsbn('0441013597')).toBe(true);
    expect(isValidIsbn('080442957X')).toBe(true);
    expect(isValidIsbn('9780441013594')).toBe(false);
    expect(checkIsbn('12345')).toMatch(/doesn’t look right/);
  });
});

describe('reading dates', () => {
  const today = '2026-11-13';

  it('puts the dashes in while typing', () => {
    expect(formatDateTyping('2024')).toBe('2024');
    expect(formatDateTyping('20240')).toBe('2024-0');
    expect(formatDateTyping('2024-03-175')).toBe('2024-03-17');
    expect(formatDateTyping('')).toBe('');
  });

  it('only accepts real dates', () => {
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2023-02-29')).toBe(false);
    expect(isValidDate('2024-13-01')).toBe(false);
    expect(isValidDate('24-1-1')).toBe(false);
  });

  it('allows either date to be empty', () => {
    expect(checkReadingDates('', '', today)).toEqual({ started: null, finished: null });
    expect(checkReadingDates('2026-01-02', '', today)).toEqual({ started: null, finished: null });
  });

  it('rejects future dates and finishing before starting', () => {
    expect(checkReadingDates('2026-12-01', '', today).started).toMatch(/future/);
    expect(checkReadingDates('2026-05-02', '2026-05-01', today).finished).toMatch(/before started/);
    expect(checkReadingDates('2026-05-02', '2026-05-02', today)).toEqual({ started: null, finished: null });
  });
});

describe('cleanGenre', () => {
  it('tidies what was typed and reuses an existing genre', () => {
    expect(cleanGenre('  cozy   mystery ', [])).toBe('cozy mystery');
    expect(cleanGenre('science fiction', ['Science Fiction', 'Poetry'])).toBe('Science Fiction');
    expect(cleanGenre('   ', [])).toBeNull();
  });
});
