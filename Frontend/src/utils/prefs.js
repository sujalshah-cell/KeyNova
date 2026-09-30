// ============================================================
// KEYNOVA — LOCAL UI PREFERENCES
// ============================================================

const KEY = "tf_prefs";

// ============================================================
// BACKGROUND THEMES
// ============================================================

export const BACKGROUND_THEMES = [
  { id: "clean-white", label: "Clean White" },
  { id: "midnight", label: "Midnight" },
  { id: "deep-ocean", label: "Deep Ocean" },
  { id: "aurora", label: "Aurora" },
  { id: "sunset", label: "Sunset" },
  { id: "cyber-grid", label: "Cyber Grid" },
  { id: "neon", label: "Neon" },
  { id: "minimal-gray", label: "Minimal Gray" },
  { id: "purple-dream", label: "Purple Dream" },
  { id: "forest", label: "Forest" },
  { id: "cherry", label: "Cherry" },
  { id: "solar", label: "Solar" },
  { id: "glass", label: "Glass" },
  { id: "matrix", label: "Matrix" },
  { id: "cosmic", label: "Cosmic" },
];

// ============================================================
// TYPING EFFECTS
// ============================================================

export const TYPING_EFFECTS = [
  { id: "none", label: "None" },
  { id: "smooth", label: "Smooth" },
  { id: "glow", label: "Glow" },
  { id: "neon", label: "Neon" },
  { id: "pulse", label: "Pulse" },
  { id: "wave", label: "Wave" },
  { id: "typewriter", label: "Typewriter" },
  { id: "fade", label: "Fade" },
  { id: "bounce", label: "Bounce" },
  { id: "highlight", label: "Highlight" },
];

// ============================================================
// ERROR EFFECTS
// ============================================================

export const ERROR_EFFECTS = [
  { id: "shake", label: "Shake" },
  { id: "flash", label: "Flash" },
  { id: "none", label: "None" },
];

// ============================================================
// CORRECT CHARACTER EFFECTS
// ============================================================

export const CORRECT_EFFECTS = [
  { id: "none", label: "None" },
  { id: "pop", label: "Pop" },
  { id: "underline", label: "Underline" },
];

// ============================================================
// WORD COMPLETION EFFECTS
// ============================================================

export const WORD_COMPLETE_EFFECTS = [
  { id: "none", label: "None" },
  { id: "pulse", label: "Pulse" },
  { id: "check", label: "Checkmark flash" },
];

// ============================================================
// FONT OPTIONS
// IDs must match the CSS data-font mappings.
// ============================================================

export const FONTS = [
  { id: "poppins", label: "Poppins (Default)" },
  { id: "inter", label: "Inter" },
  { id: "mono", label: "JetBrains Mono" },
  { id: "system", label: "System UI" },

  { id: "pacific", label: "Pacifico" },
  { id: "urban", label: "Urbanist" },
  { id: "climate-crisis", label: "Climate Crisis" },
  { id: "standard", label: "Roboto" },
  { id: "alternates", label: "Oswald" },
  { id: "clarity-city", label: "Space Grotesk" },
  { id: "east-side", label: "Playfair Display" },
  { id: "cultural", label: "Merriweather" },
  { id: "geyser", label: "Fira Code" },
  { id: "pixelate", label: "Press Start 2P" },
  { id: "un-8", label: "Orbitron" },
  { id: "saint-honore", label: "Lora" },
  { id: "plex-mono", label: "IBM Plex Mono" },
];

// ============================================================
// DEFAULT PREFERENCES
// ============================================================

const DEFAULTS = {
  dark: false,
  fontsize: 23,

  sound: false,
  keyboardSounds: false,
  stopOnError: false,

  caret: "line",

  backgroundTheme: "clean-white",

  typingEffect: "none",
  errorEffect: "shake",
  correctEffect: "none",
  wordCompleteEffect: "none",

  font: "poppins",
  uiDensity: "comfortable",
};

// ============================================================
// VALIDATION HELPERS
// Prevent invalid or outdated saved values from breaking UI.
// ============================================================

