/*
  Author: Jacob Sullivan
  Date: 2025-05-04
  Descritpion: This React component visualizes duck migration patterns on an interactive map using Deck.gl. 
  It loads migration data and geographic boundaries, efficiently processes large datasets using a web worker, 
  and displays animated heatmaps and paths indicating duck movements within the Mississippi Flyway. Users 
  can select specific days, search locations, and view average migration trajectories, with responsive 
  adjustments optimized for both mobile and desktop displays.
*/
import React, { useState, useEffect, useMemo } from "react";
import { useRef } from "react";
import { DeckGL } from "@deck.gl/react";
import { TileLayer, TripsLayer } from "@deck.gl/geo-layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import {
  ScatterplotLayer,
  BitmapLayer,
  GeoJsonLayer,
  TextLayer,
} from "@deck.gl/layers";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import {
  Slider,
  Typography,
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from "@mui/material";

// Utility functions for interpolation and formatting
const interp = (aLat, aLon, bLat, bLon, f) => [
  aLat + (bLat - aLat) * f,
  aLon + (bLon - aLon) * f
];

const fmt = d =>
  d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit"
  });

function formatDay(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

// Custom hook to detect if the device is mobile
const MOBILE_BREAKPOINT = 600; // px
function useIsMobile(brk = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== "undefined" && window.innerWidth <= brk
  );
  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= brk);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [brk]);
  return isMobile;
}

// Initial map view state
const INITIAL = {
  latitude: 41.9779,
  longitude: -91.6656,
  zoom: 4,
  minZoom: 4,
  maxZoom: 4.5,
  pitch: 0,
  bearing: 0
};

const MIN_MOVE_DIST = 0.03; // Minimum movement distance to consider

