import { h, RefObject } from 'preact';
import { useRef } from 'preact/hooks';
import { signal } from '@preact/signals';
import { createPortal } from 'preact/compat';
import { fetchSuggestions, resolvePlaceLocation } from '../maps/autocomplete';
import { suggestions, selectedPlace } from '../state/map';
import type { PlacePredictionResult, SelectedPlace } from '../maps/types';

interface Props {
  onPlaceSelected: (place: SelectedPlace) => void;
}

const inputValue = signal('');
const showDropdown = signal(false);

function SuggestionsDropdown({
  anchorRef,
  onSelect,
}: {
  anchorRef: RefObject<HTMLInputElement>;
  onSelect: (s: PlacePredictionResult) => void;
}) {
  const items = suggestions.value;
  if (!items.length || !showDropdown.value) return null;

  const rect = anchorRef.current?.getBoundingClientRect();
  if (!rect) return null;

  const dropdownStyle: h.JSX.CSSProperties = {
    position: 'fixed',
    top: `${rect.bottom}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    zIndex: 999999,
    background: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  };

  return createPortal(
    <ul style={dropdownStyle}>
      {items.map((s) => (
        <SuggestionItem key={s.placeId} suggestion={s} onSelect={onSelect} />
      ))}
    </ul>,
    document.body,
  );
}

function SuggestionItem({
  suggestion,
  onSelect,
}: {
  suggestion: PlacePredictionResult;
  onSelect: (s: PlacePredictionResult) => void;
}) {
  const hovered = signal(false);

  const itemStyle: h.JSX.CSSProperties = {
    padding: '10px 14px',
    cursor: 'pointer',
    background: hovered.value ? '#f3f4f6' : '#fff',
    fontSize: '14px',
    color: '#1f2937',
  };

  return (
    <li
      style={itemStyle}
      onMouseEnter={() => { hovered.value = true; }}
      onMouseLeave={() => { hovered.value = false; }}
      // Use onMouseDown + preventDefault to prevent blur-before-click (RESEARCH.md Pitfall 5)
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect(suggestion);
      }}
    >
      {suggestion.text}
    </li>
  );
}

export function AddressAutocomplete({ onPlaceSelected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    inputValue.value = value;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await fetchSuggestions(value);
        suggestions.value = results;
        if (results.length > 0) {
          showDropdown.value = true;
        }
      } catch (err) {
        console.error('[RoofingWidget] Address autocomplete error:', err);
      }
    }, 300);
  }

  function handleFocus() {
    if (suggestions.value.length > 0) {
      showDropdown.value = true;
    }
  }

  function handleBlur() {
    // Delay to allow onMouseDown on dropdown items to fire first
    setTimeout(() => {
      showDropdown.value = false;
    }, 150);
  }

  async function handleSelect(suggestion: PlacePredictionResult) {
    showDropdown.value = false;
    const place = await resolvePlaceLocation(suggestion);
    selectedPlace.value = place;
    inputValue.value = place.formattedAddress;
    suggestions.value = [];
    onPlaceSelected(place);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        class="rc-address-input"
        placeholder="Search for your address..."
        value={inputValue.value}
        onInput={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <SuggestionsDropdown anchorRef={inputRef} onSelect={handleSelect} />
    </div>
  );
}
