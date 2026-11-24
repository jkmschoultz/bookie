import { nextTransition } from '../screenTransition';

describe('nextTransition', () => {
  it('goes forward to a new screen, and rises for a sheet', () => {
    expect(nextTransition(['/'], '/add')).toEqual({ transition: 'sheet-open', trail: ['/', '/add'] });
    expect(nextTransition(['/', '/add'], '/add/search')).toEqual({ transition: 'forward', trail: ['/', '/add', '/add/search'] });
    expect(nextTransition(['/', '/settings'], '/book/3')).toMatchObject({ transition: 'sheet-open' });
  });

  it('goes back to a screen already on the trail', () => {
    expect(nextTransition(['/', '/add', '/add/search'], '/add')).toEqual({ transition: 'back', trail: ['/', '/add'] });
  });

  it('closes as a sheet when leaving one, even several screens deep', () => {
    expect(nextTransition(['/', '/add', '/add/search', '/add/manual'], '/')).toEqual({ transition: 'sheet-close', trail: ['/'] });
    expect(nextTransition(['/', '/settings'], '/')).toMatchObject({ transition: 'sheet-close' });
  });

  it('leaves the trip between the shelf and a book page to the flying book', () => {
    expect(nextTransition(['/'], '/book/3')).toEqual({ transition: null, trail: ['/', '/book/3'] });
    expect(nextTransition(['/', '/book/3'], '/')).toEqual({ transition: null, trail: ['/'] });
  });

  it('leaves the trip between a friend’s shelf and one of their books to the flying book too', () => {
    const shelf = ['/', '/friends', '/friends/abc'];
    expect(nextTransition(shelf, '/friends/abc/book/x1')).toEqual({ transition: null, trail: [...shelf, '/friends/abc/book/x1'] });
    expect(nextTransition([...shelf, '/friends/abc/book/x1'], '/friends/abc')).toEqual({ transition: null, trail: shelf });
    // Your own copy, opened from their book's page, rises as a sheet.
    expect(nextTransition([...shelf, '/friends/abc/book/x1'], '/book/3')).toMatchObject({ transition: 'sheet-open' });
  });

  it('leaves the trip between the Friends hallway and a friend’s shelf to the hallway’s turn', () => {
    expect(nextTransition(['/', '/friends'], '/friends/abc')).toEqual({ transition: null, trail: ['/', '/friends', '/friends/abc'] });
    expect(nextTransition(['/', '/friends', '/friends/abc'], '/friends')).toEqual({ transition: null, trail: ['/', '/friends'] });
    expect(nextTransition(['/'], '/friends')).toMatchObject({ transition: 'forward' });
  });

  it('does nothing when the path stays the same', () => {
    expect(nextTransition(['/', '/book/3'], '/book/3')).toEqual({ transition: null, trail: ['/', '/book/3'] });
  });
});