function normalizePrefs(saved = {}) {
  const result = {
    ...DEFAULTS,
    ...saved,
  };

  const valid = (list, value, fallback) =>
    list.some((item) => item.id === value)
      ? value
      : fallback;

  result.backgroundTheme = valid(
    BACKGROUND_THEMES,
    result.backgroundTheme,
    DEFAULTS.backgroundTheme
  );

  result.font = valid(
    FONTS,
    result.font,
    DEFAULTS.font
  );

  result.typingEffect = valid(
    TYPING_EFFECTS,
    result.typingEffect,
    DEFAULTS.typingEffect
  );

  result.errorEffect = valid(
    ERROR_EFFECTS,
    result.errorEffect,
    DEFAULTS.errorEffect
  );

  result.correctEffect = valid(
    CORRECT_EFFECTS,
    result.correctEffect,
    DEFAULTS.correctEffect
  );

  result.wordCompleteEffect = valid(
    WORD_COMPLETE_EFFECTS,
    result.wordCompleteEffect,
    DEFAULTS.wordCompleteEffect
  );

  result.dark = Boolean(result.dark);
  result.sound = Boolean(result.sound);
  result.keyboardSounds = Boolean(result.keyboardSounds);
  result.stopOnError = Boolean(result.stopOnError);

  result.fontsize = [19, 23, 28].includes(
    Number(result.fontsize)
  )
    ? Number(result.fontsize)
    : DEFAULTS.fontsize;

  result.caret = ["line", "block"].includes(result.caret)
    ? result.caret
    : DEFAULTS.caret;

  result.uiDensity = ["comfortable", "compact"].includes(
    result.uiDensity
  )
    ? result.uiDensity
    : DEFAULTS.uiDensity;

  return result;
}

// ============================================================
// GET LOCAL PREFERENCES
// ============================================================

export function getPrefs() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(KEY) || "{}"
    );

    return normalizePrefs(saved);
  } catch (error) {
    console.error(
      "Unable to load KeyNova preferences:",
      error
    );

    return { ...DEFAULTS };
  }
}

// ============================================================
// SAVE LOCAL PREFERENCES
// ============================================================

export function savePrefs(prefs) {
  try {
    const updated = normalizePrefs({
      ...getPrefs(),
      ...prefs,
    });

    localStorage.setItem(
      KEY,
      JSON.stringify(updated)
    );

    return updated;
  } catch (error) {
    console.error(
      "Unable to save KeyNova preferences:",
      error
    );

    return getPrefs();
  }
}

// ============================================================
// APPLY PREFERENCES TO THE HTML DOCUMENT
// ============================================================

export function applyPrefsToDocument(prefs = getPrefs()) {
  const normalized = normalizePrefs(prefs);
  const root = document.documentElement;

  root.dataset.theme = normalized.dark
    ? "dark"
    : "light";

  root.dataset.bgTheme = normalized.backgroundTheme;
  root.dataset.font = normalized.font;
  root.dataset.density = normalized.uiDensity;

  root.style.setProperty(
    "--typing-font-size",
    `${normalized.fontsize}px`
  );

  root.dataset.typingEffect = normalized.typingEffect;
  root.dataset.errorEffect = normalized.errorEffect;
  root.dataset.correctEffect = normalized.correctEffect;
  root.dataset.wordEffect = normalized.wordCompleteEffect;
  root.dataset.caret = normalized.caret;
}

// ============================================================
// UPDATE ONE PREFERENCE
// ============================================================

export function updatePref(name, value) {
  const updated = savePrefs({
    [name]: value,
  });

  applyPrefsToDocument(updated);

  return updated;
}

// ============================================================
// CONVERT LOCAL SETTINGS TO BACKEND SETTINGS
// ============================================================

export function toBackendSettings(prefs) {
  const normalized = normalizePrefs(prefs);

  return {
    theme: normalized.dark ? "dark" : "light",

    soundEnabled: normalized.sound,
    keyboardSounds: normalized.keyboardSounds,

    backgroundTheme: normalized.backgroundTheme,

    font: normalized.font,
    fontSize: normalized.fontsize,

    uiDensity: normalized.uiDensity,

    typingEffect: normalized.typingEffect,
    caretStyle: normalized.caret,

    errorEffect: normalized.errorEffect,
    correctEffect: normalized.correctEffect,
    wordCompleteEffect: normalized.wordCompleteEffect,
  };
}

// ============================================================
// LOAD SETTINGS FROM THE BACKEND
// ============================================================

export function fromBackendSettings(settings) {
  if (!settings) {
    return {};
  }

  return normalizePrefs({
    dark: settings.theme === "dark",

    sound: settings.soundEnabled,
    keyboardSounds: settings.keyboardSounds,

    backgroundTheme: settings.backgroundTheme,

    font: settings.font,
    fontsize: settings.fontSize,

    uiDensity: settings.uiDensity,

    typingEffect: settings.typingEffect,
    caret: settings.caretStyle,

    errorEffect: settings.errorEffect,
    correctEffect: settings.correctEffect,
    wordCompleteEffect: settings.wordCompleteEffect,
  });
}