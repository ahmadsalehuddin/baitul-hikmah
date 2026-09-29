import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Search, X } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";

const DEBOUNCE_MS = 250;

/**
 * Library search (spec §8.3.4): typing navigates to /cari?q=…, clearing returns home.
 * The input keeps its own text (URL updates are debounced) and only re-syncs from the
 * URL when the location changed for another reason (breadcrumb, logo, Back).
 */
export function SearchBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const onSearchPage = location.pathname === "/cari";
  const urlQuery = onSearchPage ? params.get("q") ?? "" : "";

  const [value, setValue] = useState(urlQuery);
  const timer = useRef(null);
  const lastPushed = useRef(urlQuery);

  useEffect(() => {
    if (urlQuery !== lastPushed.current) {
      lastPushed.current = urlQuery;
      setValue(urlQuery);
    }
  }, [urlQuery]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function go(text) {
    const q = text.trim();
    lastPushed.current = q;
    if (q) navigate(`/cari?q=${encodeURIComponent(q)}`, { replace: onSearchPage });
    else if (onSearchPage) navigate("/", { replace: true });
  }

  function handleChange(event) {
    const text = event.target.value;
    setValue(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => go(text), DEBOUNCE_MS);
  }

  function handleSubmit(event) {
    event.preventDefault();
    clearTimeout(timer.current);
    go(value);
  }

  function handleClear() {
    clearTimeout(timer.current);
    setValue("");
    go("");
  }

  return (
    <form role="search" onSubmit={handleSubmit}>
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="Taip tajuk ceramah, koleksi kitab atau penceramah untuk memulakan carian"
          aria-label="Cari ceramah"
          autoComplete="off"
        />
        {value && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" aria-label="Padam carian" onClick={handleClear}>
              <X />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </form>
  );
}
