import { useState, useEffect } from 'react';

export default function AgeSelector({
  age: initialAge = 30,
  onChange
}: {
  age?: number;
  onChange?: (age: number) => void;
}) {
  const [age, setAge] = useState(initialAge);

  useEffect(() => {
    setAge(initialAge);
  }, [initialAge]);

  const handleChange = (newAge: number) => {
    setAge(newAge);
    if (onChange) onChange(newAge);
  };

  const pct = ((age - 18) / 82) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xl font-bold text-slate-800">{age}</span>
        <span className="text-xs text-slate-500"></span>
      </div>
      <input
        type="range"
        min="18"
        max="100"
        value={age}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #003399 0%, #003399 ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`
        }}
      />
      <div className="flex justify-between text-xs text-slate-600 mt-1">
        <span>18</span>
        <span>30</span>
        <span>50</span>
        <span>70</span>
        <span>100</span>
      </div>
    </div>
  );
}
