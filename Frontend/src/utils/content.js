// Original, in-house content only — no copyrighted text.
export const WORD_BANK = ('the of and to in a is you that it he was for on are as with his '
  + 'they at be this from have or by one had not what all were we when your can said '
  + 'there use an each which she do how their if will up other about out many then them '
  + 'these so some her would make like him into time has look two more write go see number '
  + 'no way could people my than first water been call who oil its now find long down day '
  + 'did get come made may part over new sound take only little work know place year live '
  + 'me back give most very after thing our just name good sentence man think say great '
  + 'where help through much before line right too mean old any same tell boy follow came '
  + 'want show also around form three small set put end does another well large must big '
  + 'even such because turn here why ask went men read need land different home us move try')
  .split(' ');

export const QUOTES = [
  'Practice does not make perfect on its own; deliberate, focused repetition is what turns effort into skill.',
  'A calm mind and a light touch on the keys will always outpace tense, hurried fingers.',
  'Speed follows accuracy the way a shadow follows the sun, not the other way around.',
  'Every expert typist was once a beginner who refused to look away from the screen.',
  'The keyboard rewards patience; rushed hands make careless mistakes that cost more time than they save.',
  'Good rhythm is the quiet secret behind every fast and accurate typist.',
];

export const CODE_SNIPPETS = [
  'function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }',
  'const sum = (a, b) => a + b; const nums = [1, 2, 3].map(n => n * 2);',
  'for (let i = 0; i < items.length; i++) { total += items[i].price; }',
  'class Point { constructor(x, y) { this.x = x; this.y = y; } }',
  'def greet(name): return f"Hello, {name}!" print(greet("world"))',
  'if (user && user.isActive) { renderDashboard(user); } else { redirect("/login"); }',
];

export function randomWords(count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)]);
  return out.join(' ');
}

export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function buildTextFor(type, value, customText) {
  if (type === 'time') return randomWords(Math.max(40, Number(value) || 30));
  if (type === 'words') return randomWords(Number(value) || 25);
  if (type === 'quote') return pick(QUOTES);
  if (type === 'code') return pick(CODE_SNIPPETS);
  if (type === 'zen') return randomWords(400);
  if (type === 'custom') return (customText || '').trim() || 'Type your own text in the box above, then press "Use this text".';
  return randomWords(30);
}
