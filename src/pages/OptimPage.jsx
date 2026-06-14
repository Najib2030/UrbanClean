import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

function getDistanceFromLatLon(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateRouteDistance(start, points) {
  if (points.length === 0) return 0;
  let total = 0;
  let prev = start;
  for (const point of points) {
    total += getDistanceFromLatLon(prev.lat, prev.lng, point.lat, point.lng);
    prev = point;
  }
  return total;
}

function estimateSavings(optimizedPoints, start, numRandomSamples = 10) {
  if (optimizedPoints.length === 0) return { fuelSave: 0, timeSave: 0 };
  
  const optimizedDist = calculateRouteDistance(start, optimizedPoints);
  
  let randomDistSum = 0;
  for (let i = 0; i < numRandomSamples; i++) {
    const shuffled = [...optimizedPoints];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    randomDistSum += calculateRouteDistance(start, shuffled);
  }
  const avgRandomDist = randomDistSum / numRandomSamples;
  
  const fuelSave = avgRandomDist > 0 ? ((avgRandomDist - optimizedDist) / avgRandomDist) * 100 : 0;
  const timeSavedHours = avgRandomDist > 0 ? (avgRandomDist - optimizedDist) / 30 : 0;
  const timeSavedMinutes = timeSavedHours * 60;
  
  return {
    fuelSave: Math.round(fuelSave),
    timeSave: Math.round(timeSavedMinutes)
  };
}

function getZoneKey(lat, lng) {
  if (lat > 30.5) return "north";
  if (lat < 30.4) return "south";
  if (lng < -8.9) return "west";
  return "east";
}

export default function OptimPage() {
  const { t } = useTranslation();
  const { userRole, currentUser } = useAuth();
  const [reports, setReports] = useState([]);
  const [optimizedOrder, setOptimizedOrder] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savings, setSavings] = useState({ fuelSave: 0, timeSave: 0 });

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        let q;
        if (userRole === "agent") {
          q = query(collection(db, "reports"), where("assignedTo", "==", currentUser.uid), where("status", "in", ["En attente", "En cours"]));
        } else if (userRole === "gestionnaire") {
          q = query(collection(db, "reports"), where("status", "in", ["En attente", "En cours"]));
        } else {
          setReports([]);
          setLoading(false);
          return;
        }
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const withLocation = list.filter(r => r.location && r.location.latitude && r.location.longitude);
        setReports(withLocation);
      } catch (error) {
        console.error("Error fetching reports:", error);
      }
      setLoading(false);
    };
    fetchReports();
  }, [userRole, currentUser]);

  const runOptimization = () => {
    if (reports.length === 0) {
      toast.error(t("no_reports_optimization"));
      setOptimizedOrder([]);
      setSavings({ fuelSave: 0, timeSave: 0 });
      return;
    }

    const start = { lat: 30.4727, lng: -8.8746 };
    
    const pointsWithDist = reports.map(r => ({
      ...r,
      lat: r.location.latitude,
      lng: r.location.longitude,
      dist: getDistanceFromLatLon(start.lat, start.lng, r.location.latitude, r.location.longitude)
    }));
    
    const sorted = [...pointsWithDist].sort((a, b) => a.dist - b.dist);
    
    setOptimizedOrder(sorted);
    
    const { fuelSave, timeSave } = estimateSavings(sorted, start);
    setSavings({ fuelSave, timeSave });
  };

  const copyOrderToClipboard = () => {
    if (optimizedOrder.length === 0) {
      toast.error(t("no_order_to_copy"));
      return;
    }
    const orderText = optimizedOrder.map((rep, idx) => 
      `${idx+1}. ${rep.type} - ${rep.address} (${rep.dist.toFixed(2)} km)`
    ).join("\n");
    navigator.clipboard.writeText(orderText);
    toast.success(t("order_copied"));
  };

  const getZoneDistribution = () => {
    const zones = { north: 0, south: 0, east: 0, west: 0 };
    optimizedOrder.forEach(rep => {
      const zoneKey = getZoneKey(rep.lat, rep.lng);
      zones[zoneKey]++;
    });
    return zones;
  };

  // Helper to get translated zone name
  const getTranslatedZone = (zoneKey) => {
    switch(zoneKey) {
      case "north": return t("zone_north");
      case "south": return t("zone_south");
      case "east": return t("zone_east");
      case "west": return t("zone_west");
      default: return zoneKey;
    }
  };

  if (userRole === "agent") {
    return (
      <div>
        <div className="card" style={{ borderLeft: "5px solid #2b7a4b" }}>
          <h3><i className="fas fa-microchip"></i> {t("optimization_title")}</h3>
          <button onClick={runOptimization} className="btn-primary" disabled={loading || reports.length === 0}>
            {loading ? t("loading") : t("generate_optimal_order")}
          </button>
          
          {optimizedOrder.length > 0 && (
            <div style={{ marginTop: "24px" }}>
              <h4>{t("recommended_route")}</h4>
              <ol style={{ marginLeft: "20px" }}>
                {optimizedOrder.map((rep, idx) => (
                  <li key={rep.id} style={{ marginBottom: "8px" }}>
                    <strong>{rep.type}</strong> – {rep.address}<br />
                    <small>{t("distance_from_center")} {rep.dist.toFixed(2)} km</small>
                  </li>
                ))}
              </ol>
              <p style={{ marginTop: "12px", fontStyle: "italic", color: "var(--text-secondary)" }}>
                🧮 {t("optimization_based_on_center")} {optimizedOrder.length} {t("reports_to_treat_short")}
              </p>
            </div>
          )}
          
          {reports.length === 0 && !loading && (
            <p>{t("no_reports_optimization")}</p>
          )}
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-title">{t("estimated_fuel_saving")}</div>
            <div className="stat-value">{savings.fuelSave}%</div>
            <div className="stat-trend">{t("vs_random_order")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">{t("reduced_intervention_time")}</div>
            <div className="stat-value">-{savings.timeSave} {t("minutes_per_day")}</div>
            <div className="stat-trend">{t("based_on_saved_distance")}</div>
          </div>
        </div>
      </div>
    );
  }

  if (userRole === "gestionnaire") {
    const totalPending = reports.length;
    const totalOptimizedDist = optimizedOrder.length > 0 
      ? calculateRouteDistance({ lat: 30.4727, lng: -8.8746 }, optimizedOrder.map(r => ({ lat: r.lat, lng: r.lng })))
      : 0;
    const estimatedFuelCost = (totalOptimizedDist * 1.25 * 2).toFixed(2);
    const zoneDist = getZoneDistribution();
    
    // Find zone with most reports
    const mostReportsZoneKey = Object.entries(zoneDist).sort((a,b) => b[1]-a[1])[0]?.[0];
    const mostReportsZoneName = getTranslatedZone(mostReportsZoneKey);
    
    return (
      <div>
        <div className="card" style={{ borderLeft: "5px solid #2b7a4b" }}>
          <h3><i className="fas fa-chart-line"></i> {t("global_optimization")}</h3>
          <button onClick={runOptimization} className="btn-primary" disabled={loading || reports.length === 0}>
            {loading ? t("loading") : t("launch_optimization")}
          </button>
          
          {optimizedOrder.length > 0 && (
            <>
              <div style={{ marginTop: "24px" }}>
                <h4>{t("suggested_order_for_teams")}</h4>
                <ol style={{ marginLeft: "20px" }}>
                  {optimizedOrder.map((rep, idx) => (
                    <li key={rep.id} style={{ marginBottom: "8px" }}>
                      <strong>{rep.type}</strong> – {rep.address}<br />
                      <small>{t("distance_from_center")} {rep.dist.toFixed(2)} km | {t("status")} : {rep.status}</small>
                    </li>
                  ))}
                </ol>
                <div style={{ marginTop: "16px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <button onClick={copyOrderToClipboard} className="btn-secondary">
                    <i className="fas fa-copy"></i> {t("copy_order")}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {optimizedOrder.length > 0 && (
          <div className="card">
            <h4><i className="fas fa-chart-pie"></i> {t("zone_distribution")}</h4>
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginTop: "8px" }}>
              {Object.entries(zoneDist).map(([zoneKey, count]) => (
                <div key={zoneKey} style={{ textAlign: "center", minWidth: "60px" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--text-primary)" }}>{count}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{getTranslatedZone(zoneKey)}</div>
                </div>
              ))}
            </div>
            <p style={{ marginTop: "12px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              📊 <span dangerouslySetInnerHTML={{ __html: t("most_reports_zone", { zone: mostReportsZoneName }) }} />
            </p>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-title">{t("estimated_fuel_saving")}</div>
            <div className="stat-value">{savings.fuelSave}%</div>
            <div className="stat-trend">{t("vs_random_order")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">{t("reduced_intervention_time")}</div>
            <div className="stat-value">-{savings.timeSave} {t("minutes_per_day")}</div>
            <div className="stat-trend">{t("based_on_saved_distance")}</div>
          </div>
        </div>

        <div className="card">
          <h4><i className="fas fa-lightbulb"></i> {t("strategic_recommendations")}</h4>
          <ul style={{ marginTop: "8px", marginLeft: "20px" }}>
            {optimizedOrder.length > 0 && ( 
              <li dangerouslySetInnerHTML={{ __html: t("estimated_fuel_cost", { cost: estimatedFuelCost }) }} />
            )}
            <li>{t("assign_nearest_first")}</li>
            <li dangerouslySetInnerHTML={{ __html: t("use_tours_page") }} />
            <li>{t("group_same_zone")}</li>
          </ul>
        </div>
      </div>
    );
  }

  return <div>{t("unauthorized")}</div>;
}