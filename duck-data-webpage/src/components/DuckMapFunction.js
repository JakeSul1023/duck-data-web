// DuckMigrationMap.jsx

import React, { useState, useEffect, useMemo } from "react";
import { DeckGL } from "@deck.gl/react";
import { TileLayer, TripsLayer } from "@deck.gl/geo-layers";
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
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { ScatterplotLayer, BitmapLayer, TextLayer } from "@deck.gl/layers";

// Utils
function parseDateTime(ts) {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(dateObj) {
  const opts = { weekday: "short", month: "short", day: "numeric", hour: "2-digit" };
  return dateObj.toLocaleDateString("en-US", opts);
}

// Helper to format just the day (for the day dropdown)
function formatDay(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function interpolateLatLon(lat1, lon1, lat2, lon2, fraction) {
  const lat = lat1 + (lat2 - lat1) * fraction;
  const lon = lon1 + (lon2 - lon1) * fraction;
  return [lat, lon];
}

function cleanValue(value) {
  if (typeof value !== "string") return value;
  return parseFloat(value.replace(/\*/g, ""));
}

// Constants
const INITIAL_VIEW = {
  latitude: 36.28,
  longitude: -89.42,
  zoom: 5,
  minZoom: 3,
  maxZoom: 7,
  pitch: 0,
  bearing: 0,
};

// New gradient heat map colors from blue to red
const GRADIENT_HEAT_COLORS = [
  [0, 0, 255, 50],     // Blue (lightest) - prediction start
  [75, 0, 130, 100],   // Indigo - transition
  [128, 0, 128, 150],  // Purple - middle transition 
  [255, 0, 0, 200]     // Red (densest) - current position
];

// Main Component
export default function DuckMigrationMap() {
  const [duckForecasts, setDuckForecasts] = useState([]);
  const [uniqueTimes, setUniqueTimes] = useState([]);
  const [timeIndex, setTimeIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedDuck, setSelectedDuck] = useState(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [cityInput, setCityInput] = useState("");

  // which day is selected? (null means "All Days")
  const [selectedDay, setSelectedDay] = useState(null);

  // Group by duck ID
  const duckMap = useMemo(() => {
    const map = {};
    for (const row of duckForecasts) {
      if (!map[row.duckId]) {
        map[row.duckId] = [];
      }
      map[row.duckId].push(row);
    }
    Object.keys(map).forEach(dId => {
      map[dId].sort((a, b) => a.startTime - b.startTime);
    });
    return map;
  }, [duckForecasts]);

  // Load data (HOURLY)
  useEffect(() => {
    setIsLoading(true);

    fetch(`${process.env.PUBLIC_URL}/GNN_prediction_OneWeek(Raw).csv`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch CSV data: ${response.status} ${response.statusText}`);
        }
        return response.text();
      })
      .then(csvData => {
        const lines = csvData.trim().split("\n");
        const parsedData = [];

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].trim();
          if (!row) continue;

          const cols = row.split(",");
          if (cols.length < 7) {
            console.warn("Skipping invalid row (not enough columns):", row);
            continue;
          }

          const duckId          = cols[0];
          const baseTimeStr     = cols[1];
          const forecastTimeStr = cols[2];
          const startLat        = cleanValue(cols[3]);
          const startLon        = cleanValue(cols[4]);
          const forecastLat     = cleanValue(cols[5]);
          const forecastLon     = cleanValue(cols[6]);

          const startTime = parseDateTime(baseTimeStr);
          const forecastTime = parseDateTime(forecastTimeStr);

          if (
            !duckId || !startTime || !forecastTime ||
            isNaN(startLat) || isNaN(startLon) ||
            isNaN(forecastLat) || isNaN(forecastLon)
          ) {
            console.warn("Skipping invalid row:", row);
            continue;
          }

          parsedData.push({
            duckId,
            startTime,
            forecastTime,
            startLat,
            startLon,
            forecastLat,
            forecastLon
          });
        }

        // Sort by startTime
        parsedData.sort((a, b) => a.startTime - b.startTime);

        // Identify min/max timestamps
        let minTimeMs = Infinity;
        let maxTimeMs = -Infinity;
        for (const d of parsedData) {
          const st = d.startTime.getTime();
          const ft = d.forecastTime.getTime();
          if (st < minTimeMs) minTimeMs = st;
          if (ft < minTimeMs) minTimeMs = ft;
          if (st > maxTimeMs) maxTimeMs = st;
          if (ft > maxTimeMs) maxTimeMs = ft;
        }

        // Generate HOURLY timestamps
        const hourlyTimes = [];
        const oneHour = 3600000; // ms in an hour
        for (let t = minTimeMs; t <= maxTimeMs; t += oneHour) {
          hourlyTimes.push(t);
        }

        setDuckForecasts(parsedData);
        setUniqueTimes(hourlyTimes);
        setTimeIndex(0);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Error fetching CSV:", err);
        setError(`Failed to load data: ${err.message}`);
        setIsLoading(false);
      });
  }, []);

  // Identify which days appear in the data (for day-selection)
  const uniqueDays = useMemo(() => {
    const daySet = new Set();
    uniqueTimes.forEach(t => {
      const d = new Date(t);
      // midnight for that day
      const dayMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      daySet.add(dayMidnight);
    });
    // Sort them so they're in chronological order
    return Array.from(daySet).sort((a, b) => a - b);
  }, [uniqueTimes]);

  // Filter the hourly timeline by the selected day (if any)
  const filteredTimes = useMemo(() => {
    if (!selectedDay) {
      // "All Days" => Return all hours
      return uniqueTimes;
    }
    // Return only hours whose midnight matches `selectedDay`
    return uniqueTimes.filter(t => {
      const d = new Date(t);
      const dayMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      return dayMidnight === selectedDay;
    });
  }, [uniqueTimes, selectedDay]);

  // Current time = the hour at timeIndex in filteredTimes
  const currentTime = useMemo(() => {
    if (!filteredTimes.length || timeIndex < 0 || timeIndex >= filteredTimes.length) {
      return null;
    }
    return new Date(filteredTimes[timeIndex]);
  }, [filteredTimes, timeIndex]);

  // Auto-play effect
  useEffect(() => {
    let animationFrame;
    if (isPlaying && filteredTimes.length > 0) {
      const advanceTime = () => {
        setTimeIndex(prev => {
          const next = prev + 1;
          // If we hit the end, loop to start
          return next >= filteredTimes.length ? 0 : next;
        });
        animationFrame = requestAnimationFrame(advanceTime);
      };
      animationFrame = requestAnimationFrame(advanceTime);
    }
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [isPlaying, filteredTimes]);

  // If the user changes days, reset timeIndex if out of range
  useEffect(() => {
    if (timeIndex >= filteredTimes.length) {
      setTimeIndex(0);
    }
  }, [filteredTimes, timeIndex]);

  // Compute duck positions
  const { duckStartPositions, duckForecastPositions } = useMemo(() => {
    if (!currentTime) {
      return { duckStartPositions: [], duckForecastPositions: [] };
    }

    const startPositions = [];
    const forecastPositions = [];

    for (const duckId of Object.keys(duckMap)) {
      const rows = duckMap[duckId];
      if (!rows.length) continue;

      let foundRow = null;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        // If the current time is between startTime & forecastTime
        if (row.startTime <= currentTime && currentTime <= row.forecastTime) {
          foundRow = row;
          break;
        }
      }

      // If no row covers currentTime, use earliest or latest
      if (!foundRow) {
        if (currentTime < rows[0].startTime) {
          foundRow = rows[0];
        } else if (currentTime > rows[rows.length - 1].forecastTime) {
          foundRow = rows[rows.length - 1];
        }
      }
      if (!foundRow) continue;

      const { startTime, forecastTime, startLat, startLon, forecastLat, forecastLon } = foundRow;
      const totalTimeSpan = forecastTime - startTime;

      if (totalTimeSpan <= 0) {
        // No timespan => raw positions
        startPositions.push({ duckId, lat: startLat, lon: startLon, isSelected: duckId === selectedDuck });
        forecastPositions.push({ duckId, lat: forecastLat, lon: forecastLon, isSelected: duckId === selectedDuck });
      } else {
        // Interpolate
        const elapsedTime = currentTime - startTime;
        const fraction = Math.max(0, Math.min(1, elapsedTime / totalTimeSpan));
        const [currentLat, currentLon] = interpolateLatLon(
          startLat,
          startLon,
          forecastLat,
          forecastLon,
          fraction
        );
        startPositions.push({
          duckId,
          lat: startLat,
          lon: startLon,
          isSelected: duckId === selectedDuck,
          currentLat,
          currentLon
        });
        forecastPositions.push({
          duckId,
          lat: forecastLat,
          lon: forecastLon,
          isSelected: duckId === selectedDuck,
          currentLat,
          currentLon
        });
      }
    }

    return { duckStartPositions: startPositions, duckForecastPositions: forecastPositions };
  }, [currentTime, duckMap, selectedDuck]);

  // Current (interpolated) positions for the ducks
  const currentDuckPositions = useMemo(() => {
    return duckStartPositions.map(startPos => ({
      duckId: startPos.duckId,
      lat: startPos.currentLat || startPos.lat,
      lon: startPos.currentLon || startPos.lon,
      isSelected: startPos.isSelected
    }));
  }, [duckStartPositions]);

  // Generate path data for the migration trails
  const duckPathData = useMemo(() => {
    return Object.entries(duckMap).map(([duckId, rows]) => {
      if (rows.length < 2) return null;
      
      // Extract all waypoints for this duck
      const waypoints = rows.map(row => ({
        position: [row.forecastLon, row.forecastLat],
        timestamp: row.forecastTime.getTime()
      }));
      
      // Sort by timestamp
      waypoints.sort((a, b) => a.timestamp - b.timestamp);
      
      return {
        duckId,
        path: waypoints.map(wp => wp.position),
        timestamps: waypoints.map(wp => wp.timestamp),
        isSelected: duckId === selectedDuck
      };
    }).filter(Boolean);
  }, [duckMap, selectedDuck]);

  // Map layers
  const layers = useMemo(() => {
    // 1) tileLayer (base map)
    const tileLayer = new TileLayer({
      id: "base-map",
      data: "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      renderSubLayers: props => {
        const {
          bbox: { west, south, east, north }
        } = props.tile;
        return new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [west, south, east, north]
        });
      }
    });

    // 2) Migration path trails - showing the flow of ducks over time
    const migrationPathLayer = new TripsLayer({
      id: 'duck-migration-paths',
      data: duckPathData,
      getPath: d => d.path,
      getTimestamps: d => d.timestamps,
      getColor: d => d.isSelected ? [255, 165, 0, 180] : [100, 100, 255, 100],
      widthMinPixels: d => d.isSelected ? 3 : 2,
      rounded: true,
      trailLength: 0.15,
      currentTime: currentTime ? currentTime.getTime() : 0,
      updateTriggers: {
        getColor: [selectedDuck]
      }
    });

    // 3) Combined gradient heatmap layer showing the flock movement pattern
    const combinedHeatmapLayer = new HeatmapLayer({
      id: "duck-combined-heatmap",
      data: [
        // Current positions (weighted more heavily - will appear redder)
        ...currentDuckPositions.map(d => ({
          position: [d.lon, d.lat],
          weight: 1.2,
          type: 'current'
        })),
        // Intermediate positions (create purple gradient effect)
        ...duckStartPositions.flatMap(d => {
          // Create intermediate points between current and forecast
          if (!d.currentLat || !d.currentLon) return [];
          
          // Generate 3 points along the path to create a gradient effect
          const points = [];
          for (let i = 0.2; i <= 0.8; i += 0.2) {
            const [intermediateLat, intermediateLon] = interpolateLatLon(
              d.currentLat, d.currentLon,
              d.lat, d.lon,
              i
            );
            points.push({
              position: [intermediateLon, intermediateLat],
              weight: 0.9 - i * 0.5, // Less weight as we move toward forecast
              type: 'intermediate'
            });
          }
          return points;
        }),
        // Forecast positions (weighted less - will appear bluer)
        ...duckForecastPositions.map(d => ({
          position: [d.lon, d.lat],
          weight: 0.7,
          type: 'forecast'
        }))
      ],
      getPosition: d => d.position,
      getWeight: d => d.weight,
      radiusPixels: 60,  // Larger radius for smoother blending
      colorRange: GRADIENT_HEAT_COLORS,
      intensity: 1.5,    // Higher intensity for better visibility
      threshold: 0.03,   // Lower threshold to show more of the gradient
      pickable: true,
      updateTriggers: {
        getWeight: [currentTime]
      }
    });

    // 4) scatter layer - shows individual ducks
    const scatterLayer = new ScatterplotLayer({
      id: "duck-scatter",
      data: currentDuckPositions,
      getPosition: d => [d.lon, d.lat],
      getRadius: d => (d.isSelected ? 180 : 60),
      radiusMinPixels: d => (d.isSelected ? 5 : 2),
      radiusMaxPixels: d => (d.isSelected ? 15 : 10),
      getFillColor: d => (d.isSelected ? [255, 165, 0, 200] : [0, 0, 0, 150]),
      stroked: true,
      getLineColor: d => (d.isSelected ? [255, 255, 255, 255] : [255, 255, 255, 0]),
      lineWidthMinPixels: 1,
      pickable: true,
      onClick: info => {
        if (info.object) {
          setSelectedDuck(info.object.duckId);
        }
      }
    });

    // 5) label layer
    const labelLayer =
      selectedDuck &&
      new TextLayer({
        id: "duck-labels",
        data: currentDuckPositions.filter(d => d.duckId === selectedDuck),
        getPosition: d => [d.lon, d.lat],
        getText: d => `Duck ID: ${d.duckId}`,
        getSize: 12,
        getAngle: 0,
        getTextAnchor: "middle",
        getAlignmentBaseline: "center",
        getPixelOffset: [0, -20],
        getColor: [255, 255, 255],
        background: true,
        getBorderColor: [0, 0, 0],
        getBorderWidth: 3,
        backgroundPadding: [5, 3],
        getBackgroundColor: [0, 0, 0, 200]
      });

    return [
      tileLayer,
      migrationPathLayer,
      combinedHeatmapLayer,
      scatterLayer,
      ...(labelLayer ? [labelLayer] : [])
    ];
  }, [
    duckStartPositions,
    duckForecastPositions,
    currentDuckPositions,
    duckPathData,
    selectedDuck,
    currentTime
  ]);

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <Typography variant="h5" color="error">
          Error loading duck migration data
        </Typography>
        <Typography>{error}</Typography>
      </div>
    );
  }

  const currentTimeLabel = currentTime ? formatDate(currentTime) : "Loading...";

  // Geocode and focus on user input city/town
  const handleGeocode = () => {
    const query = cityInput.trim();
    if (!query) return;
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          setViewState(view => ({ ...view, latitude: lat, longitude: lon, zoom: 12 }));
        } else {
          alert("Location not found!");
        }
      })
      .catch(err => {
        console.error("Geocode error:", err);
        alert("Error geocoding location");
      });
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "600px" }}>
      {/* Map */}
      <DeckGL
        initialViewState={INITIAL_VIEW}
        controller={true}
        layers={layers}
        style={{ width: "100%", height: "100%" }}
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
        getCursor={({ isDragging }) => (isDragging ? "grabbing" : "default")}
      />

      {/* Location input (top-left) */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          width: "250px",
          background: "rgba(255,255,255,0.9)",
          padding: "6px",
          borderRadius: "6px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <TextField
            label="City / Town"
            size="small"
            value={cityInput}
            onChange={e => setCityInput(e.target.value)}
            sx={{ flex: 1 }}
          />
          <Button variant="contained" onClick={handleGeocode} size="small">
            Focus
          </Button>
        </Box>
      </div>

      {/* Controls (bottom-left) */}
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: 10,
          width: "240px",
          background: "rgba(255,255,255,0.85)",
          padding: "8px",
          borderRadius: "6px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
          zIndex: 999
        }}
      >
          {/* Time Label */}
          <Typography variant="subtitle2" gutterBottom>
            {currentTimeLabel}
          </Typography>

          {/* Duck selection info */}
          {selectedDuck && (
            <Typography variant="body2" color="primary" gutterBottom>
              Tracking Duck ID: {selectedDuck}
            </Typography>
          )}

          {/* Day selection dropdown */}
          <FormControl size="small" fullWidth sx={{ mb: 1 }}>
            <InputLabel id="day-select-label">Day</InputLabel>
            <Select
              labelId="day-select-label"
              label="Day"
              value={selectedDay || ""}
              onChange={e => {
                const val = e.target.value;
                if (val === "ALL_DAYS") {
                  setSelectedDay(null);
                  setTimeIndex(0);
                  setIsPlaying(false);
                } else {
                  const dayNumber = Number(val);
                  setSelectedDay(dayNumber);
                  setTimeIndex(0);
                  setIsPlaying(false);
                }
              }}
            >
              <MenuItem value="ALL_DAYS">All Days</MenuItem>
              {uniqueDays.map(day => (
                <MenuItem key={day} value={day}>
                  {formatDay(day)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Updated Legend with gradient */}
          <Box display="flex" flexDirection="column" mb={1}>
            <Typography variant="caption" gutterBottom>Duck Migration Pattern:</Typography>
            <Box display="flex" alignItems="center">
              <Box 
                sx={{ 
                  width: 120, 
                  height: 12, 
                  background: 'linear-gradient(to right, blue, indigo, purple, red)',
                  mr: 1,
                  borderRadius: 1 
                }} 
              />
            </Box>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="caption">Prediction</Typography>
              <Typography variant="caption">Current</Typography>
            </Box>
          </Box>

          {/* Play/Pause + Slider */}
          <Box display="flex" alignItems="center" mb={1}>
            <Button
              variant="contained"
              color={isPlaying ? "secondary" : "primary"}
              onClick={() => setIsPlaying(!isPlaying)}
              size="small"
              sx={{ mr: 1 }}
              disabled={isLoading || !filteredTimes.length}
            >
              {isPlaying ? "Pause" : "Play"}
            </Button>
            {isLoading && (
              <Typography variant="body2" color="textSecondary">
                Loading...
              </Typography>
            )}
          </Box>

          <Slider
            size="small"
            min={0}
            max={Math.max(0, filteredTimes.length - 1)}
            value={timeIndex}
            onChange={(_, val) => {
              setTimeIndex(val);
              if (isPlaying) {
                setIsPlaying(false);
              }
            }}
            step={1}
            disabled={isLoading || !filteredTimes.length}
            valueLabelDisplay="auto"
            valueLabelFormat={idx => {
              if (idx < 0 || idx >= filteredTimes.length) return "";
              const d = new Date(filteredTimes[idx]);
              return formatDate(d);
            }}
            sx={{ mb: 1 }}
          />

          <Typography variant="caption" color="textSecondary">
            Tracking {Object.keys(duckMap).length} ducks
          </Typography>
      </div>
    </div>
  );
}