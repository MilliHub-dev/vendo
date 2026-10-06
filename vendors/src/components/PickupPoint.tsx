"use client";

import { CircleCheck, LocateFixed, MapPin, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";

import { Button } from "./ui";

/**
 * Where riders collect orders. Vendors shouldn't have to know coordinates, so they either search
 * for their street or a landmark, or stand in the shop and use the device's location.
 */
export function PickupPoint({ cityId, latitude, longitude, onChange, onPick, intro, error }: { cityId: string; latitude: string; longitude: string; onChange: (lat: string, lng: string) => void; /** called with the place's name when one is chosen from search */ onPick?: (label: string) => void; intro?: string; error?: string | null }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);
  const results = useQuery({ queryKey: ["places", cityId, debounced], queryFn: () => api.searchPlaces(cityId, debounced), enabled: !!cityId && debounced.length >= 3 && debounced !== chosen, staleTime: 300_000 });
  const set = latitude !== "" && longitude !== "";

  const useDevice = () => {
    if (!("geolocation" in navigator)) return setLocateError("This browser can’t share its location. Search for your street instead.");
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setChosen("your current location");
        onChange(p.coords.latitude.toFixed(6), p.coords.longitude.toFixed(6));
      },
      () => {
        setLocating(false);
        setLocateError("We couldn’t get your location. Allow location access for this site, or search for your street instead.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <div className="field pickup">
      <span className="label">Pickup point</span>
      <p className="small muted">{intro ?? "Where riders come to collect orders. Search for your street or a landmark to move it, or use your location if you’re at the store."}</p>

      <label className="search pickup__search">
        <Search />
        <input className="input" type="search" placeholder={cityId ? "Search your street or a nearby landmark" : "Choose your city first"} disabled={!cityId} aria-label="Search for the pickup point" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {results.isFetching ? <p className="small muted">Searching…</p> : null}
      {results.isError ? <p className="small text-danger">Search isn’t available right now. If you’re at the store, use your location instead.</p> : null}
      {results.data && debounced !== chosen ? (
        results.data.length === 0 ? (
          <p className="small muted">Nothing found. Try a main road or a well-known landmark nearby.</p>
        ) : (
          <div className="pickup__results" role="listbox" aria-label="Places">
            {results.data.map((p) => (
              <button key={`${p.lat},${p.lng},${p.label}`} type="button" role="option" aria-selected={false} onClick={() => (setChosen(p.label), setQuery(p.label), setDebounced(p.label), onChange(String(p.lat), String(p.lng)), onPick?.(p.label))}>
                <MapPin size={16} /> <span>{p.label}</span>
              </button>
            ))}
          </div>
        )
      ) : null}

      <div>
        <Button variant="secondary" size="sm" loading={locating} onClick={useDevice}>
          <LocateFixed /> I’m at the store: use my location
        </Button>
      </div>
      {locateError ? <p className="small text-danger">{locateError}</p> : null}

      {set ? (
        <p className="pickup__set">
          <CircleCheck size={18} /> Pickup point set{chosen ? ` to ${chosen}` : ""}. <a href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noreferrer">Check it on a map</a>
        </p>
      ) : null}
      {error ? <span className="field__error">{error}</span> : null}
    </div>
  );
}
