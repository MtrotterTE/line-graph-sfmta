// Helper function to calculate distance between two geographic points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3 // Earth's radius in meters
    const toRadians = (deg) => (deg * Math.PI) / 180

    const φ1 = toRadians(lat1)
    const φ2 = toRadians(lat2)
    const Δφ = toRadians(lat2 - lat1)
    const Δλ = toRadians(lon2 - lon1)

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // Distance in meters
}

// Helper function to calculate time elapsed in seconds
function calculateTimeElapsed(timestamp1, timestamp2) {
    return (new Date(timestamp2) - new Date(timestamp1)) / 1000 // Time in seconds
}

// Helper function to check if two points are within 200 feet of each other
function arePointsWithin350Feet(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const toRadians = (deg) => (deg * Math.PI) / 180;

    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const Δφ = toRadians(lat2 - lat1);
    const Δλ = toRadians(lon2 - lon1);

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distanceInMeters = R * c; // Distance in meters
    const distanceInFeet = distanceInMeters * 3.28084; // Convert meters to feet

    return distanceInFeet <= 350; // Check if within 200 feet
}

// Safely convert JSON object to array
function safeToArray(json) {
    if (Array.isArray(json)) return json
    if (json && typeof json === 'object') {
        return Object.values(json).filter(v => typeof v === 'object' && v !== json)
    }
    return []
}

function toRadians(deg) {
    return deg * Math.PI / 180;
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000; // meters
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Find nearest vertex index on polyline
function findNearestIndex(path, point) {
    let minDist = Infinity;
    let idx = 0;
    path.forEach((p, i) => {
      const d = haversine(p.lat, p.lon, point.lat, point.lon);
      if (d < minDist) {
        minDist = d;
        idx = i;
      }
    });
    return idx;
  }

export { calculateDistance, calculateTimeElapsed, arePointsWithin350Feet, safeToArray, findNearestIndex }