export default function DuckMapFunction() {
  // Responsive detection
  const isMobile = useIsMobile();
  // Memoized initial view state based on device
  const initialView = useMemo(
    () => ({
      ...INITIAL,
      minZoom: isMobile ? 2 : INITIAL.minZoom,
      maxZoom: isMobile ? 6 : INITIAL.maxZoom
    }),
    [isMobile]
  );

  // State variables for data and UI
  const [rows, setRows] = useState([]);
  const [hours, setHours] = useState([]);
  const [idx, setIdx] = useState(0);
  const [play, setPlay] = useState(false);
  const [pick /* , setPick */] = useState(null);
  const [view, setView] = useState(INITIAL);
  const [fly, setFly] = useState(null);
  const [city, setCity] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const workerRef = useRef();

  // Load Arrow data in a Web Worker
  useEffect(() => {
    setIsLoading(true);
    workerRef.current = new Worker(new URL('../workers/dataWorker.js', import.meta.url));
    fetch(`${process.env.PUBLIC_URL}/Week_prediction.arrow`)
      .then(r => r.arrayBuffer())
      .then(arrayBuffer => {
        workerRef.current.onmessage = (e) => {
          const { hours, binnedRows, error, debug } = e.data;
          if (debug) console.log(debug);
          if (error) setError(error);
          setHours(hours);
          setRows(Object.values(binnedRows).flat());
          setIdx(0);
          setIsLoading(false);
        };
        workerRef.current.postMessage({ arrayBuffer });
      })
      .catch(err => {
        setError(`Failed to load data: ${err.message}`);
        setIsLoading(false);
      });
    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  // Load flyway GeoJSON data
  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL}/Mississippi_Flyway_FeatureCollection.geojson`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(data => {
        console.log("Loaded flyway GeoJSON:", data);
        setFly(data);
      })
      .catch(console.error);
  }, []);

  // Memoized function to check if a point is inside the flyway
  const insideFlyway = useMemo(() => {
    if (!fly || !fly.features) return () => false;
    const feats = Array.isArray(fly.features) ? fly.features : [];
    return ([lon, lat]) => {
      const pt = { type: "Point", coordinates: [lon, lat] };
      return feats.some(feat => {
        try {
          return booleanPointInPolygon(pt, feat);
        } catch (e) {
          return false;
        }
      });
    };
  }, [fly]);

  // Group rows by duck ID
  const byDuck = useMemo(() => {
    const m = {};
    rows.forEach(r => (m[r.duck] ??= []).push(r));
    Object.values(m).forEach(a => a.sort((a, b) => a.startTime - b.startTime));
    return m;
  }, [rows]);

  // Get unique days from hours
  const uniqueDays = useMemo(() => {
    const s = new Set();
    hours.forEach(t => {
      const d = new Date(t);
      s.add(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());
    });
    return [...s].sort((a, b) => a - b);
  }, [hours]);

  // Filter hours by selected day
  const filteredHours = useMemo(() => {
    if (!selectedDay) return hours;
    return hours.filter(t => {
      const d = new Date(t);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === selectedDay;
    });
  }, [hours, selectedDay]);

  // Get indices for 6-hour intervals
  const filtered6HourIdxs = useMemo(() => {
    return filteredHours
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => new Date(t).getHours() % 6 === 0)
      .map(({ i }) => i);
  }, [filteredHours]);

  // Current time object for the selected index
  const now = useMemo(
    () => (filteredHours.length ? new Date(filteredHours[Math.min(idx, filteredHours.length - 1)]) : null),
    [filteredHours, idx]
  );

  // Animation effect for play/pause
  useEffect(() => {
    let timer;
    if (play && filtered6HourIdxs.length) {
      timer = setTimeout(() => {
        setIdx(prevIdx => {
          const current6Idx = filtered6HourIdxs.findIndex(i => i === prevIdx);
          const next6Idx = (current6Idx + 1) % filtered6HourIdxs.length;
          return filtered6HourIdxs[next6Idx];
        });
      }, 200);
    }
    return () => timer && clearTimeout(timer);
  }, [play, filtered6HourIdxs, idx]);

  // Reset index if filtered hours change
  useEffect(() => {
    if (
      filteredHours.length > 0 && 
      idx >= filteredHours.length && 
      idx !== 0
    ) {
      setIdx(0);
    }
  }, [filteredHours, idx]);

  // Keep idx in sync with filtered6HourIdxs
  useEffect(() => {
    if (!filtered6HourIdxs.length) {
      setIdx(0);
    } else if (!filtered6HourIdxs.includes(idx)) {
      setIdx(filtered6HourIdxs[0]);
    }
  }, [filtered6HourIdxs, idx]);

  // Calculate average migration vector for all ducks
  const avgVector = useMemo(() => {
    let dx = 0, dy = 0, n = 0;
    Object.values(byDuck).forEach(arr => {
      const row = arr.find(r =>
        r.startTime <= (now?.getTime() ?? 0) &&
        (now?.getTime() ?? 0) <= r.forecastTime
      );
      if (row) {
        const dLon = row.forecastLon - row.startLon;
        const dLat = row.forecastLat - row.startLat;
        dx += dLon;
        dy += dLat;
        n++;
      }
    });
    if (n === 0) return null;
    const avgDx = dx / n;
    const avgDy = dy / n;
    const magnitude = Math.sqrt(avgDx * avgDx + avgDy * avgDy);
    return { dx: avgDx, dy: avgDy, magnitude };
  }, [byDuck, now]);

  // Calculate departure and destination positions for all ducks
  const { departPos, destPos } = useMemo(() => {
    if (!now) return { departPos: [], destPos: [] };
    const dep = [], dst = [];
    for (const d in byDuck) {
      const arr = byDuck[d];
      let row = arr.find(r => r.startTime <= now && now <= r.forecastTime) ||
                (now < arr[0].startTime ? arr[0] : arr[arr.length - 1]);
      const span = row.forecastTime - row.startTime;
      const frac = span > 0 ? Math.min(1, Math.max(0, (now - row.startTime) / span)) : 0;
      const [cLat, cLon] = interp(row.startLat, row.startLon, row.forecastLat, row.forecastLon, frac);
      // Calculate movement distance (simple Euclidean, for small distances)
      const dist = Math.sqrt(
        Math.pow(row.forecastLat - row.startLat, 2) +
        Math.pow(row.forecastLon - row.startLon, 2)
      );
      if (dist >= MIN_MOVE_DIST) { // Use constant here
        dep.push({ duck: d, lat: row.startLat, lon: row.startLon, curLat: cLat, curLon: cLon, sel: d === pick });
        dst.push({ duck: d, lat: row.forecastLat, lon: row.forecastLon, curLat: cLat, curLon: cLon, sel: d === pick });
      }
    }
    return { departPos: dep, destPos: dst };
  }, [now, byDuck, pick]);

  // Current positions of ducks
  const curPos = useMemo(() =>
    departPos
      .map(p => ({ duck: p.duck, lat: p.curLat, lon: p.curLon, sel: p.sel })),
    [departPos]
  );
  
  // Path data for each duck for the TripsLayer
  const pathData = useMemo(() =>
    Object.entries(byDuck).map(([d, arr]) => {
      if (arr.length < 2) return null;
      const pts = arr.map(r => ({
        pos: [r.forecastLon, r.forecastLat],
        t: r.forecastTime 
      })).sort((a, b) => a.t - b.t);
      return { duck: d, path: pts.map(p => p.pos), ts: pts.map(p => p.t), sel: d === pick };
    }).filter(Boolean),
  [byDuck, pick]);

  // Static map layers (base map, flyway fill/outline)
  const staticLayers = useMemo(() => {
    const carto = new TileLayer({
      id: "carto",
      data: "https://cartodb-basemaps-a.global.ssl.fastly.net/rastertiles/voyager/{z}/{x}/{y}.png",
      tileSize: 256,
      loadOptions: { fetch: { crossOrigin: "anonymous" } },
      renderSubLayers: props => new BitmapLayer(props, {
        data: null,
        image: props.data,
        bounds: [props.tile.bbox.west, props.tile.bbox.south, props.tile.bbox.east, props.tile.bbox.north],
        parameters: { depthTestDisable: true }
      })
    });

    const flyFill = fly && new GeoJsonLayer({
      id: "fly-fill",
      data: fly,
      filled: true,
      stroked: false,
      getFillColor: [0, 100, 33, 70],
      parameters: { depthTestDisable: true }
    });

    const flyOutline = fly && new GeoJsonLayer({
      id: "fly-outline",
      data: fly,
      filled: false,
      stroked: true,
      lineWidthMinPixels: 0,
      getLineColor: [0, 130, 33, 0],
      parameters: { depthTestDisable: true }
    });

    return [carto, flyFill, flyOutline].filter(Boolean);
  }, [fly]);

  // Calculate heatmap data for current and forecast positions
  const { /* currentHeat, */ forecastHeat } = useMemo(() => {
    const current = [];
    const forecast = [];
    curPos.forEach(p => {
      if (insideFlyway([p.lon, p.lat])) {
        current.push({ position: [p.lon, p.lat], weight: 2.5 });
      }
    });
    destPos.forEach(d => {
      if (insideFlyway([d.lon, d.lat])) {
        forecast.push({ position: [d.lon, d.lat], weight: 2.5 });
      }
    });
    return { currentHeat: current, forecastHeat: forecast };
  }, [curPos, destPos, insideFlyway]);

  // Find ducks that are not moving (stagnant)
  const stagnantDucks = useMemo(() => {
    const stagnant = [];
    Object.values(byDuck).forEach(arr => {
      arr.forEach(r => {
        if (
          r.startLat === r.forecastLat &&
          r.startLon === r.forecastLon &&
          insideFlyway([r.startLon, r.startLat])
        ) {
          stagnant.push({ position: [r.startLon, r.startLat], weight: 1 });
        }
      });
    });
    return stagnant;
  }, [byDuck, insideFlyway]);

  // Dynamic map layers (heatmap, paths, labels, stagnant ducks)
  const dynamicLayers = useMemo(() => {
    // Blue gradient for movement heatmap
    const DESKTOP_BLUE = [    
      [0, 0, 255, 0],
      [0, 0, 255, 120],
      [0, 0, 255, 255]
    ];

    const MOBILE_BLUE_SOFT = [
      [0, 0, 255,   0],
      [0, 0, 255,  40],
      [0, 0, 255,  80],
      [0, 0, 255, 120],
      [0, 0, 255, 170],
      [0, 0, 255, 220],
      [0, 0, 255, 255]
    ];

    const colorRange = isMobile ? MOBILE_BLUE_SOFT : DESKTOP_BLUE;
    const heatRadius = isMobile ? 220 : 270;

    // Single movement heatmap
    const movementHeatmap = new HeatmapLayer({
      id: "movement-heatmap",
      data: forecastHeat,
      getPosition: d => d.position,
      getWeight: d => d.weight,
      radiusPixels: heatRadius,
      intensity: isMobile ? 0.9 : 0.9,
      threshold: 0.001,
      colorRange,
      parameters: { depthTestDisable: true },
      pickable: false,
      updateTriggers: { radiusPixels: heatRadius, forecastHeat }
    });

    // Movement paths
    const trips = new TripsLayer({
      id: "paths",
      data: pathData,
      getPath: d => d.path,
      getTimestamps: d => d.ts,
      getColor: d => d.sel ? [255, 165, 0, 180] : [80, 80, 255, 120],
      widthMinPixels: d => d.sel ? 3 : 2,
      trailLength: 0.15,
      currentTime: now?.getTime() ?? 0,
      parameters: { depthTestDisable: true }
    });

    // Optional label for selected duck
    const label = pick && new TextLayer({
      id: "label",
      data: curPos.filter(d => d.duck === pick),
      getPosition: d => [d.lon, d.lat],
      getText: d => `Duck ID: ${d.duck}`,
      getSize: 12,
      getPixelOffset: [0, -20],
      background: true,
      getBackgroundColor: [0, 0, 0, 200],
      parameters: { depthTestDisable: true }
    });

    const stagnantLayer = new ScatterplotLayer({
      id: "stagnant-ducks",
      data: stagnantDucks,
      getPosition: d => d.position,
      getRadius: 5, // smaller
      getFillColor: [128, 0, 128, 120], // more transparent
      stroked: false, // no white outline
      pickable: false
    });

    return [
      movementHeatmap,
      stagnantLayer,
      trips,
      ...(label ? [label] : [])
    ];
  }, [pathData, now, curPos, pick, stagnantDucks, forecastHeat, isMobile]);

  // Combine static and dynamic layers for DeckGL
  const layers = useMemo(
    () => [...staticLayers, ...dynamicLayers],
    [staticLayers, dynamicLayers]
  );

  // Show error message if data fails to load
  if (error) {
    return (
      <Box p={3} textAlign="center">
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  // Main render: map, overlays, controls, and status
  return (
    <div
      className="duckmap-container"
      style={{
        position: "relative",
        width: "100%",
        height: isMobile ? "70vh" : "600px"
      }}
    >
      {/* DeckGL map rendering */}
      <DeckGL
        layers={layers}
        controller={{
          minZoom: isMobile ? 3.5 : INITIAL.minZoom,
          maxZoom: isMobile ? 4.3 : INITIAL.maxZoom
        }}
        initialViewState={initialView}
        viewState={view}
        onViewStateChange={({ viewState }) => setView(viewState)}
        style={{ width: "100%", height: "100%" }}
        getCursor={({ isDragging }) => (isDragging ? "grabbing" : "default")}
        useDevicePixels={window.devicePixelRatio}
      />

      {/* Location Search Overlay */}
      <div className="duckmap-search duckmap-overlay"
        style={{
          position: "absolute", top: 10, left: 10, width: "250px",
          background: "rgba(255,255,255,0.9)", padding: 8,
          borderRadius: 6, boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
        }}>
        <Box display="flex" gap={1}>
          <TextField
            size="small"
            label="City"
            value={city}
            onChange={e => setCity(e.target.value)}
            sx={{ flex: 1 }}
          />
          <Button size="small" variant="contained" onClick={() => {
            const q = city.trim();
            if (!q) return;
            fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json`)
              .then(r => r.json())
              .then(d => {
                if (d.length) setView(v => ({
                  ...v,
                  latitude: +d[0].lat,
                  longitude: +d[0].lon,
                  zoom: 4.5
                }));
              });
          }}>Go</Button>
        </Box>
      </div>

      {/* Controls Overlay (bottom card) */}
      <div className="duckmap-controls duckmap-overlay"
        style={{
          position: "absolute", bottom: 10, left: 10, width: 280,
          background: "rgba(255,255,255,0.9)", padding: 12,
          borderRadius: 6, boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
        }}>
        <Typography variant="subtitle2">{now ? fmt(now) : "Loading…"}</Typography>
        {pick && <Typography variant="body2" color="primary">Tracking Duck: {pick}</Typography>}

        {/* Day selector */}
        <FormControl size="small" fullWidth sx={{ my: 1 }}>
          <InputLabel>Day</InputLabel>
          <Select
            label="Day"
            value={selectedDay || ""}
            onChange={e => {
              const val = e.target.value;
              if (val === "ALL_DAYS") {
                setSelectedDay(null);
                setIdx(0);
                setPlay(false);
              } else {
                setSelectedDay(Number(val));
                setIdx(0);
                setPlay(false);
              }
            }}
          >
            <MenuItem value="ALL_DAYS"><em>All Days</em></MenuItem>
            {uniqueDays.map(d => (
              <MenuItem key={d} value={d}>{formatDay(d)}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Play/Pause and loading indicator */}
        <Box display="flex" gap={1} mb={1}>
          <Button
            variant="contained"
            size="small"
            color={play ? "secondary" : "primary"}
            disabled={isLoading || !filteredHours.length}
            onClick={() => setPlay(p => !p)}
          >
            {play ? "Pause" : "Play"}
          </Button>
          {isLoading && <Typography variant="body2">Loading…</Typography>}
        </Box>

        {/* Time slider */}
        <Slider
          size="small"
          min={0}
          max={Math.max(0, filtered6HourIdxs.length - 1)}
          value={filtered6HourIdxs.findIndex(i => i === idx)}
          onChange={(_, v) => {
            setIdx(filtered6HourIdxs[v]);
            setPlay(false);
          }}
          disabled={isLoading || !filtered6HourIdxs.length}
          valueLabelDisplay="auto"
          valueLabelFormat={i =>
            i < 0 || i >= filtered6HourIdxs.length
              ? ""
              : fmt(new Date(filteredHours[filtered6HourIdxs[i]]))
          }
        />

        {/* Heatmap legend */}
        <Box display="flex" alignItems="center" gap={1} mt={1}>
          <span
            style={{
              display: "inline-block",
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #00f 60%, #fff 100%)",
              marginRight: 6,
              border: "1px solid #00f"
            }}
          />
          <span style={{ fontSize: 12, color: "#0033cc", fontWeight: 500 }}>
            Blue = forecasted duck migrations
          </span>
        </Box>

        {/* Duck count */}
        <Typography variant="caption" color="textSecondary">
          Tracking {Object.keys(byDuck).length} ducks in the Mississippi Flyway
        </Typography>
      </div> 

      {/* Avg. Trajectory Overlay */}
      {avgVector && (
        <div
          className="trajectory-legend" 
          style={{
            position: "absolute",
            right: 24,
            bottom: 24,
            background: "rgba(255,255,255,0.92)",
            borderRadius: 8,
            boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
            padding: "14px 22px", // Increased padding
            zIndex: 30,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minWidth: 80 // Increased minWidth
          }}
        >
          <span style={{ fontSize: 15, color: "#555", marginBottom: 6 }}>Avg. Trajectory</span>
          {/* Draw arrow for average migration direction */}
          {(() => {
            // Arrow length and color scale
            const minLen = 28, maxLen = 54; // Increased size
            const minMag = 0, maxMag = 0.5;
            const mag = Math.min(avgVector.magnitude, maxMag);
            const arrowLen = minLen + (maxLen - minLen) * (mag - minMag) / (maxMag - minMag);

            // Tan: rgb(255, 165, 64), Brown: rgb(120, 70, 15)
            const lerp = (a, b, t) => Math.round(a + (b - a) * t);
            const t = (mag - minMag) / (maxMag - minMag);
            const r = lerp(255, 120, t);
            const g = lerp(165, 70, t);
            const b = lerp(64, 15, t);
            const arrowColor = `rgb(${r},${g},${b})`;

            // Arrow points, scaled by arrowLen
            const scale = arrowLen / 36;
            const points = [
              [18 * scale, 6 * scale],
              [30 * scale, 30 * scale],
              [18 * scale, 24 * scale],
              [6 * scale, 30 * scale]
            ].map(p => p.join(",")).join(" ");

            return (
              <svg width={arrowLen} height={arrowLen} style={{ display: "block", transform: `rotate(${Math.atan2(avgVector.dy, avgVector.dx) * 180 / Math.PI}deg)` }}>
                <polygon points={points} fill={arrowColor} />
              </svg>
            );
          })()}
        </div>
      )}

      {/* Status Overlay (migration status and message) */}
      {now && (() => {
        const month = now.getMonth() + 1;
        const day = now.getDate();

        let status = "";
        let message = "";

        // Determine migration status and message based on date
        if ((month === 1) || (month === 2)) {
          status = "❄️ Off (Wintering)";
          message = "Stationary in southern wetlands (Gulf Coast, Arkansas, Mississippi).";
        } else if (month === 3) {
          status = "🌱 On (Early spring migration starts)";
          message = "Small early northward movements; ducks prepping to leave winter grounds.";
        } else if (month === 4 && day <= 15) {
          status = "🚀 On (Peak spring migration)";
          message = "Big movements toward mid-latitudes and Canada.";
        } else if ((month === 4 && day >= 16) || (month === 5)) {
          status = "✈️ On (Finishing Spring Migration)";
          message = "Ducks finishing movement into breeding grounds in northern U.S. and Canada.";
        } else if ((month === 6) || (month === 7 && day <= 14)) {
          status = "🐣 Off (Breeding/Nesting)";
          message = "Stationary — ducks are nesting and raising ducklings.";
        } else if (month === 7 && day >= 15) {
          status = "🐣 Off (Still no migration)";
          message = "Stationary — ducks molting (losing feathers, flightless).";
        } else if (month === 8) {
          status = "🪶 Off (Molting/Preparing)";
          message = "Still not migrating; ducks regrowing feathers, prepping for fall migration.";
        } else if (month === 9) {
          status = "🍂 On (Fall Migration begins slowly)";
          message = "First early southward movements, especially adult males.";
        } else if (month === 10 && day <= 4) {
          status = "🍂 On (Fall Migration begins slowly)";
          message = "First early southward movements, especially adult males.";
        } else if (month === 10 && day >= 5 && day <= 20) {
          status = "🍁 On (Peak Fall Migration)";
          message = "Big movement south down Mississippi River corridor.";
        } else if ((month === 10 && day >= 21) || (month === 11)) {
          status = "❄️ On (Late Fall Migration)";
          message = "Remaining ducks move south, seeking open water, wetlands.";
        } else if (month === 12) {
          status = "❄️ Off (Wintering)";
          message = "Stationary again in southern wintering areas.";
        }

        return (
          <div className="duckmap-status"
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: status.includes("On") ? "rgba(0,180,0,0.92)" : "rgba(180,120,0,0.92)",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: 8,
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              fontSize: 14,
              maxWidth: 300,
              zIndex: 20
            }}>
            <b>{status}</b>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              {message}
            </div>
          </div>
        );
      })()}
    </div>
  );
}