import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const ORMOC_CENTER = [11.005, 124.607];

function photonPlace(feature) {
  const place = feature?.properties || {};
  const coordinates = feature?.geometry?.coordinates || [];
  const street = [place.housenumber, place.street].filter(Boolean).join(" ");
  const address = [...new Set([
    place.name,
    street,
    place.district,
    place.city,
    place.county,
    place.state,
    place.postcode,
    place.country,
  ].filter(Boolean))].join(", ");
  return {
    name: place.name || place.district || place.city || "Game venue",
    address: address || `${coordinates[1]?.toFixed?.(6)}, ${coordinates[0]?.toFixed?.(6)}`,
    coordinates,
  };
}

function MapView({ center }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, Math.max(map.getZoom(), 15), { duration: 0.7 });
  }, [center, map]);
  return null;
}

function ClickHandler({ setCandidate, setPoint, setBusy }) {
  useMapEvents({
    async click(event) {
      const point = [event.latlng.lat, event.latlng.lng];
      setPoint(point);
      setBusy(true);
      try {
        const url = new URL("https://photon.komoot.io/reverse");
        url.searchParams.set("lat", String(point[0]));
        url.searchParams.set("lon", String(point[1]));
        url.searchParams.set("lang", "en");
        const response = await fetch(url);
        if (!response.ok) throw new Error("Location lookup unavailable");
        const payload = await response.json();
        const place = payload.features?.[0]?.properties || {};
        const street = [place.housenumber, place.street].filter(Boolean).join(" ");
        const address = [...new Set([
          place.name,
          street,
          place.district,
          place.city,
          place.county,
          place.state,
          place.postcode,
          place.country,
        ].filter(Boolean))].join(", ");
        setCandidate({
          name: place.name || place.district || place.city || "Game venue",
          address: address || `${point[0].toFixed(6)}, ${point[1].toFixed(6)}`,
          coordinates: [point[1], point[0]],
        });
      } catch {
        setCandidate({
          name: "Game venue",
          address: `${point[0].toFixed(6)}, ${point[1].toFixed(6)}`,
          coordinates: [point[1], point[0]],
        });
      } finally {
        setBusy(false);
      }
    },
  });
  return null;
}

export default function LocationMapPicker({ coordinates, onPick, searchOnly = false }) {
  const latitude = coordinates?.length === 2 ? Number(coordinates[1]) : ORMOC_CENTER[0];
  const longitude = coordinates?.length === 2 ? Number(coordinates[0]) : ORMOC_CENTER[1];
  const center = useMemo(() => [latitude, longitude], [latitude, longitude]);
  const [point, setPoint] = useState(center);
  const [busy, setBusy] = useState(false);
  const [candidate, setCandidate] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setPoint(center);
    setCandidate(null);
  }, [center]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const url = new URL("https://photon.komoot.io/api/");
        url.searchParams.set("q", `${term}, Philippines`);
        url.searchParams.set("limit", "6");
        url.searchParams.set("lat", String(ORMOC_CENTER[0]));
        url.searchParams.set("lon", String(ORMOC_CENTER[1]));
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Location search unavailable");
        const payload = await response.json();
        setResults((payload.features || []).map(photonPlace).filter((place) => place.coordinates.length === 2));
      } catch (error) {
        if (error.name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const chooseSearchResult = (place) => {
    if (searchOnly) {
      setQuery(place.address);
      setResults([]);
      onPick(place);
      return;
    }
    setCandidate(place);
    setPoint([Number(place.coordinates[1]), Number(place.coordinates[0])]);
    setQuery(place.address);
    setResults([]);
  };

  return <div className={`tournament-interactive-map${searchOnly ? " is-search-only" : ""}`}>
    <div className="location-map-searchbox">
      <i className={`bi ${searching ? "bi-arrow-repeat location-search-spin" : "bi-search"}`}/>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search venue, barangay, or complete address" aria-label="Search map location"/>
      {query && <button type="button" aria-label="Clear location search" onClick={() => { setQuery(""); setResults([]); }}><i className="bi bi-x-lg"/></button>}
      {results.length > 0 && <div className="location-map-results">{results.map((place, index) => <button type="button" key={`${place.address}-${index}`} onClick={() => chooseSearchResult(place)}><i className="bi bi-geo-alt-fill"/><span><b>{place.name}</b><small>{place.address}</small></span></button>)}</div>}
    </div>
    {!searchOnly && <MapContainer center={center} zoom={13} scrollWheelZoom className="tournament-leaflet-map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapView center={point}/>
      <ClickHandler setCandidate={setCandidate} setPoint={setPoint} setBusy={setBusy}/>
      <CircleMarker center={point} radius={9} pathOptions={{ color: "#fff", weight: 3, fillColor: "#df341f", fillOpacity: 1 }}/>
    </MapContainer>}
    {!searchOnly && <div className="tournament-map-instruction">
      <i className={`bi ${busy ? "bi-arrow-repeat location-search-spin" : candidate ? "bi-geo-alt-fill" : "bi-cursor-fill"}`}/>
      <span><b>{busy ? "Finding this address…" : candidate ? candidate.name : "Tap the map to choose the venue"}</b><small>{candidate ? candidate.address : "Select the exact place where the games will be played."}</small></span>
      {candidate && !busy && <button type="button" onClick={() => onPick(candidate)}><i className="bi bi-check2-circle"/>Use this address</button>}
    </div>}
  </div>;
}
