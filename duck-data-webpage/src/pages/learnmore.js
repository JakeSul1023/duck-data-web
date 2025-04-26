import React from "react";
import './LearnMore.css';

import MapImage from './assets/flyways.png';
import ModelOverviewImg from './assets/modeloverview.png';
import Figure1Img from './assets/Figure_1.png';
import Figure3Img from './assets/Figure_3.png';

export default function LearnMore() {
  return (
    <div className="learnmore-container">

      {/* Moveduck Intro Section */}
      <section className="intro-section">
        <div className="Learnmore-header">
          <h1>This is Moveduck:</h1>
          <h2>Mallard Migration Predictor - Mississippi Flyway</h2>
        </div>

        <div className="flyway-map fade-in">
          <img src={MapImage} alt="Mississippi Flyway Map" className="map-image" />
        </div>

        <div className="Learnmore-description fade-in">
          <p>
            The Moveduck application focuses on analyzing collected migration data to uncover patterns
            and trends in duck movements. By examining historical flight data, weather patterns, and flock counts
            provided by Tennessee Technological University's wildlife and biology chief, the application applies
            predictive algorithms (Graph Neural Network (GNN)) to generate accurate forecasts of future migration paths.
            This data-driven approach equips researchers and conservationists with the insights they need to track duck populations
            in real time.
          </p>
        </div>
      </section>

      {/* Prediction Model Overview Section */}
      <section className="prediction-section">
        <h2 className="section-title">Prediction Model Overview</h2>
        <img src={ModelOverviewImg} alt="Prediction Model Overview" className="overview-image" />

        <div className="model-functionality">
          <h3>Prediction Model Functionality</h3>
          <p>
            Our custom <strong>Graph Neural Network (GNN)</strong> models duck migration as a dynamic, weighted graph,
            <strong> leveraging historical data, spatial proximity, and environmental conditions</strong> to forecast future movements.
            The model builds individual profiles for each duck using <strong>timestamped GPS data</strong>, constructs
            <strong> nodes for historical stopovers</strong>, adds both <strong>sequential and proximity-based edges with weighted priorities</strong>,
            and <strong>generates predictions</strong> by evaluating the <strong>most probable next location</strong> based on migration patterns and current weather data.
          </p>
        </div>

        <div className="analytics-section">
          <h3>Moveduck Analytics</h3>
          <div className="analytics-charts">
            <div className="chart">
              <img src={Figure1Img} alt="Figure 1: Frequency of Distance Errors by Bin" />
              <p className="chart-caption">Figure 1: Frequency of Distance Errors by Bin</p>
            </div>
            <div className="chart">
              <img src={Figure3Img} alt="Figure 2: Distribution of Prediction Errors" />
              <p className="chart-caption">Figure 2: Distribution of Prediction Errors (km)</p>
            </div>
          </div>

          <div className="analytics-text">
            <p><strong>90% of Predictions Within 10 km:</strong> The majority of prediction errors fall within the 0–10 km range, demonstrating the model's high precision in forecasting migration paths.</p>
            <p><strong>Low Error Despite Natural Variability:</strong> Ducks exhibit unpredictable behaviors influenced by environmental factors and instinctual shifts. Despite this, the GNN maintains over 90% accuracy, even <em>accounting for outlier behavior</em>.</p>
            <p><strong>Consistent Performance Across Binned Ranges:</strong> The binned distribution emphasizes that even among larger error categories (50+ km), the model's error frequency remains low, reflecting its <em>stability and reliability</em> across scenarios.</p>
          </div>
        </div>
      </section>

    </div>
  );
}

