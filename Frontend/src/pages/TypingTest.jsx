import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

import * as statsService from '../services/statsService';
import { buildTextFor } from '../utils/content';
import { getPrefs } from '../utils/prefs';
import { playKeySound } from '../utils/sound';

/* =========================================================
   MODE CONFIGURATION
   ========================================================= */

const MODE_TABS = [
  { type: 'time', label: 'time' },
  { type: 'words', label: 'words' },
  { type: 'quote', label: 'quote' },
  { type: 'zen', label: 'zen' },
  { type: 'custom', label: 'custom' },
  { type: 'code', label: 'code' },
];

const TIME_OPTIONS = [10, 25, 50, 100, 200];
const WORD_OPTIONS = [10, 25, 50, 100, 200];

/* =========================================================
   HELPERS
   ========================================================= */

function labelForMode(mode) {
  return mode.type;
}

function toCharArray(str) {
  return String(str || '')
    .split('')
    .map((ch) => ({
      ch,
      status: 'pending',
    }));
}

/* =========================================================
   CAPITALIZE SENTENCES
   ========================================================= */

function capitalizeFirstLetter(text) {
  if (!text) return text;

  const chars = text.split('');

  for (let i = 0; i < chars.length; i += 1) {
    if (/[A-Za-z]/.test(chars[i])) {
      chars[i] = chars[i].toUpperCase();
      break;
    }
  }

  return chars.join('');
}

function capitalizeSentences(text) {
  if (!text) return text;

  const chars = text.split('');

  let capitalizeNext = true;

  for (let i = 0; i < chars.length; i += 1) {
    const current = chars[i];

    if (capitalizeNext) {
      if (/[A-Za-z]/.test(current)) {
        chars[i] = current.toUpperCase();
        capitalizeNext = false;
      }

      continue;
    }

    if (
      current === '.' ||
      current === '!' ||
      current === '?'
    ) {
      capitalizeNext = true;
    }
  }

  return chars.join('');
}

/* =========================================================
   ADD PUNCTUATION
   ========================================================= */

function addPunctuation(text) {
  if (!text) return text;

  const punctuation = [
    ',',
    '.',
    '!',
    '?',
    ':',
    ';',
  ];

  const words = text.split(' ');

  if (words.length < 3) {
    return capitalizeSentences(
      capitalizeFirstLetter(text)
    );
  }

  for (
    let i = 3;
    i < words.length;
    i += 6
  ) {
    const word = words[i];

    if (!word) continue;

    if (/[,.!?;:]$/.test(word)) {
      continue;
    }

    const mark =
      punctuation[
        Math.floor(
          (i / 6) % punctuation.length
        )
      ];

    words[i] = `${word}${mark}`;
  }

  let result = words.join(' ');

  result = capitalizeSentences(result);

  return capitalizeFirstLetter(result);
}

/* =========================================================
   ADD NUMBERS
   ========================================================= */

function addNumbers(text) {
  if (!text) return text;

  const words = text.split(' ');

  if (words.length < 4) {
    return text;
  }

  const result = [];

  for (
    let i = 0;
    i < words.length;
    i += 1
  ) {
    const word = words[i];

    result.push(word);

    if (
      i > 0 &&
      i % 6 === 0 &&
      i < words.length - 1
    ) {
      const number =
        10 +
        ((i * 67) % 990);

      result.push(String(number));
    }
  }

  return result.join(' ');
}

/* =========================================================
   BUILD TYPING TEXT
   ========================================================= */

