//TANIA AND BREANNA MAP

import React, { useState, useEffect, useMemo } from "react";
import { DeckGL } from "@deck.gl/react";
import { TileLayer } from "@deck.gl/geo-layers";
import { Slider, Typography, Box, Button, TextField } from "@mui/material";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { ScatterplotLayer, BitmapLayer, TextLayer } from "@deck.gl/layers";

// Utils
function parseDateTime(ts) {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(dateObj) {
  const opts = { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };
  return dateObj.toLocaleDateString("en-US", opts);
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
  maxZoom: 15,
  pitch: 0,
  bearing: 0,
};

const START_HEAT_COLORS = [
  [0, 0, 255, 50],
  [65, 105, 225, 100],
  [0, 191, 255, 150],
  [135, 206, 250, 200],
];

const FORECAST_HEAT_COLORS = [
  [255, 69, 0, 50],
  [255, 0, 0, 100],
  [178, 34, 34, 150],
  [139, 0, 0, 200],
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

  // Group by duck ID
  const duckMap = useMemo(() => {
    const map = {};
    for (const row of duckForecasts) {
      if (!map[row.duckId]) map[row.duckId] = [];
      map[row.duckId].push(row);
    }
    Object.keys(map).forEach(dId => map[dId].sort((a, b) => a.startTime - b.startTime));
    return map;
  }, [duckForecasts]);

  // Auto-play effect
  useEffect(() => {
    let animationFrame;
    if (isPlaying && uniqueTimes.length > 0) {
      const advanceTime = () => {
        setTimeIndex(prev => {
          const next = prev + 1;
          return next >= uniqueTimes.length ? 0 : next;
        });
        animationFrame = requestAnimationFrame(advanceTime);
      };
      animationFrame = requestAnimationFrame(advanceTime);
    }
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [isPlaying, uniqueTimes.length]);

  // Fetch CSV
  useEffect(() => {
    setIsLoading(true);
    fetch(`${process.env.PUBLIC_URL}/duck_migration_extended_forecasts.csv`)
      .then(response => {
        if (!response.ok)
          throw new Error(`Failed to fetch CSV data: ${response.status} ${response.statusText}`);
        return response.text();
      })
      .then(csvData => {
        const lines = csvData.trim().split("\n");
        const header = lines[0].split(",");
        const duckIdIdx = header.indexOf("duck_id");
        const baseTimeIdx = header.indexOf("base_timestamp");
        const forecastTimeIdx = header.indexOf("forecast_timestamp");
        const startLatIdx = header.indexOf("start_lat");
        const startLonIdx = header.indexOf("start_lon");
        const forecastLatIdx = header.indexOf("forecast_lat");
        const forecastLonIdx = header.indexOf("forecast_lon");
        if ([duckIdIdx, baseTimeIdx, forecastTimeIdx, startLatIdx, startLonIdx, forecastLatIdx, forecastLonIdx].includes(-1)) {
          throw new Error("CSV is missing required columns");
        }
        const parsedData = [];
        const timesSet = new Set();
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].trim();
          if (!row) continue;
          const cols = row.split(",");
          const duckId = cols[duckIdIdx];
          const baseTimeStr = cols[baseTimeIdx];
          const forecastTimeStr = cols[forecastTimeIdx];
          const startLat = cleanValue(cols[startLatIdx]);
          const startLon = cleanValue(cols[startLonIdx]);
          const forecastLat = cleanValue(cols[forecastLatIdx]);
          const forecastLon = cleanValue(cols[forecastLonIdx]);
          const startTime = parseDateTime(baseTimeStr);
          const forecastTime = parseDateTime(forecastTimeStr);
          if (!duckId || !startTime || !forecastTime ||
              isNaN(startLat) || isNaN(startLon) || isNaN(forecastLat) || isNaN(forecastLon)) {
            console.warn(`Skipping invalid row: ${row}`);
            continue;
          }
          parsedData.push({ duckId, startTime, forecastTime, startLat, startLon, forecastLat, forecastLon });
          timesSet.add(startTime.getTime());
          timesSet.add(forecastTime.getTime());
        }
        parsedData.sort((a, b) => a.startTime - b.startTime);
        const sortedTimes = Array.from(timesSet).sort((a, b) => a - b);
        console.log(`Loaded ${parsedData.length} duck forecasts with ${sortedTimes.length} unique timestamps`);
        setDuckForecasts(parsedData);
        setUniqueTimes(sortedTimes);
        setTimeIndex(0);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Error fetching CSV:", err);
        setError(`Failed to load data: ${err.message}`);
        setIsLoading(false);
      });
  }, []);

  // Current time calc
  const currentTime = useMemo(() => {
    if (!uniqueTimes.length || timeIndex < 0 || timeIndex >= uniqueTimes.length) return null;
    return new Date(uniqueTimes[timeIndex]);
  }, [uniqueTimes, timeIndex]);

  // Compute duck positions
  const { duckStartPositions, duckForecastPositions } = useMemo(() => {
    if (!currentTime) return { duckStartPositions: [], duckForecastPositions: [] };
    const startPositions = [];
    const forecastPositions = [];
    for (const duckId of Object.keys(duckMap)) {
      const rows = duckMap[duckId];
      if (!rows.length) continue;
      let foundRow = null;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.startTime <= currentTime && currentTime <= row.forecastTime) {
          foundRow = row;
          break;
        }
      }
      if (!foundRow) {
        if (currentTime < rows[0].startTime) foundRow = rows[0];
        else if (currentTime > rows[rows.length - 1].forecastTime) foundRow = rows[rows.length - 1];
      }
      if (!foundRow) continue;
      const { startTime, forecastTime, startLat, startLon, forecastLat, forecastLon } = foundRow;
      const totalTimeSpan = forecastTime - startTime;
      if (totalTimeSpan <= 0) {
        startPositions.push({ duckId, lat: startLat, lon: startLon, isSelected: duckId === selectedDuck });
        forecastPositions.push({ duckId, lat: forecastLat, lon: forecastLon, isSelected: duckId === selectedDuck });
      } else {
        const elapsedTime = currentTime - startTime;
        const fraction = Math.max(0, Math.min(1, elapsedTime / totalTimeSpan));
        const [currentLat, currentLon] = interpolateLatLon(startLat, startLon, forecastLat, forecastLon, fraction);
        startPositions.push({ duckId, lat: startLat, lon: startLon, isSelected: duckId === selectedDuck, currentLat, currentLon });
        forecastPositions.push({ duckId, lat: forecastLat, lon: forecastLon, isSelected: duckId === selectedDuck, currentLat, currentLon });
      }
    }
    return { duckStartPositions: startPositions, duckForecastPositions: forecastPositions };
  }, [currentTime, duckMap, selectedDuck]);

  // Scatter points
  const currentDuckPositions = useMemo(() => {
    return duckStartPositions.map(startPos => ({
      duckId: startPos.duckId,
      lat: startPos.currentLat || startPos.lat,
      lon: startPos.currentLon || startPos.lon,
      isSelected: startPos.isSelected
    }));
  }, [duckStartPositions]);

  // Map layers
  const layers = useMemo(() => {
    const tileLayer = new TileLayer({
      id: "base-map",
      data: "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      renderSubLayers: (props) => {
        const { bbox: { west, south, east, north } } = props.tile;
        return new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [west, south, east, north],
        });
      },
    });
    const startHeatmapLayer = new HeatmapLayer({
      id: "duck-start-heatmap",
      data: duckStartPositions,
      getPosition: d => [d.lon, d.lat],
      getWeight: d => 1,
      radiusPixels: 60,
      colorRange: START_HEAT_COLORS,
      intensity: 1,
      threshold: 0.05,
      pickable: true,
    });
    const forecastHeatmapLayer = new HeatmapLayer({
      id: "duck-forecast-heatmap",
      data: duckForecastPositions,
      getPosition: d => [d.lon, d.lat],
      getWeight: d => 1,
      radiusPixels: 60,
      colorRange: FORECAST_HEAT_COLORS,
      intensity: 1,
      threshold: 0.05,
      pickable: true,
    });
    const scatterLayer = new ScatterplotLayer({
      id: "duck-scatter",
      data: currentDuckPositions,
      getPosition: d => [d.lon, d.lat],
      getRadius: d => d.isSelected ? 200 : 80,
      radiusMinPixels: d => d.isSelected ? 6 : 2,
      radiusMaxPixels: d => d.isSelected ? 20 : 10,
      getFillColor: d => d.isSelected ? [255, 165, 0, 220] : [0, 0, 0, 180],
      stroked: true,
      getLineColor: d => d.isSelected ? [255, 255, 255, 255] : [255, 255, 255, 0],
      lineWidthMinPixels: 1,
      pickable: true,
      onClick: info => {
        if (info.object) setSelectedDuck(info.object.duckId);
      }
    });
    const labelLayer = selectedDuck ? new TextLayer({
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
    }) : null;
    return [tileLayer, startHeatmapLayer, forecastHeatmapLayer, scatterLayer, ...(labelLayer ? [labelLayer] : [])];
  }, [duckStartPositions, duckForecastPositions, currentDuckPositions, selectedDuck]);

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <Typography variant="h5" color="error">Error loading duck migration data</Typography>
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
          setViewState({ ...viewState, latitude: lat, longitude: lon, zoom: 12 });
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
      {/* Location input at top */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          width: "300px",
          height: "40px",
          background: "rgba(255,255,255,0.9)",
          padding: "10px",
          borderRadius: "8px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <TextField
            label="City or Town"
            size="small"
            value={cityInput}
            onChange={e => setCityInput(e.target.value)}
          />
          <Button variant="contained" onClick={handleGeocode} size="small">
            Focus
          </Button>
        </Box>
      </div>
      {/* Controls at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          width: "250px",
          background: "rgba(255,255,255,0.9)",
          padding: "15px",
          borderRadius: "8px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          zIndex: 999,
        }}
      >
        <Typography variant="h6" gutterBottom>{currentTimeLabel}</Typography>
        {selectedDuck && (
          <Typography variant="body2" color="primary" gutterBottom>
            Tracking Duck ID: {selectedDuck} (Click elsewhere to deselect)
          </Typography>
        )}
        <Box display="flex" alignItems="center" mb={1} mt={1}>
          <div style={{ width: 12, height: 12, backgroundColor: "blue", marginRight: 5 }}></div>
          <Typography variant="caption" style={{ marginRight: 15 }}>Starting Location</Typography>
          <div style={{ width: 12, height: 12, backgroundColor: "red", marginRight: 5 }}></div>
          <Typography variant="caption">Forecast Location</Typography>
        </Box>
        <Box display="flex" alignItems="center" mb={1} mt={2}>
          <Button
            variant="contained"
            color={isPlaying ? "secondary" : "primary"}
            onClick={() => setIsPlaying(!isPlaying)}
            size="small"
            sx={{ mr: 2 }}
            disabled={isLoading || !uniqueTimes.length}
          >
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </Button>
          {isLoading && (
            <Typography variant="body2" color="textSecondary">Loading data...</Typography>
          )}
        </Box>
        <Slider
          min={0}
          max={Math.max(0, uniqueTimes.length - 1)}
          value={timeIndex}
          onChange={(_, val) => {
            setTimeIndex(val);
            if (isPlaying) setIsPlaying(false);
          }}
          step={1}
          disabled={isLoading || !uniqueTimes.length}
          valueLabelDisplay="auto"
          valueLabelFormat={(idx) => {
            if (idx < 0 || idx >= uniqueTimes.length) return "";
            const d = new Date(uniqueTimes[idx]);
            return formatDate(d);
          }}
        />
        <Typography variant="body2" color="textSecondary" style={{ marginTop: 10 }}>
          Tracking {Object.keys(duckMap).length} unique ducks
        </Typography>
      </div>
    </div>
  );
}
