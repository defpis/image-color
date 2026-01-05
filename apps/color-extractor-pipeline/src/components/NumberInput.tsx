import { useState, useEffect } from "react";

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  suffix?: string;
  className?: string;
}

export function NumberInput({
  value,
  onChange,
  min = 0,
  suffix,
  className = "",
}: NumberInputProps) {
  const [text, setText] = useState(String(value));

  // Sync external value changes
  useEffect(() => {
    setText(String(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  };

  const handleBlur = () => {
    const num = parseFloat(text);
    if (isNaN(num)) {
      setText(String(value));
      return;
    }
    const clamped = Math.max(min, num);
    onChange(clamped);
    setText(String(clamped));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`px-2 py-1 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 ${className}`}
      />
      {suffix && <span className="text-gray-500 text-sm">{suffix}</span>}
    </div>
  );
}