function buildTypingText(
  type,
  value,
  customText,
  punctuation,
  numbers
) {
  let text = buildTextFor(
    type,
    value,
    customText
  );

  if (!text) {
    return '';
  }

  if (
    type === 'time' ||
    type === 'words'
  ) {
    if (punctuation) {
      text = addPunctuation(text);
    }

    if (numbers) {
      text = addNumbers(text);
    }

    /*
     * Always make the first alphabetic character
     * uppercase.
     */
    text = capitalizeFirstLetter(text);

    /*
     * Capitalize the first letter after:
     * . ! ?
     */
    text = capitalizeSentences(text);
  }

  return text;
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function TypingTest() {
  const location = useLocation();

  const {
    user,
    refreshUser,
  } = useAuth();

  const {
    showToast,
  } = useToast();

  const prefs = getPrefs();

  /* =======================================================
     INITIAL MODE
     ======================================================= */

  const initialMode =
    location.state?.mode
      ? {
          type:
            location.state.mode,
          value:
            location.state.value ??
            (location.state.mode ===
            'time'
              ? 30
              : 50),
        }
      : {
          type: 'time',
          value: 30,
        };

  const [
    mode,
    setMode,
  ] = useState(initialMode);

  /* =======================================================
     PUNCTUATION / NUMBERS
     ======================================================= */

  const [
    punctuation,
    setPunctuation,
  ] = useState(false);

  const [
    numbers,
    setNumbers,
  ] = useState(false);

  /* =======================================================
     CUSTOM TEXT
     ======================================================= */

  const [
    customText,
    setCustomText,
  ] = useState('');

  /* =======================================================
     TYPING CHARACTERS
     ======================================================= */

  const [
    chars,
    setChars,
  ] = useState(() =>
    toCharArray(
      buildTypingText(
        initialMode.type,
        initialMode.value,
        '',
        false,
        false
      )
    )
  );

  const [
    pos,
    setPos,
  ] = useState(0);

  const [
    started,
    setStarted,
  ] = useState(false);

  const [
    finished,
    setFinished,
  ] = useState(false);

  const [
    remaining,
    setRemaining,
  ] = useState(
    initialMode.type ===
      'time'
      ? Number(
          initialMode.value
        )
      : 0
  );

  const [
    elapsedDisplay,
    setElapsedDisplay,
  ] = useState(0);

  const [
    live,
    setLive,
  ] = useState({
    wpm: 0,
    acc: 100,
    errors: 0,
  });

  const [
    result,
    setResult,
  ] = useState(null);

  /* =======================================================
     REFS
     ======================================================= */

  const correctRef =
    useRef(0);

  const incorrectRef =
    useRef(0);

  const totalRef =
    useRef(0);

  const samplesRef =
    useRef([]);

  const startTsRef =
    useRef(0);

  const timerRef =
    useRef(null);

  const stageRef =
    useRef(null);

  /* =======================================================
     SECONDARY OPTIONS
     ======================================================= */

  const secondaryOptions =
    mode.type === 'time'
      ? TIME_OPTIONS
      : mode.type === 'words'
        ? WORD_OPTIONS
        : [];

  /* =======================================================
     RESET TEST
     ======================================================= */

  const resetTest =
    useCallback(
      (
        nextMode = mode,
        text = customText,
        nextPunctuation =
          punctuation,
        nextNumbers =
          numbers
      ) => {
        clearInterval(
          timerRef.current
        );

        const builtText =
          buildTypingText(
            nextMode.type,
            nextMode.value,
            text,
            nextPunctuation,
            nextNumbers
          );

        setChars(
          toCharArray(
            builtText
          )
        );

        setPos(0);

        setStarted(false);

        setFinished(false);

        setResult(null);

        correctRef.current = 0;

        incorrectRef.current = 0;

        totalRef.current = 0;

        samplesRef.current = [];

        setRemaining(
          nextMode.type ===
            'time'
            ? Number(
                nextMode.value
              )
            : 0
        );

        setElapsedDisplay(0);

        setLive({
          wpm: 0,
          acc: 100,
          errors: 0,
        });

        requestAnimationFrame(
          () => {
            stageRef.current?.focus();
          }
        );
      },
      [
        mode,
        customText,
        punctuation,
        numbers,
      ]
    );

  /* =======================================================
     RESET WHEN MODE CHANGES
     ======================================================= */

  useEffect(() => {
    resetTest(
      mode,
      customText,
      punctuation,
      numbers
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /* =======================================================
     RESET WHEN OPTIONS CHANGE
     ======================================================= */

  useEffect(() => {
    if (
      mode.type !== 'time' &&
      mode.type !== 'words'
    ) {
      return;
    }

    if (!started) {
      resetTest(
        mode,
        customText,
        punctuation,
        numbers
      );
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    punctuation,
    numbers,
  ]);

  /* =======================================================
     FINISH TEST
     ======================================================= */

  const finishTest =
    useCallback(() => {
      if (finished) {
        return;
      }

      setFinished(true);

      clearInterval(
        timerRef.current
      );

      const elapsedSec =
        Math.max(
          (Date.now() -
            startTsRef.current) /
            1000,
          1
        );

      const minutes =
        elapsedSec / 60;

      const grossWpm =
        Math.round(
          (totalRef.current / 5) /
            minutes
        );

      const acc =
        totalRef.current
          ? Math.round(
              (correctRef.current /
                totalRef.current) *
                100
            )
          : 100;

      const wpm =
        Math.max(
          0,
          Math.round(
            grossWpm *
              (acc / 100)
          )
        );

      /* ===================================================
         CONSISTENCY
      =================================================== */

      let consistency = 100;

      const samples =
        samplesRef.current;

      if (
        samples.length > 1
      ) {
        const mean =
          samples.reduce(
            (a, b) => a + b,
            0
          ) / samples.length;

        const variance =
          samples.reduce(
            (a, b) =>
              a +
              (b - mean) ** 2,
            0
          ) / samples.length;

        consistency =
          mean > 0
            ? Math.max(
                0,
                Math.round(
                  100 -
                    (Math.sqrt(
                      variance
                    ) /
                      mean) *
                      100
                )
              )
            : 100;
      }

      const finalResult = {
        mode:
          labelForMode(mode),
        wpm,
        accuracy: acc,
        chars:
          totalRef.current,
        consistency,
        // Backend (POST /stats/result) requires duration in seconds; without
        // it every save failed with 400 and stats never reached the account.
        duration:
          Math.max(
            1,
            Math.round(
              elapsedSec
            )
          ),
      };

      setResult(
        finalResult
      );

      /* ===================================================
         SAVE RESULT
      =================================================== */

      if (user) {
        statsService
          .submitResult(
            finalResult
          )
          .then((data) => {
            if (
              data?.stats ||
              data?.streak
            ) {
              refreshUser({
                stats:
                  data.stats,
                streak:
                  data.streak,
              });
            }
          })
          .catch(() => {
            showToast(
              "Saved locally — couldn't sync this result to your account."
            );
          });
      }
    }, [
      finished,
      mode,
      user,
      refreshUser,
      showToast,
    ]);

  /* =======================================================
     TIMER
     ======================================================= */

  const startTimerLoop =
    useCallback(() => {
      startTsRef.current =
        Date.now();

      timerRef.current =
        setInterval(() => {
          const elapsedSec =
            (Date.now() -
              startTsRef.current) /
            1000;

          /* TIME MODE */

          if (
            mode.type ===
            'time'
          ) {
            const left =
              Math.max(
                0,
                Math.round(
                  Number(
                    mode.value
                  ) -
                    elapsedSec
                )
              );

            setRemaining(
              left
            );

            if (left <= 0) {
              finishTest();
              return;
            }
          }

          /* OTHER MODES */

          else {
            setElapsedDisplay(
              Math.round(
                elapsedSec
              )
            );
          }

          /* =================================================
             LIVE WPM
          ================================================= */

          const minutes =
            Math.max(
              elapsedSec / 60,
              1 / 60
            );

          const grossWpm =
            Math.round(
              (totalRef.current / 5) /
                minutes
            );

          const acc =
            totalRef.current
              ? Math.round(
                  (correctRef.current /
                    totalRef.current) *
                    100
                )
              : 100;

          const netWpm =
            Math.max(
              0,
              Math.round(
                grossWpm *
                  (acc / 100)
              )
            );

          samplesRef.current.push(
            netWpm
          );

          setLive({
            wpm: netWpm,
            acc,
            errors:
              incorrectRef.current,
          });
        }, 250);
    }, [
      mode,
      finishTest,
    ]);

  /* =======================================================
     KEYBOARD INPUT
     ======================================================= */

  const handleKeyDown =
    useCallback(
      (e) => {
        if (finished) {
          return;
        }

        /* ESC */

        if (
          e.key ===
          'Escape'
        ) {
          e.preventDefault();

          resetTest();

          return;
        }

        /* MODIFIER KEYS */

        if (
          e.ctrlKey ||
          e.metaKey ||
          e.altKey
        ) {
          return;
        }

        /* BACKSPACE */

        if (
          e.key ===
          'Backspace'
        ) {
          e.preventDefault();

          setPos(
            (currentPos) => {
              if (
                currentPos ===
                0
              ) {
                return currentPos;
              }

              setChars(
                (prev) => {
                  const next =
                    [...prev];

                  next[
                    currentPos - 1
                  ] = {
                    ...next[
                      currentPos - 1
                    ],
                    status:
                      'pending',
                  };

                  return next;
                }
              );

              return (
                currentPos - 1
              );
            }
          );

          return;
        }

        /*
         * Ignore non-printable keys.
         */

        if (
          e.key.length !==
          1
        ) {
          return;
        }

        e.preventDefault();

        playKeySound();

        /*
         * First keystroke starts timer.
         */

        if (!started) {
          setStarted(true);

          startTimerLoop();
        }

        setChars(
          (prev) => {
            const list =
              prev;

            const index =
              pos;

            const expected =
              list[index]?.ch;

            const isCorrect =
              e.key ===
              expected;

            /*
             * Stop on error.
             */

            if (
              !isCorrect &&
              prefs.stopOnError
            ) {
              totalRef.current +=
                1;

              incorrectRef.current +=
                1;

              const newAccuracy =
                totalRef.current
                  ? Math.round(
                      (correctRef.current /
                        totalRef.current) *
                        100
                    )
                  : 100;

              setLive(
                (previous) => ({
                  ...previous,
                  acc:
                    newAccuracy,
                  errors:
                    incorrectRef.current,
                })
              );

              return list;
            }

            const next =
              [...list];

            next[index] = {
              ...next[index],
              status:
                isCorrect
                  ? 'correct'
                  : 'incorrect',
            };

            totalRef.current +=
              1;

            if (
              isCorrect
            ) {
              correctRef.current +=
                1;
            } else {
              incorrectRef.current +=
                1;
            }

            let newPos =
              index + 1;

            /*
             * End of text.
             */

            if (
              newPos >=
              next.length
            ) {
              /*
               * TIME / ZEN:
               * Generate more text.
               */

              if (
                mode.type ===
                  'zen' ||
                mode.type ===
                  'time'
              ) {
                const moreText =
                  buildTypingText(
                    mode.type ===
                      'time'
                      ? 'time'
                      : 'zen',
                    60,
                    '',
                    punctuation,
                    numbers
                  );

                const more =
                  toCharArray(
                    moreText
                  );

                next.push(
                  ...more
                );
              }

              /*
               * WORDS / QUOTE / CODE:
               * Finish.
               */

              else {
                setTimeout(
                  finishTest,
                  0
                );
              }
            }

            setPos(
              newPos
            );

            return next;
          }
        );
      },
      [
        finished,
        resetTest,
        started,
        startTimerLoop,
        pos,
        prefs.stopOnError,
        mode,
        punctuation,
        numbers,
        finishTest,
      ]
    );

  /* =======================================================
     TIMER CLEANUP
     ======================================================= */

  useEffect(() => {
    return () => {
      clearInterval(
        timerRef.current
      );
    };
  }, []);

  /* =======================================================
     APPLY MODE
     ======================================================= */

  const applyMode =
    (type) => {
      let value = 30;

      if (
        type === 'time'
      ) {
        value = 30;
      }

      if (
        type === 'words'
      ) {
        value = 50;
      }

      setMode({
        type,
        value,
      });

      if (
        type !== 'time' &&
        type !== 'words'
      ) {
        setPunctuation(false);
        setNumbers(false);
      }
    };

  /* =======================================================
     APPLY TIME / WORD OPTION
     ======================================================= */

  const applyOption =
    (value) => {
      setMode(
        (previous) => ({
          ...previous,
          value,
        })
      );
    };

  /* =======================================================
     NEW PARAGRAPH
     ======================================================= */

  const newParagraph =
    () => {
      resetTest(
        mode,
        customText,
        punctuation,
        numbers
      );
    };

  /* =======================================================
     RENDER TYPING WORDS
     ======================================================= */

  const renderTypingText =
    () => {
      const words = [[]];

      chars.forEach(
        (
          character,
          index
        ) => {
          words[
            words.length - 1
          ].push({
            ...character,
            i: index,
          });

          if (
            character.ch ===
            ' '
          ) {
            words.push([]);
          }
        }
      );

      return words.map(
        (
          word,
          wordIndex
        ) => (
          <span
            className="word"
            key={wordIndex}
            style={{
              display:
                'inline',
            }}
          >
            {word.map(
              (
                character
              ) => (
                <span
                  key={
                    character.i
                  }
                  className={
                    'ch' +
                    (character.ch ===
                    ' '
                      ? ' space'
                      : '') +
                    (character.status !==
                    'pending'
                      ? ` ${character.status}`
                      : '') +
                    (character.i ===
                    pos
                      ? ' current'
                      : '')
                  }
                >
                  {
                    character.ch
                  }
                </span>
              )
            )}
          </span>
        )
      );
    };

  /* =======================================================
     FULL SCREEN TYPING UI
     ======================================================= */

  return (
    <div
      style={{
        width: '100%',
        minHeight:
          'calc(100vh - 20px)',
        display: 'flex',
        flexDirection:
          'column',
        boxSizing:
          'border-box',
        padding:
          '28px 34px 22px',
      }}
    >
      {/* ===================================================
          TOP MODE CONTROLS
      =================================================== */}

      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent:
            'center',
          marginBottom: 30,
        }}
      >
        <div
          className="mode-bar"
          style={{
            display:
              'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            gap: 8,
            flexWrap:
              'wrap',
            width:
              'min(100%, 1080px)',
            padding:
              '10px 14px',
            borderRadius: 14,
          }}
        >
          {/* PUNCTUATION */}

          <button
            type="button"
            className={
              'chip-btn' +
              (punctuation
                ? ' active'
                : '')
            }
            onClick={() =>
              setPunctuation(
                (value) =>
                  !value
              )
            }
          >
            @ punctuation
          </button>

          {/* NUMBERS */}

          <button
            type="button"
            className={
              'chip-btn' +
              (numbers
                ? ' active'
                : '')
            }
            onClick={() =>
              setNumbers(
                (value) =>
                  !value
              )
            }
          >
            # numbers
          </button>

          {/* SEPARATOR */}

          <span
            style={{
              width: 1,
              height: 28,
              background:
                'var(--border)',
              margin:
                '0 6px',
            }}
          />

          {/* MODES */}

          {MODE_TABS.map(
            (item) => (
              <button
                key={
                  item.type
                }
                type="button"
                className={
                  'chip-btn' +
                  (mode.type ===
                  item.type
                    ? ' active'
                    : '')
                }
                onClick={() =>
                  applyMode(
                    item.type
                  )
                }
              >
                {item.label}
              </button>
            )
          )}

          {/* SECONDARY OPTIONS */}

          {(mode.type ===
            'time' ||
            mode.type ===
              'words') && (
            <>
              <span
                style={{
                  width: 1,
                  height: 28,
                  background:
                    'var(--border)',
                  margin:
                    '0 6px',
                }}
              />

              {secondaryOptions.map(
                (value) => (
                  <button
                    key={
                      value
                    }
                    type="button"
                    className={
                      'chip-btn' +
                      (Number(
                        mode.value
                      ) ===
                      value
                        ? ' active'
                        : '')
                    }
                    onClick={() =>
                      applyOption(
                        value
                      )
                    }
                  >
                    {value}
                  </button>
                )
              )}
            </>
          )}
        </div>
      </div>

      {/* ===================================================
          MAIN COMFORTABLE TYPING SCREEN
      =================================================== */}

      <div
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          flexDirection:
            'column',
          justifyContent:
            'center',
          alignItems:
            'center',
          position:
            'relative',
          minHeight: 500,
        }}
      >
        {/* =================================================
            LANGUAGE
        ================================================= */}

        <div
          style={{
            position:
              'absolute',
            top: 20,
            left: '50%',
            transform:
              'translateX(-50%)',
            display:
              'flex',
            alignItems:
              'center',
            gap: 8,
            opacity: 0.55,
            fontSize: 14,
            letterSpacing:
              '0.04em',
          }}
        >
          <span
            style={{
              fontSize: 16,
            }}
          >
            ◉
          </span>

          <span>
            english
          </span>
        </div>

        {/* =================================================
            LIVE STATS
        ================================================= */}

        <div
          className="live-stats"
          style={{
            width:
              'min(100%, 1200px)',
            display:
              'flex',
            justifyContent:
              'flex-start',
            alignItems:
              'center',
            gap: 42,
            marginBottom:
              40,
            paddingLeft: 8,
          }}
        >
          {/* TIME */}

          <div
            className="ls"
            style={{
              display:
                'flex',
              flexDirection:
                'column',
            }}
          >
            <span className="v">
              {mode.type ===
              'time'
                ? remaining
                : elapsedDisplay}
            </span>

            <span className="l">
              TIME
            </span>
          </div>

          {/* WPM */}

          <div
            className="ls"
            style={{
              display:
                'flex',
              flexDirection:
                'column',
            }}
          >
            <span className="v">
              {live.wpm}
            </span>

            <span className="l">
              WPM
            </span>
          </div>

          {/* ACCURACY */}

          <div
            className="ls"
            style={{
              display:
                'flex',
              flexDirection:
                'column',
            }}
          >
            <span className="v">
              {live.acc}%
            </span>

            <span className="l">
              ACCURACY
            </span>
          </div>

          {/* ERRORS */}

          <div
            className="ls"
            style={{
              display:
                'flex',
              flexDirection:
                'column',
            }}
          >
            <span className="v">
              {live.errors}
            </span>

            <span className="l">
              ERRORS
            </span>
          </div>
        </div>

        {/* =================================================
            CUSTOM MODE
        ================================================= */}

        {mode.type ===
          'custom' && (
          <div
            style={{
              width:
                'min(100%, 1200px)',
              marginBottom:
                25,
            }}
          >
            <textarea
              value={
                customText
              }
              onChange={(e) =>
                setCustomText(
                  e.target.value
                )
              }
              placeholder="Paste or type the text you want to practice on…"
              style={{
                width:
                  '100%',
                minHeight:
                  120,
                resize:
                  'vertical',
                boxSizing:
                  'border-box',
              }}
            />

            <button
              className="btn btn-secondary btn-sm"
              style={{
                marginTop: 10,
              }}
              onClick={() =>
                resetTest(
                  mode,
                  customText,
                  punctuation,
                  numbers
                )
              }
            >
              Use this text
            </button>
          </div>
        )}

        {/* =================================================
            TYPING AREA
        ================================================= */}

        {!finished ? (
          <div
            style={{
              width:
                'min(100%, 1400px)',
              display:
                'flex',
              flexDirection:
                'column',
              alignItems:
                'center',
            }}
          >
            <div
              className="text-display"
              ref={stageRef}
              tabIndex={0}
              data-caret={
                prefs.caret
              }
              data-typing-effect={
                prefs.typingEffect
              }
              data-error-effect={
                prefs.errorEffect
              }
              data-correct-effect={
                prefs.correctEffect
              }
              data-word-effect={
                prefs.wordCompleteEffect
              }
              style={{
                width: '100%',
                maxWidth:
                  1380,
                minHeight:
                  190,
                outline:
                  'none',
                cursor:
                  'text',
                fontSize:
                  prefs.fontsize ||
                  28,
                lineHeight:
                  1.75,
                letterSpacing:
                  '0.02em',
                textAlign:
                  'left',
                padding:
                  '10px 8px',
                boxSizing:
                  'border-box',
                overflow:
                  'hidden',
              }}
              onKeyDown={
                handleKeyDown
              }
              onClick={() =>
                stageRef.current?.focus()
              }
            >
              {renderTypingText()}
            </div>

            {/* =================================================
                HINT
            ================================================= */}

            <div
              style={{
                marginTop:
                  28,
                opacity: 0.55,
                fontSize: 14,
                textAlign:
                  'center',
              }}
            >
              Click the text and
              start typing.
            </div>

            {/* =================================================
                RESTART
            ================================================= */}

            <button
              className="btn btn-ghost btn-sm"
              onClick={() =>
                resetTest()
              }
              style={{
                marginTop:
                  20,
                fontSize: 20,
                padding:
                  '4px 12px',
                opacity: 0.75,
              }}
              title="Restart test"
            >
              ↻
            </button>

            {/* FINISH */}

            {(mode.type ===
              'zen' ||
              mode.type ===
                'time') &&
              started && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={
                    finishTest
                  }
                  style={{
                    marginTop:
                      10,
                  }}
                >
                  Finish Test
                </button>
              )}

            {/* NEW PARAGRAPH */}

            {(mode.type ===
              'words' ||
              mode.type ===
                'time') && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={
                  newParagraph
                }
                style={{
                  marginTop:
                    10,
                }}
              >
                New Paragraph
              </button>
            )}
          </div>
        ) : (
          /* =================================================
             RESULTS
          ================================================= */

          <div
            className="results-panel"
            style={{
              width:
                'min(100%, 900px)',
              textAlign:
                'center',
            }}
          >
            <h3>
              Test complete
            </h3>

            <div className="results-grid">
              <div className="stat-card">
                <div className="num">
                  {
                    result?.wpm
                  }
                </div>

                <div className="label">
                  WPM
                </div>
              </div>

              <div className="stat-card">
                <div className="num">
                  {
                    result
                      ?.accuracy
                  }
                  %
                </div>

                <div className="label">
                  Accuracy
                </div>
              </div>

              <div className="stat-card">
                <div className="num">
                  {
                    result?.chars
                  }
                </div>

                <div className="label">
                  Characters
                </div>
              </div>

              <div className="stat-card">
                <div className="num">
                  {
                    result
                      ?.consistency
                  }
                  %
                </div>

                <div className="label">
                  Consistency
                </div>
              </div>
            </div>

            <div
              className="results-actions"
              style={{
                display:
                  'flex',
                justifyContent:
                  'center',
                gap: 10,
                marginTop:
                  30,
              }}
            >
              <button
                className="btn btn-primary"
                onClick={() =>
                  resetTest()
                }
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================
          BOTTOM SHORTCUT BAR
      =================================================== */}

      {!finished && (
        <div
          style={{
            width: '100%',
            display:
              'flex',
            justifyContent:
              'center',
            alignItems:
              'center',
            gap: 18,
            marginTop:
              25,
            opacity: 0.5,
            fontSize: 13,
            flexWrap:
              'wrap',
          }}
        >
          <span>
            Tab + Enter — restart
          </span>

          <span>
            Esc — restart
          </span>

          <span>
            Ctrl + Enter — finish
          </span>
        </div>
      )}
    </div>
  );
}