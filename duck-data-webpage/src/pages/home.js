/*
  Author: Jacob Sullivan
  Date: 2025-05-04
  Descritpion: This file contains the main home page component for the Duck Data Webpage.
  It includes a header, an interactive map, and sections about the project, styled using CSS.
*/
import React, { useState, useEffect } from "react";
import DuckMapFunction from "../components/DuckMapFunction";
import "../App.css";

function Home() {
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentDateTime.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = currentDateTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <div className="home-container">
      <section className="nws-info-bar">
        <div className="nws-info-content">
      </div>
      </section>

      <div className="home-header">
        <h1>Welcome to the Duck Migration Tracker</h1>
        <p>
          Explore real-time duck migration patterns and behavior.
        </p>
      </div>

      <section className="key-map-section">
        <div className="key-map-content">
          <h2>Interactive Migration Map</h2>
          <p>
            Observe duck migration patterns across Mississippi Flyway. Use the map
            below to explore!
          </p>
          <p>
            Current Time: {formattedDate} {formattedTime}
          </p>
          <div className="map-frame">
            <DuckMapFunction />
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
