import React from "react";
import DuckMapFunction from "./components/DuckMapFunction"; 
import "./App.css"; // or any other global styles

function App() {
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
        {/* Render your React map component directly */}
        <DuckMapFunction />
      </div>

      {/* Footer */}
      <footer>
        <p>&copy; 2025 Duck Data. All Rights Reserved.</p>
      </footer>
    </div>
  );
}

export default App;