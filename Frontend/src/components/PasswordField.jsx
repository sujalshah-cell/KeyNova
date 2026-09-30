import { useId, useState } from 'react';

export default function PasswordField({ label, name, value, onChange, placeholder, minLength, autoComplete }) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <label htmlFor={id}>
      {label}
      <div className="password-field">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          name={name}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          tabIndex={0}
        >
          {visible ? '🙈' : '👁'}
        </button>
      </div>
    </label>
  );
}
