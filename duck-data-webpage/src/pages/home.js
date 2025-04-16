import React from "react";
import DuckMapFunction from "../components/DuckMapFunction"; 
import "../App.css";

function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section className="hero">
        <h1>Duck Data</h1>
        <p>
          Advanced Migration Analysis Tool <br />
          Predicts waterfowl movements in real-time
        </p>
      </section>

      {/* Main Content */}
      <div className="content">
        <h2>Welcome to Duck Data</h2>
        <DuckMapFunction />
      </div>

      {/* Footer */}
      <footer>
        <p>&copy; Insert footer idk what to put.</p>
      </footer>
    </div>
  );
}

export default Home;