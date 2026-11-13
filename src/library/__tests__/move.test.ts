import { asMoveMessage } from '../move';

describe('asMoveMessage', () => {
  it('accepts each message the two sites send', () => {
    expect(asMoveMessage({ type: 'bookie-move:ready' })).toEqual({ type: 'bookie-move:ready' });
    expect(asMoveMessage({ type: 'bookie-move:library', backup: '{}', layoutMode: 'wrap' })).toEqual({
      type: 'bookie-move:library',
      backup: '{}',
      layoutMode: 'wrap',
    });
    expect(asMoveMessage({ type: 'bookie-move:done', added: 3, skipped: 1 })).toEqual({ type: 'bookie-move:done', added: 3, skipped: 1 });
    expect(asMoveMessage({ type: 'bookie-move:failed', message: 'Nope' })).toEqual({ type: 'bookie-move:failed', message: 'Nope' });
  });

  it('ignores anything else posted to the window', () => {
    expect(asMoveMessage(null)).toBeNull();
    expect(asMoveMessage('bookie-move:ready')).toBeNull();
    expect(asMoveMessage({ type: 'webpackOk' })).toBeNull();
    expect(asMoveMessage({ type: 'bookie-move:library', backup: { books: [] } })).toBeNull();
    expect(asMoveMessage({ type: 'bookie-move:done', added: '3', skipped: 0 })).toBeNull();
  });

  it('drops a layout it does not know and fills in a missing error message', () => {
    expect(asMoveMessage({ type: 'bookie-move:library', backup: '{}', layoutMode: 'grid' })).toEqual({
      type: 'bookie-move:library',
      backup: '{}',
      layoutMode: undefined,
    });
    expect(asMoveMessage({ type: 'bookie-move:failed' })).toEqual({ type: 'bookie-move:failed', message: 'Something went wrong.' });
  });
});
