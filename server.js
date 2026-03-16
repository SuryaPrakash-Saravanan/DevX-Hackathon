import express from "express";
import cors from "cors";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ ok: true, message: "DevX Smart Delivery backend running" });
});

app.get("/api/geocode", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({ error: "Missing q query parameter" });
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      q
    )}&limit=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "devx-smart-delivery"
      }
    });

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({ error: `Location not found: ${q}` });
    }

    res.json({
      name: data[0].display_name,
      lat: Number(data[0].lat),
      lon: Number(data[0].lon)
    });
  } catch (error) {
    console.error("Geocode error:", error);
    res.status(500).json({ error: "Failed to geocode location" });
  }
});

app.post("/api/routes", async (req, res) => {
  try {
    const {
      points,
      vehicleType = "van",
      load = 100,
      traffic = false
    } = req.body;

    if (!Array.isArray(points) || points.length < 2) {
      return res.status(400).json({
        error: "At least start and destination points are required"
      });
    }

    for (const point of points) {
      if (
        typeof point?.lat !== "number" ||
        typeof point?.lon !== "number" ||
        Number.isNaN(point.lat) ||
        Number.isNaN(point.lon)
      ) {
        return res.status(400).json({
          error: "Each point must contain numeric lat and lon"
        });
      }
    }

    const coordinateString = points
      .map((point) => `${point.lon},${point.lat}`)
      .join(";");

    const osrmUrl =
      `https://router.project-osrm.org/route/v1/driving/${coordinateString}` +
      `?alternatives=true&steps=true&overview=full&geometries=geojson`;

    const response = await fetch(osrmUrl);
    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      return res.status(404).json({ error: "No routes found" });
    }

    const vehicleFuelFactors = {
      bike: 0.025,
      car: 0.07,
      van: 0.12,
      truck: 0.2
    };

    const baseFuelFactor = vehicleFuelFactors[vehicleType] || 0.12;
    const trafficFactor = traffic ? 1.25 : 1;

    const formattedRoutes = data.routes.map((route, index) => {
      const distanceKm = route.distance / 1000;
      const baseDurationMin = route.duration / 60;
      const durationMin = baseDurationMin * trafficFactor;

      const loadFactor = 1 + Number(load || 0) / 1000;
      const estimatedFuel =
        distanceKm * baseFuelFactor * loadFactor * (traffic ? 1.18 : 1);

      const score = durationMin * 0.7 + estimatedFuel * 0.3;

      const steps = [];
      for (const leg of route.legs || []) {
        for (const step of leg.steps || []) {
          steps.push({
            instruction:
              step.maneuver?.instruction ||
              `${step.name ? `Continue on ${step.name}` : "Continue straight"}`,
            distanceKm: Number((step.distance / 1000).toFixed(2)),
            durationMin: Number(((step.duration / 60) * trafficFactor).toFixed(2)),
            name: step.name || "",
            maneuverType: step.maneuver?.type || "continue",
            location: step.maneuver?.location || null
          });
        }
      }

      return {
        id: index + 1,
        distanceKm: Number(distanceKm.toFixed(2)),
        durationMin: Number(durationMin.toFixed(2)),
        estimatedFuel: Number(estimatedFuel.toFixed(2)),
        score: Number(score.toFixed(2)),
        geometry: route.geometry,
        steps
      };
    });

    const bestRoute = [...formattedRoutes].sort((a, b) => a.score - b.score)[0];

    res.json({
      routes: formattedRoutes,
      bestRouteId: bestRoute.id
    });
  } catch (error) {
    console.error("Routes error:", error);
    res.status(500).json({ error: "Failed to fetch routes" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});