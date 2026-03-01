import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { EU_COUNTRIES } from '@/lib/countries';

type EUCountry = { code: string; name: string };

export default function CountrySelector({
  selectedCountry: initialCountry,
  onSelect,
  searchPlaceholder,
  placeholder,
  noResultsText,
}: {
  selectedCountry?: string;
  onSelect?: (country: string) => void;
  searchPlaceholder?: string;
  placeholder?: string;
  noResultsText?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<EUCountry | null>(() => {
    if (!initialCountry) return null;
    return EU_COUNTRIES.find(c => c.code === initialCountry) || null;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredCountries = EU_COUNTRIES.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (country: EUCountry) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearchTerm('');
    if (onSelect) onSelect(country.code);
  };

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm pl-4 pr-10 py-3 text-left cursor-default focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 dark:text-slate-100 hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-200"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select country"
      >
        <span className="flex items-center">
          {selectedCountry ? (
            <>
              <Image
                src={`https://flagcdn.com/w20/${selectedCountry.code.toLowerCase()}.png`}
                alt={`Flag of ${selectedCountry.name}`}
                width={24}
                height={16}
                className="w-6 h-4 mr-3"
              />
              <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{selectedCountry.name}</span>
            </>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">{placeholder || 'Select your country'}</span>
          )}
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {isOpen ? <ChevronUp className="h-5 w-5 text-slate-500 dark:text-slate-300" /> : <ChevronDown className="h-5 w-5 text-slate-500 dark:text-slate-300" />}
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-900 shadow-xl rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="p-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80">
            <input
              type="text"
              placeholder={searchPlaceholder || "Search 27 EU countries..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              autoFocus
            />
          </div>
          <ul className="max-h-60 overflow-auto focus:outline-none" role="listbox">
            {filteredCountries.length > 0 ? (
              filteredCountries.map((country) => (
                <li
                  key={country.code}
                  onClick={() => handleSelect(country)}
                  className="flex items-center px-4 py-3 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-800 dark:text-slate-100 transition-colors duration-150 border-b border-gray-50 dark:border-slate-800 last:border-b-0"
                  role="option"
                  aria-selected={selectedCountry?.code === country.code}
                >
                  <Image
                    src={`https://flagcdn.com/w20/${country.code.toLowerCase()}.png`}
                    alt=""
                    width={24}
                    height={16}
                    className="w-6 h-4 mr-3"
                    aria-hidden="true"
                  />
                  <span className="font-medium">{country.name}</span>
                </li>
              ))
            ) : (
              <li className="px-4 py-3 text-slate-500 dark:text-slate-400 text-center">
                {noResultsText || 'No countries found'}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
