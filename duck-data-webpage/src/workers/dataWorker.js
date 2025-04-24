/* eslint-disable no-restricted-globals */
// src/workers/dataWorker.js

self.onmessage = function (e) {
    const { csvText } = e.data;
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length <= 1) {
      self.postMessage({ hours: [], binnedRows: {} });
      return;
    }
  
    // 1) Parse all rows into a flat array
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      if (cols.length < 8) continue;
      const duck = cols[0];
      const st = new Date(cols[1].includes("T") ? cols[1] : cols[1].replace(" ", "T") + "Z").getTime();
      const ft = new Date(cols[3].includes("T") ? cols[3] : cols[3].replace(" ", "T") + "Z").getTime();
      const sLat = parseFloat(cols[4]), sLon = parseFloat(cols[5]);
      const fLat = parseFloat(cols[6]), fLon = parseFloat(cols[7]);
      if (!duck || isNaN(st) || isNaN(ft) || [sLat, sLon, fLat, fLon].some(isNaN)) continue;
      rows.push({ duck, startTime: st, forecastTime: ft, startLat: sLat, startLon: sLon, forecastLat: fLat, forecastLon: fLon });
    }
  
    // 2) Build the hourly index
    const times = rows.flatMap(r => [r.startTime, r.forecastTime]);
    const minT = Math.min(...times), maxT = Math.max(...times);
    const hours = [];
    for (let t = minT; t <= maxT; t += 3600000) hours.push(t);
  
    const binnedRows = {};
    rows.forEach(r => {
      const hour = Math.floor(r.startTime / 3600000) * 3600000;
      (binnedRows[hour] ??= []).push(r);
    });
    
    // 4) Group rows by duck ID
    const byDuck = {};
    rows.forEach(r => {
      (byDuck[r.duck] ??= []).push(r);
    });
  
    // 4) Post back the results
    self.postMessage({
        hours,        // array of hour timestamps
        binnedRows,   // object: {hour: [row, row, ...], ...}
        byDuck        // object: {duckId: [row, row, ...], ...}  // optional, if you want to bin by duck
    });
};
  