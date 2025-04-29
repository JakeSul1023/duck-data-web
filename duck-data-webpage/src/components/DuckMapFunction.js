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
  TextLayer,
  LineLayer
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

const INITIAL = {
  latitude: 36.28,
  longitude: -89.42,
  zoom: 3.5,
  minZoom: 3.5,
  maxZoom: 5,
  pitch: 0,
  bearing: 0
};

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

  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL}/Mississippi_Flyway_FeatureCollection.geojson`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(data => {
        console.log("Loaded flyway GeoJSON:", data);
        setFly(data);
      })
      .catch(console.error);
  }, []);

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


  const byDuck = useMemo(() => {
    const m = {};
    rows.forEach(r => (m[r.duck] ??= []).push(r));
    Object.values(m).forEach(a => a.sort((a, b) => a.startTime - b.startTime));
    return m;
  }, [rows]);

  const uniqueDays = useMemo(() => {
    const s = new Set();
    hours.forEach(t => {
      const d = new Date(t);
      s.add(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());
    });
    return [...s].sort((a, b) => a - b);
  }, [hours]);

  const filteredHours = useMemo(() => {
    if (!selectedDay) return hours;
    return hours.filter(t => {
      const d = new Date(t);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === selectedDay;
    });
  }, [hours, selectedDay]);

  const filtered6HourIdxs = useMemo(() => {
    // Only keep indices where the hour is divisible by 6
    return filteredHours
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => new Date(t).getHours() % 6 === 0)
      .map(({ i }) => i);
  }, [filteredHours]);

  const now = useMemo(
    () => (filteredHours.length ? new Date(filteredHours[Math.min(idx, filteredHours.length - 1)]) : null),
    [filteredHours, idx]
  );

  useEffect(() => {
    let timer;
    if (play && filtered6HourIdxs.length) {
      timer = setTimeout(() => {
        setIdx(prevIdx => {
          const current6Idx = filtered6HourIdxs.findIndex(i => i === prevIdx);
          const next6Idx = (current6Idx + 1) % filtered6HourIdxs.length;
          return filtered6HourIdxs[next6Idx];
        });
      }, 100);
    }
    return () => timer && clearTimeout(timer);
  }, [play, filtered6HourIdxs, idx]);

  useEffect(() => {
    if (
      filteredHours.length > 0 && 
      idx >= filteredHours.length && 
      idx !== 0
    ) {
      setIdx(0);
    }
  }, [filteredHours, idx]);

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

  const curPos = useMemo(() =>
    departPos
      .map(p => ({ duck: p.duck, lat: p.curLat, lon: p.curLon, sel: p.sel })),
    [departPos]
  );
  
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

const flowHeat = useMemo(() => {
  const points = [];
  Object.values(byDuck).forEach(arr => {
    arr.forEach(r => {
      if (insideFlyway([r.forecastLon, r.forecastLat])) {
        points.push({ position: [r.forecastLon, r.forecastLat], weight: 1 });
      }
      if (insideFlyway([r.startLon, r.startLat])) {
        points.push({ position: [r.startLon, r.startLat], weight: 1 });
      }
    });
  });
  return points;
}, [byDuck, insideFlyway]);

const allFlowPoints = useMemo(() => {
  const points = [];
  Object.values(byDuck).forEach(arr => {
    arr.forEach(r => {
      if (
        insideFlyway([r.startLon, r.startLat]) &&
        insideFlyway([r.forecastLon, r.forecastLat])
      ) {
        // Interpolate 10 points along the path
        for (let f = 0; f <= 1; f += 0.02) {
          const lat = r.startLat + (r.forecastLat - r.startLat) * f;
          const lon = r.startLon + (r.forecastLon - r.startLon) * f;
          points.push({ position: [lon, lat], weight: 1 });
        }
      }
    });
  });
  return points;
}, [byDuck, insideFlyway]);

const flowVector = useMemo(() => {
  if (!allFlowPoints.length) return null;
  // Calculate centroid
  let sumLat = 0, sumLon = 0;
  allFlowPoints.forEach(p => {
    sumLon += p.position[0];
    sumLat += p.position[1];
  });
  const center = [sumLon / allFlowPoints.length, sumLat / allFlowPoints.length];

  // Calculate average movement vector (from start to forecast)
  let dx = 0, dy = 0, n = 0;
  Object.values(byDuck).forEach(arr => {
    arr.forEach(r => {
      dx += (r.forecastLon - r.startLon);
      dy += (r.forecastLat - r.startLat);
      n++;
    });
  });
  if (n === 0) return null;
  // Normalize vector for display
  const scale = 2; // Adjust for visual length
  const vec = [center[0] + dx / n * scale, center[1] + dy / n * scale];
  return { start: center, end: vec };
}, [allFlowPoints, byDuck]);

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

const dynamicLayers = useMemo(() => {
  // Blue gradient for movement heatmap
  const BLUE_GRADIENT = [
    [0, 0, 255, 0],
    [0, 0, 255, 120],
    [0, 0, 255, 255]
  ];

  // Single movement heatmap
  const movementHeatmap = new HeatmapLayer({
    id: "movement-heatmap",
    data: forecastHeat,
    getPosition: d => d.position,
    getWeight: d => d.weight,
    radiusPixels: 60,
    colorRange: BLUE_GRADIENT,
    intensity: 1.5,
    threshold: 0.03,
    parameters: { depthTestDisable: true },
    pickable: false, // Explicitly set
    updateTriggers: {
      getPosition: [forecastHeat],
      getWeight: [forecastHeat]
    }
  });

  // Flow vector arrow
  const flowArrow = flowVector && new LineLayer({
    id: "flow-arrow",
    data: [flowVector],
    getSourcePosition: d => d.start,
    getTargetPosition: d => d.end,
    getColor: [255, 140, 0, 220],
    getWidth: 6,
    pickable: false
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
}, [allFlowPoints, flowVector, pathData, now, curPos, pick, stagnantDucks, forecastHeat]);

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

        <Typography variant="caption" color="textSecondary">
          Tracking {Object.keys(byDuck).length} ducks within Mississippi Flyway
        </Typography>
      </div>

      {/* Flow Arrow Legend */}
      {flowVector && (() => {
        // Calculate intensity (average movement magnitude)
        const dx = flowVector.end[0] - flowVector.start[0];
        const dy = flowVector.end[1] - flowVector.start[1];
        const magnitude = Math.sqrt(dx * dx + dy * dy);
      
        // Map magnitude to arrow length and color
        const minLen = 10, maxLen = 18;
        const minMag = 0.1, maxMag = 2.5; // tune as needed
        const len = Math.max(minLen, Math.min(maxLen, minLen + (maxLen - minLen) * ((magnitude - minMag) / (maxMag - minMag))));
        // Clamp and interpolate color from orange to dark orange
        const colorVal = Math.max(140, Math.min(255, 140 + 115 * ((magnitude - minMag) / (maxMag - minMag))));
        const color = `rgb(255, ${Math.round(colorVal)}, 0)`;
      
        // Normalize direction for consistent arrow
        const norm = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / norm, uy = -dy / norm; // SVG y axis is down
      
        // Arrow start and end in SVG coordinates
        const cx = 20, cy = 20;
        const ex = cx + ux * len;
        const ey = cy + uy * len;
      
        return (
          <div style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            width: 70,
            height: 70,
            background: "rgba(255,255,255,0.95)",
            borderRadius: 8,
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10
          }}>
            <div style={{ fontSize: 11, color: "#333", marginBottom: 2 }}>Trajectory</div>
            <svg width={40} height={40} style={{ display: "block" }}>
              <defs>
                <marker id="arrowhead" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">
                  <polygon points="0 0, 7 3.5, 0 7" fill={color} />
                </marker>
              </defs>
              <line
                x1={cx}
                y1={cy}
                x2={ex}
                y2={ey}
                stroke={color}
                strokeWidth={3}
                markerEnd="url(#arrowhead)"
              />
            </svg>
          </div>
        );
      })()}

      {now && (() => {
  const month = now.getMonth() + 1;
  const day = now.getDate();

  let status = "";
  let message = "";

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
    <div style={{
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