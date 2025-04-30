/* eslint-disable no-restricted-globals */

import * as arrow from "apache-arrow";

self.onmessage = function (e) {
  const { arrayBuffer } = e.data;
  if (!arrayBuffer) {
    self.postMessage({ hours: [], binnedRows: {}, byDuck: {}, error: "No arrayBuffer" });
    return;
  }

  let rows = [];
  let hours = [];
  let binnedRows = {};
  let byDuck = {};

  try {
    const table = arrow.tableFromIPC(arrayBuffer);
    const duckCol = table.getChild('duck_id');
    const stCol = table.getChild('base_timestamp');
    const ftCol = table.getChild('forecast_timestamp');
    const sLatCol = table.getChild('start_lat');
    const sLonCol = table.getChild('start_lon');
    const fLatCol = table.getChild('forecast_lat');
    const fLonCol = table.getChild('forecast_lon');
    if (![duckCol, stCol, ftCol, sLatCol, sLonCol, fLatCol, fLonCol].every(Boolean)) {
      throw new Error("Missing one or more required columns in Arrow file.");
    }

    for (let i = 0; i < table.numRows; i++) {
        let duck = duckCol.get(i);
        // Convert BigInt to string if needed
        if (typeof duck === "bigint") duck = duck.toString();
        const st = new Date(stCol.get(i)).getTime();
        const ft = new Date(ftCol.get(i)).getTime();
        const sLat = parseFloat(sLatCol.get(i));
        const sLon = parseFloat(sLonCol.get(i));
        const fLat = parseFloat(fLatCol.get(i));
        const fLon = parseFloat(fLonCol.get(i));
        if (!duck || isNaN(st) || isNaN(ft) || [sLat, sLon, fLat, fLon].some(isNaN)) continue;
        rows.push({ duck, startTime: st, forecastTime: ft, startLat: sLat, startLon: sLon, forecastLat: fLat, forecastLon: fLon });
      }

    const times = rows.flatMap(r => [r.startTime, r.forecastTime]);
    const minT = Math.min(...times), maxT = Math.max(...times);
    for (let t = minT; t <= maxT; t += 3600000) hours.push(t);

    rows.forEach(r => {
      const hour = Math.floor(r.startTime / 3600000) * 3600000;
      (binnedRows[hour] ??= []).push(r);
    });

    rows.forEach(r => {
      (byDuck[r.duck] ??= []).push(r);
    });

    self.postMessage({
      hours,
      binnedRows,
      byDuck,
      debug: `Rows loaded: ${rows.length}, Example row: ${JSON.stringify(rows[0])}`
    });
  } catch (err) {
    self.postMessage({
      hours,
      binnedRows,
      byDuck,
      error: err.message,
      debug: `Rows loaded: ${rows.length}`
    });
  }
};