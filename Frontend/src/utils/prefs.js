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

  // Custom accent colour as "#rrggbb". Empty string = use the theme's own accent.
  accent: "",

  // Custom page background colour "#rrggbb". Empty string = use the chosen background theme.
  customBg: "",
};

// Quick-pick background colours shown in Settings.
export const BG_PRESETS = [
  "#0F172A", // slate
  "#1E1B4B", // indigo
  "#052E16", // deep green
  "#4C0519", // wine
  "#FEF3C7", // cream yellow
  "#E0F2FE", // pale sky
  "#FCE7F3", // pale pink
];

// Quick-pick accent colours shown in Settings.
export const ACCENT_PRESETS = [
  "#B5652C", // KeyNova orange (default look)
  "#2B31DE", // blue
  "#7C3AED", // purple
  "#0EA5E9", // sky
  "#16A34A", // green
  "#DB2777", // pink
  "#DC2626", // red
];

// ---- accent helpers -------------------------------------------------------
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix([r, g, b], target, amount) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round(v + (target - v) * amount).toString(16).padStart(2, "0"))
      .join("")
  );
}

function luminance([r, g, b]) {
  const c = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

// Sets (or clears) the four accent CSS variables on <html>.
// Inline styles beat the theme rules, so this works in light AND dark mode.
export function applyAccent(hex, dark = false) {
  const root = document.documentElement.style;
  const names = ["--accent", "--accent-hover", "--accent-soft", "--accent-ink"];
  if (!/^#[0-9a-fA-F]{6}$/.test(hex || "")) {
    names.forEach((n) => root.removeProperty(n));
    return;
  }
  const rgb = hexToRgb(hex);
  root.setProperty("--accent", hex);
  root.setProperty("--accent-hover", dark ? mix(rgb, 255, 0.15) : mix(rgb, 0, 0.15));
  root.setProperty("--accent-soft", `rgba(${rgb[0]},${rgb[1]},${rgb[2]},.16)`);
  root.setProperty("--accent-ink", luminance(rgb) > 0.5 ? "#1A1409" : "#FFFFFF");
}

// Page background colour. Sets --custom-bg plus a matching set of text/card
// tokens so everything stays readable on dark OR light colours.
const CUSTOM_BG_TOKENS = [
  "--custom-bg", "--bg", "--bg-soft", "--card", "--card-hover",
  "--border", "--border-strong", "--text", "--text-muted", "--text-faint",
];

export function applyCustomBg(hex) {
  const root = document.documentElement;
  if (!/^#[0-9a-fA-F]{6}$/.test(hex || "")) {
    root.removeAttribute("data-custom-bg");
    CUSTOM_BG_TOKENS.forEach((n) => root.style.removeProperty(n));
    return;
  }
  const dark = luminance(hexToRgb(hex)) < 0.4;
  const tokens = dark
    ? {
        "--bg": "rgba(0,0,0,.28)", "--bg-soft": "rgba(255,255,255,.06)",
        "--card": "rgba(255,255,255,.07)", "--card-hover": "rgba(255,255,255,.11)",
        "--border": "rgba(255,255,255,.14)", "--border-strong": "rgba(255,255,255,.24)",
        "--text": "#F1EAD9", "--text-muted": "#BDB295", "--text-faint": "#8A806B",
      }
    : {
        "--bg": "rgba(255,255,255,.55)", "--bg-soft": "rgba(255,255,255,.4)",
        "--card": "rgba(255,255,255,.7)", "--card-hover": "rgba(255,255,255,.85)",
        "--border": "rgba(0,0,0,.1)", "--border-strong": "rgba(0,0,0,.18)",
        "--text": "#2A241C", "--text-muted": "#6F664E", "--text-faint": "#9C9378",
      };
  root.setAttribute("data-custom-bg", dark ? "dark" : "light");
  root.style.setProperty("--custom-bg", hex);
  Object.entries(tokens).forEach(([k, v]) => root.style.setProperty(k, v));
}

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

  result.accent = /^#[0-9a-fA-F]{6}$/.test(result.accent || "")
    ? result.accent
    : "";

  result.customBg = /^#[0-9a-fA-F]{6}$/.test(result.customBg || "")
    ? result.customBg
    : "";

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

  applyAccent(normalized.accent, normalized.dark);
  applyCustomBg(normalized.customBg);
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

    accentColor: normalized.accent,
    customBackground: normalized.customBg,
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

    accent: settings.accentColor,
    customBg: settings.customBackground,
  });
}