// src/components/DuckMapFunction.js

import React, { useState, useEffect, useMemo } from "react";
import { useRef } from "react";
import { DeckGL } from "@deck.gl/react";
import { TileLayer, TripsLayer } from "@deck.gl/geo-layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import {
  ScatterplotLayer,
  BitmapLayer,
  GeoJsonLayer,
  TextLayer
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

/* ───────── helpers ───────── */
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

/* ───────── constants ───────── */
const INITIAL = {
  latitude: 36.28,
  longitude: -89.42,
  zoom: 3.5,
  minZoom: 3.5,
  maxZoom: 5,
  pitch: 0,
  bearing: 0
};

/* ───────── component ───────── */
export default function DuckMapFunction() {
  const [rows, setRows] = useState([]);
  const [hours, setHours] = useState([]);
  const [idx, setIdx] = useState(0);
  const [play, setPlay] = useState(false);
  const [pick, setPick] = useState(null);
  const [view, setView] = useState(INITIAL);
  const [fly, setFly] = useState(null);
  const [city, setCity] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const workerRef = useRef();


  /* ───────── CSV load ───────── */
  // ...existing code...
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
// ...existing code...

  /* ───────── load flyway GeoJSON ───────── */
  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL}/Mississippi_Flyway_FeatureCollection.geojson`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(data => {
        console.log("Loaded flyway GeoJSON:", data);
        setFly(data);
      })
      .catch(console.error);
  }, []);

  /* ─── point-in-polygon helper ───────── */
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


  /* ─── group rows by duck ID ───────── */
  const byDuck = useMemo(() => {
    const m = {};
    rows.forEach(r => (m[r.duck] ??= []).push(r));
    Object.values(m).forEach(a => a.sort((a, b) => a.startTime - b.startTime));
    return m;
  }, [rows]);

  /* ─── unique days dropdown ───────── */
  const uniqueDays = useMemo(() => {
    const s = new Set();
    hours.forEach(t => {
      const d = new Date(t);
      s.add(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());
    });
    return [...s].sort((a, b) => a - b);
  }, [hours]);

  /* ─── filter hours by selected day ───────── */
  const filteredHours = useMemo(() => {
    if (!selectedDay) return hours;
    return hours.filter(t => {
      const d = new Date(t);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === selectedDay;
    });
  }, [hours, selectedDay]);

  /* ─── current time based on slider/animation ───────── */
  const now = useMemo(
    () => (filteredHours.length ? new Date(filteredHours[Math.min(idx, filteredHours.length - 1)]) : null),
    [filteredHours, idx]
  );

  /* ─── autoplay loop ───────── */
  useEffect(() => {
    let timer;
    if (play && filteredHours.length) {
      timer = setTimeout(() => {
        setIdx(i => (i + 1) % filteredHours.length);
      }, 100); 
    }
    return () => timer && clearTimeout(timer);
  }, [play, filteredHours, idx]);

  /* ─── reset when day changes ───────── */
  useEffect(() => {
    if (
      filteredHours.length > 0 && 
      idx >= filteredHours.length && 
      idx !== 0
    ) {
      setIdx(0);
    }
  }, [filteredHours, idx]);

  /* ─── compute depart & dest positions ───────── */
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
      dep.push({ duck: d, lat: row.startLat, lon: row.startLon, curLat: cLat, curLon: cLon, sel: d === pick });
      dst.push({ duck: d, lat: row.forecastLat, lon: row.forecastLon, curLat: cLat, curLon: cLon, sel: d === pick });
    }
    return { departPos: dep, destPos: dst };
  }, [now, byDuck, pick]);

  /* ─── filter current positions inside polygon ───────── */
  const curPos = useMemo(() =>
    departPos
      .map(p => ({ duck: p.duck, lat: p.curLat, lon: p.curLon, sel: p.sel })),
      // .filter(p => insideFlyway([p.lon, p.lat])), // REMOVE THIS LINE TEMPORARILY
    [departPos]
  );
  
  /* ─── build paths ───────── */
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

  /* ─── layers ───────── */
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
    getFillColor: [0, 100, 33, 100],
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

const { currentHeat, forecastHeat } = useMemo(() => {
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

// Memoize dynamic layers (heatmap, trips, points, label)
const dynamicLayers = useMemo(() => {
  // Red for current, blue for forecast
  const RED_COLORS = [
    [255, 0, 0, 0],
    [255, 0, 0, 120],
    [255, 0, 0, 255]
  ];
  const BLUE_COLORS = [
    [0, 0, 255, 0],
    [0, 0, 255, 120],
    [0, 0, 255, 255]
  ];

  const currentHeatmap = new HeatmapLayer({
    id: "current-heatmap",
    data: currentHeat,
    getPosition: d => d.position,
    getWeight: d => d.weight,
    radiusPixels: 115,
    colorRange: RED_COLORS,
    intensity: 2,
    threshold: .08,
    parameters: { depthTestDisable: true }
  });

  const forecastHeatmap = new HeatmapLayer({
    id: "forecast-heatmap",
    data: forecastHeat,
    getPosition: d => d.position,
    getWeight: d => d.weight,
    radiusPixels: 100,
    colorRange: BLUE_COLORS,
    intensity: 1,
    threshold: 0.08,
    parameters: { depthTestDisable: true }
  });

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

  const points = new ScatterplotLayer({
    id: "points",
    data: curPos,
    getPosition: d => [d.lon, d.lat],
    getRadius: d => d.sel ? 3 : 1,
    radiusMinPixels: d => d.sel ? 3 : 1,
    radiusMaxPixels: d => d.sel ? 6 : 3,
    getFillColor: d => d.sel ? [255, 165, 0, 200] : [0, 0, 0, 150],
    stroked: true,
    getLineColor: d => d.sel ? [255, 255, 255, 255] : [255, 255, 255, 0],
    lineWidthMinPixels: 1,
    pickable: true,
    onClick: info => info.object && setPick(info.object.duck),
    parameters: { depthTestDisable: true }
  });

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

  return [
    currentHeatmap,
    forecastHeatmap,
    trips,
    points,
    ...(label ? [label] : [])
  ];
}, [currentHeat, forecastHeat, pathData, curPos, pick, now]);

// Combine static and dynamic layers for DeckGL
const layers = useMemo(() => [
  ...staticLayers,
  ...dynamicLayers
], [staticLayers, dynamicLayers]);

  if (error) {
    return (
      <Box p={3} textAlign="center">
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "600px" }}>
      <DeckGL
        layers={layers}
        controller
        initialViewState={INITIAL}
        viewState={view}
        onViewStateChange={({ viewState }) => setView(viewState)}
        style={{ width: "100%", height: "100%" }}
        getCursor={({ isDragging }) => (isDragging ? "grabbing" : "default")}
      />

      {/* Location Search */}
      <div style={{
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
                  zoom: 5
                }));
              });
          }}>Go</Button>
        </Box>
      </div>

      {/* Controls */}
      <div style={{
        position: "absolute", bottom: 10, left: 10, width: 280,
        background: "rgba(255,255,255,0.9)", padding: 12,
        borderRadius: 6, boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
      }}>
        <Typography variant="subtitle2">{now ? fmt(now) : "Loading…"}</Typography>
        {pick && <Typography variant="body2" color="primary">Tracking Duck: {pick}</Typography>}

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

        <Slider
          size="small"
          min={0}
          max={Math.max(0, filteredHours.length - 1)}
          value={idx}
          onChange={(_, v) => { setIdx(v); setPlay(false); }}
          disabled={isLoading || !filteredHours.length}
          valueLabelDisplay="auto"
          valueLabelFormat={i => i < 0 || i >= filteredHours.length ? "" : fmt(new Date(filteredHours[i]))}
        />

        <Typography variant="caption" color="textSecondary">
          Tracking {Object.keys(byDuck).length} ducks within Mississippi Flyway
        </Typography>
      </div>
    </div>
  );
}
