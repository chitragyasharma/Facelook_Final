const dom = {
  getElementById: () => ({ style: {}, addEventListener: () => {} }),
  querySelector: () => ({ style: {}, addEventListener: () => {} })
};
global.document = dom;
global.window = { location: { search: '' }, addEventListener: () => {} };
global.localStorage = { getItem: () => null };

require('./check_syntax.js');
