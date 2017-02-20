'use strict';

describe('Server tests', function() {
  it('success test', function() {
    var bool = true;
    expect(bool).toBe(true);
  });

  it('failure test', function() {
    var bool = true;
    expect(bool).toBe(false);
  });
});
