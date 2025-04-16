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
          <p>
            Current Time: {formattedDate} {formattedTime}
          </p>
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
            Observe duck migration patterns across North America. Use the map
            below to explore!
          </p>
          <div className="map-frame">
            <DuckMapFunction />
          </div>
        </div>
      </section>

      <section className="about-project-section">
        <div className="about-project-content">
          <h2>About Our Project</h2>
          <p>Learn more about our mission to track and study duck migration. </p>
        </div>
      </section>
    </div>
  );
}

export default Home;
