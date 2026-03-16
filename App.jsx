import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap
} from "react-leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

const API_BASE = "http://localhost:5000";

function createVehicleIcon(type) {
  const emojiMap = {
    bike: "🏍️",
    car: "🚗",
    van: "🚐",
    truck: "🚚"
  };

  return new L.DivIcon({
    html: `<div class="vehicle-marker ${type}">${emojiMap[type] || "🚚"}</div>`,
    className: "",
    iconSize: [42, 42],
    iconAnchor: [21, 21]
  });
}

function FitBounds({ routes, startPoint, endPoint, livePosition }) {
  const map = useMap();

  useEffect(() => {
    const bounds = [];

    if (startPoint) bounds.push([startPoint.lat, startPoint.lon]);
    if (endPoint) bounds.push([endPoint.lat, endPoint.lon]);
    if (livePosition) bounds.push(livePosition);

    routes.forEach((route) => {
      route.geometry.coordinates.forEach(([lon, lat]) => {
        bounds.push([lat, lon]);
      });
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [routes, startPoint, endPoint, livePosition, map]);

  return null;
}

function FollowMarker({ position, enabled }) {
  const map = useMap();

  useEffect(() => {
    if (enabled && position) {
      map.panTo(position, { animate: true });
    }
  }, [position, enabled, map]);

  return null;
}

function AuthScreen({ onAuthSuccess }) {
  const [mode, setMode] = useState("login");

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupVehicleId, setSignupVehicleId] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const handleSignup = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: signupName,
          email: signupEmail,
          password: signupPassword,
          vehicleId: signupVehicleId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Signup failed");
      }

      alert("Signup successful. Please login.");
      setMode("login");
    } catch (error) {
      alert(error.message);
    }
  };

  const handleLogin = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      localStorage.setItem("token", data.token);
      onAuthSuccess(data.driver);
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <img src="/dev.jpeg" alt="DevX Logo" className="login-logo" />
        <h1>DevX Smart Delivery</h1>
        <p>Driver access portal</p>

        <div className="auth-tabs">
          <button
            className={mode === "login" ? "tab-btn active-tab" : "tab-btn"}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            className={mode === "signup" ? "tab-btn active-tab" : "tab-btn"}
            onClick={() => setMode("signup")}
          >
            Signup
          </button>
        </div>

        {mode === "signup" ? (
          <>
            <input
              type="text"
              placeholder="Driver Name"
              value={signupName}
              onChange={(e) => setSignupName(e.target.value)}
            />
            <input
              type="email"
              placeholder="Email"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
            />
            <input
              type="text"
              placeholder="Vehicle ID"
              value={signupVehicleId}
              onChange={(e) => setSignupVehicleId(e.target.value)}
            />
            <button className="primary-btn" onClick={handleSignup}>
              Create Account
            </button>
          </>
        ) : (
          <>
            <input
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
            <button className="primary-btn" onClick={handleLogin}>
              Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [driver, setDriver] = useState(null);

  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [stops, setStops] = useState([""]);
  const [vehicleType, setVehicleType] = useState("van");
  const [load, setLoad] = useState(100);
  const [traffic, setTraffic] = useState(false);

  const [routes, setRoutes] = useState([]);
  const [bestRouteId, setBestRouteId] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);

  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [stopPoints, setStopPoints] = useState([]);

  const [loading, setLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");

  const [simulateNav, setSimulateNav] = useState(false);
  const [simIndex, setSimIndex] = useState(0);
  const simTimerRef = useRef(null);

  const [gpsTracking, setGpsTracking] = useState(false);
  const [gpsPosition, setGpsPosition] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const watchIdRef = useRef(null);

  const [announcementOn, setAnnouncementOn] = useState(true);
  const lastSpokenStepRef = useRef(-1);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");

    if (!savedToken) return;

    const fetchMe = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${savedToken}`
          }
        });

        const data = await response.json();

        if (response.ok) {
          setDriver(data);
        } else {
          localStorage.removeItem("token");
        }
      } catch {
        localStorage.removeItem("token");
      }
    };

    fetchMe();
  }, []);

  const vehicleIcon = useMemo(() => createVehicleIcon(vehicleType), [vehicleType]);

  const selectedRoute = useMemo(() => {
    return routes.find((route) => route.id === selectedRouteId) || null;
  }, [routes, selectedRouteId]);

  const selectedLatLngs = useMemo(() => {
    if (!selectedRoute) return [];
    return selectedRoute.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  }, [selectedRoute]);

  const simulationPosition =
    selectedLatLngs.length > 0 ? selectedLatLngs[simIndex] : null;

  const activeMarkerPosition = gpsTracking && gpsPosition ? gpsPosition : simulationPosition;

  const totalStopsCount = useMemo(() => {
    return stops.filter((stop) => stop.trim()).length;
  }, [stops]);

  const currentStepIndex = useMemo(() => {
    if (!selectedRoute?.steps?.length || !activeMarkerPosition) return -1;

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    selectedRoute.steps.forEach((step, index) => {
      if (!step.location) return;

      const [stepLon, stepLat] = step.location;
      const d =
        Math.pow(stepLat - activeMarkerPosition[0], 2) +
        Math.pow(stepLon - activeMarkerPosition[1], 2);

      if (d < nearestDistance) {
        nearestDistance = d;
        nearestIndex = index;
      }
    });

    return nearestIndex;
  }, [selectedRoute, activeMarkerPosition]);

  const currentInstruction =
    currentStepIndex >= 0 && selectedRoute?.steps?.[currentStepIndex]
      ? selectedRoute.steps[currentStepIndex].instruction
      : "Ready for navigation";

  const speakText = (text) => {
    if (!announcementOn || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!simulateNav || gpsTracking || selectedLatLngs.length === 0) return;

    if (simIndex >= selectedLatLngs.length - 1) {
      setSimulateNav(false);
      speakText("Simulation complete. Destination reached.");
      return;
    }

    simTimerRef.current = setTimeout(() => {
      setSimIndex((prev) => prev + 1);
    }, 130);

    return () => clearTimeout(simTimerRef.current);
  }, [simulateNav, simIndex, selectedLatLngs, gpsTracking]);

  useEffect(() => {
    if (currentStepIndex < 0) return;
    if (lastSpokenStepRef.current === currentStepIndex) return;

    speakText(selectedRoute?.steps?.[currentStepIndex]?.instruction || "");
    lastSpokenStepRef.current = currentStepIndex;
  }, [currentStepIndex, selectedRoute]);

  useEffect(() => {
    return () => {
      clearTimeout(simTimerRef.current);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const geocodePlace = async (place) => {
    const response = await fetch(
      `${API_BASE}/api/geocode?q=${encodeURIComponent(place)}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to geocode place");
    }

    return data;
  };

  const reverseGeocode = async (lat, lon) => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
    );

    if (!response.ok) {
      throw new Error("Could not resolve current address");
    }

    const data = await response.json();

    return {
      name: data.display_name || "Current Location",
      lat,
      lon
    };
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported in this browser");
      return;
    }

    setLocationStatus("Detecting your current location...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude, accuracy } = position.coords;
          const resolved = await reverseGeocode(latitude, longitude);

          setStartInput(resolved.name);
          setStartPoint(resolved);
          setLocationStatus(
            accuracy > 1000
              ? `Location found, but accuracy is low (~${Math.round(accuracy)}m)`
              : "Current location detected successfully"
          );
        } catch {
          setStartPoint({
            name: "Current Location",
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
          setStartInput("Current Location");
          setLocationStatus("Coordinates detected");
        }
      },
      () => {
        setLocationStatus("Could not access current location");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  const handleAddStop = () => {
    setStops((prev) => [...prev, ""]);
  };

  const handleStopChange = (index, value) => {
    setStops((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleRemoveStop = (index) => {
    setStops((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFindRoutes = async () => {
    try {
      setLoading(true);
      clearTimeout(simTimerRef.current);
      setSimulateNav(false);
      setSimIndex(0);
      setRoutes([]);
      setSelectedRouteId(null);
      setBestRouteId(null);
      lastSpokenStepRef.current = -1;

      let resolvedStart = startPoint;
      if (!resolvedStart) {
        resolvedStart = await geocodePlace(startInput);
      }

      const filledStops = stops.map((s) => s.trim()).filter(Boolean);
      const resolvedStops = [];
      for (const stop of filledStops) {
        const point = await geocodePlace(stop);
        resolvedStops.push(point);
      }

      const resolvedEnd = await geocodePlace(endInput);

      setStartPoint(resolvedStart);
      setStopPoints(resolvedStops);
      setEndPoint(resolvedEnd);

      const allPoints = [resolvedStart, ...resolvedStops, resolvedEnd];

      const response = await fetch(`${API_BASE}/api/routes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          points: allPoints.map((point) => ({
            lat: point.lat,
            lon: point.lon
          })),
          vehicleType,
          load: Number(load),
          traffic
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch routes");
      }

      setRoutes(data.routes);
      setBestRouteId(data.bestRouteId);
      setSelectedRouteId(data.bestRouteId);
      setSimIndex(0);
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRoute = (routeId) => {
    clearTimeout(simTimerRef.current);
    setSimulateNav(false);
    setSimIndex(0);
    setSelectedRouteId(routeId);
    lastSpokenStepRef.current = -1;
  };

  const handleStartSimulation = () => {
    if (!selectedRoute) {
      alert("Find routes first");
      return;
    }

    clearTimeout(simTimerRef.current);
    setGpsTracking(false);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setSimIndex(0);
    setSimulateNav(true);
    lastSpokenStepRef.current = -1;
    speakText("Simulation started");
  };

  const handlePauseSimulation = () => {
    clearTimeout(simTimerRef.current);
    setSimulateNav(false);
    speakText("Simulation paused");
  };

  const handleResetSimulation = () => {
    clearTimeout(simTimerRef.current);
    setSimulateNav(false);
    setSimIndex(0);
    lastSpokenStepRef.current = -1;
  };

  const handleStartGpsTracking = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported in this browser");
      return;
    }

    if (!selectedRoute) {
      alert("Find routes first");
      return;
    }

    clearTimeout(simTimerRef.current);
    setSimulateNav(false);
    setGpsTracking(true);
    speakText("Live GPS tracking started");

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setGpsPosition([lat, lon]);
        setGpsAccuracy(position.coords.accuracy);
      },
      () => {
        alert("GPS tracking failed or permission denied");
        setGpsTracking(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
  };

  const handleStopGpsTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsTracking(false);
    speakText("Live GPS tracking stopped");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setDriver(null);
  };

  if (!driver) {
    return <AuthScreen onAuthSuccess={setDriver} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <img src="/dev.jpeg" alt="DevX Logo" className="logo-img" />
          <div>
            <h1>DevX Smart Delivery</h1>
            <p>AI logistics optimization platform</p>
          </div>
        </div>

        <div className="driver-box">
          <div><strong>Driver:</strong> {driver.name}</div>
          <div><strong>Email:</strong> {driver.email}</div>
          <div><strong>Vehicle ID:</strong> {driver.vehicleId}</div>
          <button className="secondary-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div className="panel">
          <div className="section-title">Route Planner</div>

          <label>Starting Point</label>
          <input
            type="text"
            placeholder="Enter source location"
            value={startInput}
            onChange={(e) => {
              setStartInput(e.target.value);
              setStartPoint(null);
            }}
          />

          <button className="secondary-btn" onClick={handleUseMyLocation}>
            Use My Current Location
          </button>

          {locationStatus && <p className="info-text">{locationStatus}</p>}

          <label>Delivery Stops</label>
          {stops.map((stop, index) => (
            <div className="stop-row" key={index}>
              <input
                type="text"
                placeholder={`Stop ${index + 1}`}
                value={stop}
                onChange={(e) => handleStopChange(index, e.target.value)}
              />
              {stops.length > 1 && (
                <button
                  className="remove-stop-btn"
                  onClick={() => handleRemoveStop(index)}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <button className="secondary-btn" onClick={handleAddStop}>
            Add Stop
          </button>

          <label>Destination</label>
          <input
            type="text"
            placeholder="Enter destination"
            value={endInput}
            onChange={(e) => setEndInput(e.target.value)}
          />

          <label>Vehicle Type</label>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
          >
            <option value="bike">Bike</option>
            <option value="car">Car</option>
            <option value="van">Van</option>
            <option value="truck">Truck</option>
          </select>

          <label>Vehicle Load (kg)</label>
          <input
            type="number"
            min="0"
            value={load}
            onChange={(e) => setLoad(e.target.value)}
          />

          <button
            className="secondary-btn"
            onClick={() => setTraffic((prev) => !prev)}
          >
            Traffic Simulation: {traffic ? "ON" : "OFF"}
          </button>

          <button className="primary-btn" onClick={handleFindRoutes} disabled={loading}>
            {loading ? "Finding Routes..." : "Find Routes"}
          </button>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Suggested Routes</h3>
            <span>{routes.length}</span>
          </div>

          {routes.length === 0 ? (
            <p className="muted">Enter your route details and search.</p>
          ) : (
            routes.map((route) => (
              <div
                key={route.id}
                className={`route-card ${
                  route.id === bestRouteId ? "best" : ""
                } ${route.id === selectedRouteId ? "selected" : ""}`}
                onClick={() => handleSelectRoute(route.id)}
              >
                <div className="route-top">
                  <strong>Route {route.id}</strong>
                  {route.id === bestRouteId && <span className="best-tag">Best</span>}
                </div>
                <div className="route-stats">
                  <span>⏱ {route.durationMin} min</span>
                  <span>📍 {route.distanceKm} km</span>
                  <span>⛽ {route.estimatedFuel} L</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Navigation Controls</h3>
          </div>

          <div className="nav-grid">
            <button className="control-btn" onClick={handleStartSimulation}>
              Sim Start
            </button>
            <button className="control-btn" onClick={handlePauseSimulation}>
              Sim Pause
            </button>
            <button className="control-btn" onClick={handleResetSimulation}>
              Sim Reset
            </button>
            <button className="control-btn" onClick={handleStartGpsTracking}>
              GPS Start
            </button>
          </div>

          <div className="nav-grid single-gap">
            <button className="secondary-btn" onClick={handleStopGpsTracking}>
              GPS Stop
            </button>
            <button
              className="secondary-btn"
              onClick={() => setAnnouncementOn((prev) => !prev)}
            >
              Voice: {announcementOn ? "ON" : "OFF"}
            </button>
          </div>

          <p className="muted status-line">
            {gpsTracking
              ? `Live GPS tracking active${gpsAccuracy ? ` • accuracy ~${Math.round(gpsAccuracy)}m` : ""}`
              : simulateNav
              ? "Simulation running..."
              : "Navigation stopped."}
          </p>

          <p className="info-text">{currentInstruction}</p>
        </div>

        <div className="panel directions-panel">
          <div className="panel-header">
            <h3>Directions</h3>
          </div>

          {selectedRoute?.steps?.length ? (
            <div className="directions-list">
              {selectedRoute.steps.map((step, index) => (
                <div
                  key={`${step.instruction}-${index}`}
                  className={`direction-item ${
                    index === currentStepIndex ? "active-step" : ""
                  }`}
                >
                  <div className="step-dot" />
                  <div>
                    <strong>Step {index + 1}</strong>
                    <p>{step.instruction}</p>
                    <small>
                      {step.distanceKm} km • {step.durationMin} min
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Directions will appear after route search.</p>
          )}
        </div>

        <footer className="footer-note">
          <p>Developed by <strong>DevX Team</strong></p>
          <p>© 2026 DevX. All rights reserved.</p>
        </footer>
      </aside>

      <main className="map-section">
        <div className="dashboard">
          <div className="card">
            <h3>Total Distance</h3>
            <p>{selectedRoute ? selectedRoute.distanceKm : 0} km</p>
          </div>
          <div className="card">
            <h3>Estimated Time</h3>
            <p>{selectedRoute ? selectedRoute.durationMin : 0} min</p>
          </div>
          <div className="card">
            <h3>Fuel Usage</h3>
            <p>{selectedRoute ? selectedRoute.estimatedFuel : 0} L</p>
          </div>
          <div className="card">
            <h3>Total Stops</h3>
            <p>{totalStopsCount}</p>
          </div>
        </div>

        <div className="map-header">
          <div>
            <h2>DevX Route Visualizer</h2>
            <p>Optimized for time, fuel savings, traffic, and multi-stop delivery</p>
          </div>
        </div>

        <MapContainer center={[13.0827, 80.2707]} zoom={10} className="map">
          <TileLayer
            attribution="&copy; OpenStreetMap contributors | Designed by DevX Team"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds
            routes={routes}
            startPoint={startPoint}
            endPoint={endPoint}
            livePosition={activeMarkerPosition}
          />

          <FollowMarker position={activeMarkerPosition} enabled={gpsTracking || simulateNav} />

          {routes.map((route) => {
            const positions = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
            const isBest = route.id === bestRouteId;
            const isSelected = route.id === selectedRouteId;

            return (
              <Polyline
                key={route.id}
                positions={positions}
                pathOptions={{
                  color: isBest ? "#12d18e" : isSelected ? "#7c5cff" : "#64748b",
                  weight: isBest ? 7 : isSelected ? 6 : 4,
                  opacity: isBest || isSelected ? 0.95 : 0.35
                }}
              />
            );
          })}

          {startPoint && (
            <Marker position={[startPoint.lat, startPoint.lon]}>
              <Popup>Start: {startPoint.name}</Popup>
            </Marker>
          )}

          {stopPoints.map((stop, index) => (
            <Marker key={`${stop.name}-${index}`} position={[stop.lat, stop.lon]}>
              <Popup>Stop {index + 1}: {stop.name}</Popup>
            </Marker>
          ))}

          {endPoint && (
            <Marker position={[endPoint.lat, endPoint.lon]}>
              <Popup>Destination: {endPoint.name}</Popup>
            </Marker>
          )}

          {activeMarkerPosition && (
            <Marker position={activeMarkerPosition} icon={vehicleIcon}>
              <Popup>
                <div>
                  <strong>{gpsTracking ? "Live GPS Vehicle" : "Simulated Vehicle"}</strong>
                  <br />
                  {currentInstruction}
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </main>
    </div>
  );
}