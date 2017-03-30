'use strict';

describe('Server tests', function() {
  it('success test', function() {
    var bool = true;
    expect(bool).toBe(true);
    expect(1).toBe(1);
  });

  it('failure test', function() {
    var bool = true;
    expect(bool).toBe(false);
  });
});
