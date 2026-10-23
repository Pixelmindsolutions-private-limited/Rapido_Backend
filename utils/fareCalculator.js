// utils/fareCalculator.js
import axios from 'axios';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * Get real road distance using Google Maps Routes API
 * Falls back to Haversine if API fails
 */
export const getRouteDistance = async (origin, destination) => {
  // ✅ Validate input
  if (!origin || !destination || 
      !origin.latitude || !origin.longitude || 
      !destination.latitude || !destination.longitude) {
    throw new Error('Invalid origin or destination coordinates');
  }

  // ✅ Check API key
  if (!GOOGLE_MAPS_API_KEY ) {
    console.warn('⚠️ Google Maps API key not configured, using Haversine fallback');
    return getHaversineFallback(origin, destination);
  }

  try {
    const response = await axios.post(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        origin: {
          location: {
            latLng: {
              latitude: parseFloat(origin.latitude),
              longitude: parseFloat(origin.longitude)
            }
          }
        },
        destination: {
          location: {
            latLng: {
              latitude: parseFloat(destination.latitude),
              longitude: parseFloat(destination.longitude)
            }
          }
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: false,
        languageCode: 'en-US',
        units: 'METRIC'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline'
        },
        timeout: 5000
      }
    );

    if (!response.data.routes || response.data.routes.length === 0) {
      throw new Error('No routes found');
    }

    const route = response.data.routes[0];
    const distanceMeters = route.distanceMeters;
    const durationSeconds = parseInt(route.duration.replace('s', ''));

    return {
      distanceMeters,
      distanceKm: parseFloat((distanceMeters / 1000).toFixed(1)),
      durationSeconds,
      durationMinutes: Math.ceil(durationSeconds / 60),
      polyline: route.polyline?.encodedPolyline || null,
      source: 'google'
    };
  } catch (error) {
    console.error('❌ Google Maps API error:', error.response?.data || error.message);
    return getHaversineFallback(origin, destination);
  }
};

// ✅ Haversine fallback (extracted for reuse)
const getHaversineFallback = (origin, destination) => {
  const distance = calculateDistance(
    parseFloat(origin.latitude), parseFloat(origin.longitude),
    parseFloat(destination.latitude), parseFloat(destination.longitude)
  );

  return {
    distanceKm: parseFloat(distance.toFixed(1)),
    distanceMeters: Math.round(distance * 1000),
    durationMinutes: Math.ceil((distance / 20) * 60),
    polyline: null,
    source: 'haversine'
  };
};

// Calculate distance between two coordinates using Haversine formula
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};


export const calculateFare = (distance, vehicleType = 'bike', ladyCaptain = false) => {
  // Base rates
  const BASE_FARE = 50;
  const PER_KM_RATE = 15;
  const PER_MINUTE_RATE = 2;
  
  // ✅ Expanded vehicle type bonus
  const vehicleBonus = {
    bike: 0,
    auto: 20,
    car: 50,
    car_premium: 100,
    parcel: 10
  };
  
  // Lady Captain extra charge
  const LADY_CAPTAIN_EXTRA = 10;
  
  // Estimate time (assume average speed of 20 km/h)
  const estimatedTime = (distance / 20) * 60;
  
  // Calculate fare
  let fare = BASE_FARE;
  fare += distance * PER_KM_RATE;
  fare += estimatedTime * PER_MINUTE_RATE;
  fare += vehicleBonus[vehicleType] || 0;
  
  if (ladyCaptain) {
    fare += LADY_CAPTAIN_EXTRA;
  }
  
  return Math.round(fare);
};

// Format fare display
export const formatFare = (fare) => `₹${fare}`;

// Get vehicle type display name
export const getVehicleDisplayName = (vehicleType) => {
  const names = {
    bike: 'Bike',
    auto: 'Auto Rickshaw',
    car: 'Car'
  };
  return names[vehicleType] || vehicleType;
};