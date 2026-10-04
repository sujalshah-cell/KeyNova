import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as authService from '../services/authService';
import LoginMethods from '../components/LoginMethods';

import {
  getPrefs,
  savePrefs,
  applyPrefsToDocument,
  toBackendSettings,
  BACKGROUND_THEMES,
  TYPING_EFFECTS,
  ERROR_EFFECTS,
  CORRECT_EFFECTS,
  WORD_COMPLETE_EFFECTS,
  FONTS,
  ACCENT_PRESETS,
  BG_PRESETS,
} from '../utils/prefs';

export default function Settings() {
  const { user, refreshUser, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [prefs, setPrefs] = useState(() => getPrefs());
  const [syncing, setSyncing] = useState(false);

  const syncTimer = useRef(null);
  const pendingRef = useRef(null); // latest prefs waiting for the debounced sync
  const mountedRef = useRef(true);

  // ============================================================
  // CLEAN UP PENDING TIMERS WHEN THE PAGE UNMOUNTS
  // ============================================================

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        syncTimer.current = null;

        // Leaving the page before the debounce fired: send the pending
        // change now so it is not lost (otherwise the older server value
        // would overwrite it on the next load).
        if (pendingRef.current) {
          authService
            .updateSettings(toBackendSettings(pendingRef.current))
            .then((updated) =>
              // keep the cached user in step so the next load does not
              // restore the old server value over the new local one
              refreshUser(
                {
                  settings:
                    updated?.settings ??
                    updated?.user?.settings ??
                    updated,
                },
                { ownSave: true }
              )
            )
            .catch(() => {});
          pendingRef.current = null;
        }
      }
    };
  }, []);

  // ============================================================
  // UPDATE PREFERENCES
  // ============================================================

  const update = (patch) => {
    const next = {
      ...prefs,
      ...patch,
    };

    setPrefs(next);

    // Save preferences locally.
    savePrefs(next);

    // Apply preferences immediately to the document.
    applyPrefsToDocument(next);

    // Guests use local preferences only.
    if (!user) return;

    // Cancel any pending synchronization.
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
    }

    // Debounce backend synchronization.
    pendingRef.current = next;
    syncTimer.current = setTimeout(() => {
      syncTimer.current = null;
      pendingRef.current = null;
      syncToBackend(next);
    }, 400);
  };

  // ============================================================
  // SYNCHRONIZE PREFERENCES WITH BACKEND
  // ============================================================

  const syncToBackend = async (next) => {
    if (!mountedRef.current) return;

    setSyncing(true);

    try {
      const updated = await authService.updateSettings(
        toBackendSettings(next)
      );

      if (!mountedRef.current) return;

      refreshUser(
        {
          settings:
            updated?.settings ??
            updated?.user?.settings ??
            updated,
        },
        { ownSave: true }
      );
    } catch (error) {
      if (!mountedRef.current) return;

      showToast(
        "Saved on this device — couldn't sync to your account right now."
      );
    } finally {
      if (mountedRef.current) {
        setSyncing(false);
      }
    }
  };

  // ============================================================
  // LOG OUT
  // ============================================================

  const onLogout = () => {
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
      syncTimer.current = null;
    }

    logout();
    navigate('/login');
  };

  // ============================================================
  // RESET LOCAL PREFERENCES
  // ============================================================

  const onResetLocalData = () => {
    const confirmed = window.confirm(
      'This clears locally cached preferences on this device. Your account data on the server is not affected.'
    );

    if (!confirmed) return;

    // Prevent a pending update from syncing after the reset.
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
      syncTimer.current = null;
    }

    localStorage.removeItem('tf_prefs');

    const fresh = getPrefs();

    setPrefs(fresh);
    savePrefs(fresh);
    applyPrefsToDocument(fresh);

    showToast('Local preferences reset');
  };

  // ============================================================
  // SETTINGS PAGE
  // ============================================================

  return (
    <>
      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <div className="view-header">
        <h2>Settings</h2>

        <p>
          Tune how KeyNova looks, sounds, and behaves.
          {syncing && ' Syncing…'}
        </p>
      </div>

      {/* ======================================================
          APPEARANCE
      ====================================================== */}

      <div className="settings-section-title">
        Appearance
      </div>

      <div className="card settings-card">
        {/* ---------------- Background Theme ---------------- */}

        <div className="settings-row settings-row-col">
          <div>
            <h4>Background theme</h4>
            <p>Pick a distinct look for the whole app.</p>
          </div>

          <div
            className="theme-grid"
            role="radiogroup"
            aria-label="Background theme"
          >
            {BACKGROUND_THEMES.map((theme) => {
              // While a custom colour is active it overrides the theme, so no
              // theme swatch is shown as selected.
              const selected =
                !prefs.customBg &&
                prefs.backgroundTheme === theme.id;

              return (
                <button
                  key={theme.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={[
                    'theme-swatch',
                    `swatch-${theme.id}`,
                    selected ? 'active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() =>
                    // Picking a theme also drops any custom colour,
                    // otherwise the custom colour would keep covering it.
                    update({
                      backgroundTheme: theme.id,
                      customBg: '',
                    })
                  }
                >
                  <span
                    className="swatch-preview"
                    aria-hidden="true"
                  />

                  <span className="swatch-label">
                    {theme.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ---------------- Custom background colour ---------------- */}

          <div className="custom-bg-row">
            <div>
              <h4>Custom background color</h4>
              <p>
                {prefs.customBg
                  ? 'Custom color is active — click a theme above, or “Use theme”, to switch back.'
                  : 'Pick any color — it replaces the theme background above.'}
              </p>
            </div>

            <div className="accent-controls">
              {BG_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`accent-dot${
                    prefs.customBg.toLowerCase() === color.toLowerCase() ? ' active' : ''
                  }`}
                  style={{ background: color }}
                  onClick={() => update({ customBg: color })}
                  aria-label={`Use background color ${color}`}
                  aria-pressed={prefs.customBg.toLowerCase() === color.toLowerCase()}
                />
              ))}

              <input
                type="color"
                className="accent-picker"
                value={prefs.customBg || '#1e1b4b'}
                onChange={(event) => update({ customBg: event.target.value })}
                aria-label="Pick a custom background color"
              />

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => update({ customBg: '' })}
                disabled={!prefs.customBg}
              >
                Use theme
              </button>
            </div>
          </div>
        </div>

        {/* ---------------- Accent Colour ---------------- */}

        <div className="settings-row">
          <div>
            <h4>Accent color</h4>
            <p>Buttons, highlights and the typing caret.</p>
          </div>

          <div className="accent-controls">
            {ACCENT_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                className={`accent-dot${
                  prefs.accent.toLowerCase() === color.toLowerCase() ? ' active' : ''
                }`}
                style={{ background: color }}
                onClick={() => update({ accent: color })}
                aria-label={`Use accent color ${color}`}
                aria-pressed={prefs.accent.toLowerCase() === color.toLowerCase()}
              />
            ))}

            <input
              type="color"
              className="accent-picker"
              value={prefs.accent || (prefs.dark ? '#e08a46' : '#b5652c')}
              onChange={(event) => update({ accent: event.target.value })}
              aria-label="Pick a custom accent color"
            />

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => update({ accent: '' })}
              disabled={!prefs.accent}
            >
              Reset
            </button>
          </div>
        </div>

        {/* ---------------- Font Selection ---------------- */}

        <div className="settings-row">
          <div>
            <h4>Font</h4>
            <p>Typeface used across the app.</p>
          </div>

          <select
            className="select-mini"
            value={prefs.font}
            onChange={(event) =>
              update({
                font: event.target.value,
              })
            }
            aria-label="Select font"
          >
            {FONTS.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </select>
        </div>

        {/* ---------------- Text Size ---------------- */}

        <div className="settings-row">
          <div>
            <h4>Text size</h4>
            <p>Adjust the size of the typing text.</p>
          </div>

          <select
            className="select-mini"
            value={prefs.fontsize}
            onChange={(event) =>
              update({
                fontsize: Number(event.target.value),
              })
            }
            aria-label="Select text size"
          >
            <option value={19}>Small</option>
            <option value={23}>Medium</option>
            <option value={28}>Large</option>
          </select>
        </div>

        {/* ---------------- UI Density ---------------- */}

        <div className="settings-row">
          <div>
            <h4>UI density</h4>
            <p>More breathing room, or a tighter layout.</p>
          </div>

          <select
            className="select-mini"
            value={prefs.uiDensity}
            onChange={(event) =>
              update({
                uiDensity: event.target.value,
              })
            }
            aria-label="Select UI density"
          >
            <option value="comfortable">
              Comfortable
            </option>

            <option value="compact">
              Compact
            </option>
          </select>
        </div>

        {/* ---------------- Dark Mode ---------------- */}

        <div className="settings-row">
          <div>
            <h4>Dark mode</h4>
            <p>Switch between the light and dark palette.</p>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={Boolean(prefs.dark)}
              onChange={(event) =>
                update({
                  dark: event.target.checked,
                })
              }
              aria-label="Enable dark mode"
            />

            <span className="track" />
          </label>
        </div>
      </div>

      {/* ======================================================
          TYPING EXPERIENCE
      ====================================================== */}

      <div className="settings-section-title">
        Typing Experience
      </div>

      <div className="card settings-card">
        {/* ---------------- Typing Effect ---------------- */}

        <div className="settings-row">
          <div>
            <h4>Typing effect</h4>
            <p>Visual feedback style as you type.</p>
          </div>

          <select
            className="select-mini"
            value={prefs.typingEffect}
            onChange={(event) =>
              update({
                typingEffect: event.target.value,
              })
            }
            aria-label="Select typing effect"
          >
            {TYPING_EFFECTS.map((effect) => (
              <option key={effect.id} value={effect.id}>
                {effect.label}
              </option>
            ))}
          </select>
        </div>

        {/* ---------------- Caret Style ---------------- */}

        <div className="settings-row">
          <div>
            <h4>Caret style</h4>
            <p>How the cursor appears in the text.</p>
          </div>

          <select
            className="select-mini"
            value={prefs.caret}
            onChange={(event) =>
              update({
                caret: event.target.value,
              })
            }
            aria-label="Select caret style"
          >
            <option value="line">Line</option>
            <option value="block">Block</option>
          </select>
        </div>

        {/* ---------------- Error Effect ---------------- */}

        <div className="settings-row">
          <div>
            <h4>Error effect</h4>
            <p>Feedback shown on an incorrect keystroke.</p>
          </div>

          <select
            className="select-mini"
            value={prefs.errorEffect}
            onChange={(event) =>
              update({
                errorEffect: event.target.value,
              })
            }
            aria-label="Select error effect"
          >
            {ERROR_EFFECTS.map((effect) => (
              <option key={effect.id} value={effect.id}>
                {effect.label}
              </option>
            ))}
          </select>
        </div>

        {/* ---------------- Correct Character Effect ---------------- */}

        <div className="settings-row">
          <div>
            <h4>Correct character effect</h4>
            <p>Feedback shown on a correct keystroke.</p>
          </div>

          <select
            className="select-mini"
            value={prefs.correctEffect}
            onChange={(event) =>
              update({
                correctEffect: event.target.value,
              })
            }
            aria-label="Select correct character effect"
          >
            {CORRECT_EFFECTS.map((effect) => (
              <option key={effect.id} value={effect.id}>
                {effect.label}
              </option>
            ))}
          </select>
        </div>

        {/* ---------------- Word Completion Effect ---------------- */}

        <div className="settings-row">
          <div>
            <h4>Word completion effect</h4>
            <p>Feedback shown when you finish a word.</p>
          </div>

          <select
            className="select-mini"
            value={prefs.wordCompleteEffect}
            onChange={(event) =>
              update({
                wordCompleteEffect: event.target.value,
              })
            }
            aria-label="Select word completion effect"
          >
            {WORD_COMPLETE_EFFECTS.map((effect) => (
              <option key={effect.id} value={effect.id}>
                {effect.label}
              </option>
            ))}
          </select>
        </div>

        {/* ---------------- Stop on Error ---------------- */}

        <div className="settings-row">
          <div>
            <h4>Stop on error</h4>
            <p>
              Block further typing until a mistake is corrected.
            </p>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={Boolean(prefs.stopOnError)}
              onChange={(event) =>
                update({
                  stopOnError: event.target.checked,
                })
              }
              aria-label="Stop typing on error"
            />

            <span className="track" />
          </label>
        </div>

        {/* ---------------- Sound on Keypress ---------------- */}

        <div className="settings-row">
          <div>
            <h4>Sound on keypress</h4>
            <p>Play a soft click for every keystroke.</p>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={Boolean(prefs.sound)}
              onChange={(event) =>
                update({
                  sound: event.target.checked,
                })
              }
              aria-label="Enable keypress sound"
            />

            <span className="track" />
          </label>
        </div>

        {/* ---------------- Keyboard Sounds ---------------- */}

        <div className="settings-row">
          <div>
            <h4>Keyboard sounds</h4>
            <p>
              Mechanical-keyboard style audio while typing.
            </p>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={Boolean(prefs.keyboardSounds)}
              onChange={(event) =>
                update({
                  keyboardSounds: event.target.checked,
                })
              }
              aria-label="Enable mechanical keyboard sounds"
            />

            <span className="track" />
          </label>
        </div>
      </div>

      {/* ======================================================
          ACCOUNT
      ====================================================== */}

      <div className="settings-section-title">
        Account
      </div>

      <div className="card settings-card">
        {user ? (
          <>
            {/* ---------------- Profile ---------------- */}

            <div className="settings-row">
              <div>
                <h4>Profile</h4>
                <p>{user.username || 'User'}</p>
              </div>
            </div>

            {/* ---------------- Email ---------------- */}

            <div className="settings-row">
              <div>
                <h4>Email</h4>
                <p>{user.email || 'No email available'}</p>
              </div>
            </div>

            {/* ---------------- Login methods ---------------- */}

            <div className="settings-row" style={{ display: 'block' }}>
              <h4>Login methods</h4>
              <p style={{ marginBottom: 6 }}>
                Ways you can sign in to this KeyNova account.
              </p>
              <LoginMethods />
            </div>

            {/* ---------------- Logout ---------------- */}

            <div className="settings-row">
              <div>
                <h4>Log out</h4>
                <p>End your session on this device.</p>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onLogout}
              >
                Log out
              </button>
            </div>
          </>
        ) : (
          <div className="settings-row">
            <div>
              <h4>You're not logged in</h4>
              <p>
                Log in to sync settings and stats across devices.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/login')}
            >
              Log in
            </button>
          </div>
        )}
      </div>

      {/* ======================================================
          DATA
      ====================================================== */}

      <div className="settings-section-title">
        Data
      </div>

      <div className="card settings-card">
        <div className="settings-row">
          <div>
            <h4>Reset local data</h4>
            <p>
              Clears cached preferences on this device only.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onResetLocalData}
          >
            Reset
          </button>
        </div>
      </div>
    </>
  );
}