const WORDS = ("the quick brown fox jumps over lazy dog time flow speed accuracy focus keyboard "
  + "practice challenge stream light dark mode settings profile stats history rank streak daily "
  + "goal session word count minute second train improve rhythm flow finger key press type write "
  + "code build test deploy server client browser network data base user login sign register room "
  + "friend match race track progress result score level badge trophy compete join create share "
  + "invite link password secure token session cloud online offline mobile desktop tablet screen "
  + "design theme color font size layout button click tap swipe scroll page view load save export").split(' ');

const QUOTES = [
  "The only way to do great work is to love what you do, and every keystroke brings that vision closer to reality.",
  "Success is not final, failure is not fatal, it is the courage to continue that counts in every attempt you make.",
  "Typing fast is a skill built through patience, repetition, and a willingness to fail many times before you improve.",
  "In the middle of difficulty lies opportunity, and every challenge you face today builds the skill you need tomorrow.",
  "Practice does not make perfect, but perfect practice over time makes the difference between good and great typists."
];

const CODE_SNIPPETS = [
  "function add(a, b) {\n  return a + b;\n}\n\nconst sum = add(2, 3);\nconsole.log(sum);",
  "const users = data.filter(u => u.active).map(u => u.name);\nconsole.log(users.join(', '));",
  "class Room {\n  constructor(id, owner) {\n    this.id = id;\n    this.owner = owner;\n    this.players = [];\n  }\n}"
];

function randomWordText(count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  return out.join(' ');
}

function generateText({ mode, duration, wordCount, customText }) {
  if (mode === 'custom' && customText) return customText.trim().slice(0, 4000);
  if (mode === 'quote') return QUOTES[Math.floor(Math.random() * QUOTES.length)];
  if (mode === 'code') return CODE_SNIPPETS[Math.floor(Math.random() * CODE_SNIPPETS.length)];
  if (mode === 'words') return randomWordText(wordCount || 100);
  const approxWords = Math.max(60, Math.round((duration || 60) * 2.2));
  return randomWordText(approxWords);
}

module.exports = { generateText, WORDS, QUOTES, CODE_SNIPPETS };
