import React, { useEffect, useRef, useState } from 'react';

const CopyButton: React.FC<{ text: string; label: string }> = ({ text, label }) => {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    []
  );

  const copy = async () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setStatus('copying');
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      setStatus('error');
    }
    resetTimer.current = setTimeout(() => setStatus('idle'), 2200);
  };

  return (
    <button
      className="command-copy-button"
      type="button"
      onClick={copy}
      disabled={status === 'copying'}
      aria-label={label}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {status === 'copied' ? (
          <path d="m5 12 4 4L19 6" />
        ) : (
          <>
            <rect x="8" y="8" width="12" height="12" rx="2" />
            <path d="M16 8V4H4v12h4" />
          </>
        )}
      </svg>
      <span aria-live="polite">
        {status === 'copied'
          ? 'Copied!'
          : status === 'error'
            ? 'Try again'
            : status === 'copying'
              ? 'Copying…'
              : 'Copy'}
      </span>
    </button>
  );
};

export default CopyButton;
