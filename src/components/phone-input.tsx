"use client";
import { useEffect, useMemo, useState } from "react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui";

let cachedCountries: { code: CountryCode; label: string; dial: string }[] | null = null;
function countries() {
  if (cachedCountries) return cachedCountries;
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  cachedCountries = getCountries()
    .map((code) => ({ code, label: names.of(code) ?? code, dial: getCountryCallingCode(code) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return cachedCountries;
}

/** Best-effort default from the browser locale; never a hard-coded country. */
export function guessCountry(): CountryCode {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    if (region && getCountries().includes(region as CountryCode)) return region as CountryCode;
  } catch { /* ignore */ }
  return "US";
}

interface Props {
  value: string; // E.164 when valid, otherwise whatever the user typed (server rejects it)
  onChange: (value: string) => void;
  defaultCountry?: CountryCode;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export function PhoneInput({ value, onChange, defaultCountry, ...aria }: Props) {
  const initial = useMemo(() => {
    const parsed = value ? parsePhoneNumberFromString(value) : undefined;
    return parsed?.country
      ? { country: parsed.country, national: parsed.formatNational() }
      : { country: defaultCountry ?? "US", national: value.replace(/^\+\d+\s?/, "") };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [country, setCountry] = useState<CountryCode>(initial.country);
  const [national, setNational] = useState(initial.national);
  // Country names come from Intl.DisplayNames, whose ICU data differs between Node and browsers; render the full list
  // only after hydration so server and client markup match.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); if (!value && !defaultCountry) setCountry(guessCountry()); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const list = mounted ? countries() : [{ code: country, label: country, dial: getCountryCallingCode(country) }];

  function emit(c: CountryCode, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return onChange("");
    const parsed = parsePhoneNumberFromString(trimmed, c);
    onChange(parsed ? parsed.number : `+${getCountryCallingCode(c)}${trimmed.replace(/\D/g, "")}`);
  }
  function onNational(text: string) {
    // Pasting an international number (+44 …) switches the country automatically.
    if (text.trim().startsWith("+")) {
      const p = parsePhoneNumberFromString(text.trim());
      if (p?.country) { setCountry(p.country); setNational(p.formatNational()); return onChange(p.number); }
    }
    setNational(text); emit(country, text);
  }
  const invalid = !!value && !parsePhoneNumberFromString(value)?.isValid();

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative h-9 w-[5.75rem] shrink-0 rounded-lg focus-within:outline-2 focus-within:outline-brand-500">
          {/* The native select stays on top (transparent) so the OS picker and full country names still work; the visible label stays compact. */}
          <div aria-hidden className="pointer-events-none flex h-full items-center justify-between rounded-lg bg-white px-3 text-base shadow-card sm:text-sm"><span className="tabular">{country} +{getCountryCallingCode(country)}</span><ChevronDown className="size-3.5 text-ink-400" /></div>
          <select aria-label="Country calling code" value={country} className="absolute inset-0 size-full cursor-pointer opacity-0" onChange={(e) => { const c = e.target.value as CountryCode; setCountry(c); emit(c, national); }}>
            {list.map((c) => <option key={c.code} value={c.code}>{c.label} (+{c.dial})</option>)}
          </select>
        </div>
        <Input type="tel" inputMode="tel" autoComplete="tel-national" value={national} placeholder="Phone number" onChange={(e) => onNational(e.target.value)} {...aria} aria-invalid={aria["aria-invalid"] || (national.trim() !== "" && invalid) || undefined} />
      </div>
      {national.trim() !== "" && invalid && <p className="mt-1 text-xs text-red-600" role="alert">Not a valid number for {list.find((c) => c.code === country)?.label}.</p>}
    </div>
  );
}
