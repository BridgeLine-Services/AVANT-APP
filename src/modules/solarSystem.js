/**
 * AVANT — Solar System Data & Visuals
 * NASA Eyes data + real planet facts
 * No API key needed for basic data
 * NASA API key (free) for images
 */

import axios from 'axios';
import { NASA_API_KEY } from './config';

// Real planet data with NASA imagery
export const PLANETS = {
  sun: {
    name: 'The Sun',
    color: '#FDB813',
    glowColor: '#FF6600',
    size: 120,
    description: 'Our star — 109 Earths wide, 4.6 billion years old, surface temp 5,500°C.',
    facts: [
      'The Sun contains 99.86% of all mass in our solar system',
      'Light takes 8 minutes 20 seconds to reach Earth',
      'The Sun completes one rotation every 27 days',
      'Core temperature reaches 15 million degrees Celsius'
    ],
    nasaUrl: 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e000393/GSFC_20171208_Archive_e000393~orig.jpg',
    embeddedView: 'https://eyes.nasa.gov/apps/solar-system/#/sun'
  },
  mercury: {
    name: 'Mercury',
    color: '#B5B5B5',
    glowColor: '#888888',
    size: 20,
    orbitRadius: 80,
    orbitSpeed: 4.7,
    description: 'The smallest planet. Closest to the Sun. No atmosphere, extreme temperatures.',
    facts: [
      'A day on Mercury lasts 59 Earth days',
      'Surface temperature swings from -180°C to 430°C',
      'Mercury has no moons',
      'It is shrinking as its core cools'
    ],
    nasaUrl: 'https://images-assets.nasa.gov/image/PIA15162/PIA15162~orig.jpg',
    embeddedView: 'https://eyes.nasa.gov/apps/solar-system/#/mercury'
  },
  venus: {
    name: 'Venus',
    color: '#E8C56D',
    glowColor: '#CC9900',
    size: 30,
    orbitRadius: 130,
    orbitSpeed: 3.5,
    description: 'Hottest planet. Thick toxic atmosphere. Spins backwards.',
    facts: [
      'Venus is hotter than Mercury despite being further from the Sun',
      'A day on Venus is longer than its year',
      'Venus rotates in the opposite direction to most planets',
      'Atmospheric pressure is 90x that of Earth'
    ],
    nasaUrl: 'https://images-assets.nasa.gov/image/PIA00271/PIA00271~orig.jpg',
    embeddedView: 'https://eyes.nasa.gov/apps/solar-system/#/venus'
  },
  earth: {
    name: 'Earth',
    color: '#1E90FF',
    glowColor: '#00BFFF',
    size: 32,
    orbitRadius: 190,
    orbitSpeed: 2.9,
    description: 'Our home. The only known planet with life. 71% covered in water.',
    facts: [
      'Earth is the densest planet in the solar system',
      'The Moon stabilizes Earth\'s axial tilt',
      'Earth\'s magnetic field protects us from solar radiation',
      'One year = 365.25 days — hence leap years'
    ],
    nasaUrl: 'https://images-assets.nasa.gov/image/as17-148-22727/as17-148-22727~orig.jpg',
    embeddedView: 'https://eyes.nasa.gov/apps/solar-system/#/earth',
    hasGoogleEarth: true
  },
  mars: {
    name: 'Mars',
    color: '#C1440E',
    glowColor: '#FF4500',
    size: 25,
    orbitRadius: 260,
    orbitSpeed: 2.4,
    description: 'The Red Planet. Home to Olympus Mons — the tallest volcano in the solar system.',
    facts: [
      'Mars has the largest volcano in the solar system — Olympus Mons',
      'A Martian day is 24 hours 37 minutes',
      'Mars has two small moons: Phobos and Deimos',
      'NASA\'s Perseverance rover is currently on Mars'
    ],
    nasaUrl: 'https://images-assets.nasa.gov/image/PIA25611/PIA25611~orig.jpg',
    embeddedView: 'https://eyes.nasa.gov/apps/solar-system/#/mars'
  },
  jupiter: {
    name: 'Jupiter',
    color: '#C88B3A',
    glowColor: '#DAA520',
    size: 70,
    orbitRadius: 370,
    orbitSpeed: 1.3,
    description: 'The largest planet. The Great Red Spot is a storm bigger than Earth.',
    facts: [
      'Jupiter is so massive it could fit all other planets inside it',
      'The Great Red Spot has been raging for 350+ years',
      'Jupiter has 95 known moons',
      'Jupiter\'s magnetic field is 20,000x stronger than Earth\'s'
    ],
    nasaUrl: 'https://images-assets.nasa.gov/image/PIA02873/PIA02873~orig.jpg',
    embeddedView: 'https://eyes.nasa.gov/apps/solar-system/#/jupiter'
  },
  saturn: {
    name: 'Saturn',
    color: '#EAD08D',
    glowColor: '#F0C040',
    size: 60,
    orbitRadius: 480,
    orbitSpeed: 0.96,
    hasRings: true,
    ringColor: '#C8A84B',
    description: 'The ringed planet. Its rings are made of ice and rock. Could float on water.',
    facts: [
      'Saturn\'s rings span 282,000 km but are only 100m thick',
      'Saturn is less dense than water — it would float',
      'Saturn has 146 known moons including Titan with a thick atmosphere',
      'Winds on Saturn reach 1,800 km/h'
    ],
    nasaUrl: 'https://images-assets.nasa.gov/image/PIA17172/PIA17172~orig.jpg',
    embeddedView: 'https://eyes.nasa.gov/apps/solar-system/#/saturn'
  },
  uranus: {
    name: 'Uranus',
    color: '#7DE8E8',
    glowColor: '#40E0D0',
    size: 45,
    orbitRadius: 580,
    orbitSpeed: 0.68,
    description: 'The ice giant. Rotates on its side. Has faint rings.',
    facts: [
      'Uranus rotates on its side — axial tilt of 98 degrees',
      'Uranus has 13 known rings',
      'It is the coldest planet — temperatures drop to -224°C',
      'A day on Uranus lasts 17 hours'
    ],
    nasaUrl: 'https://images-assets.nasa.gov/image/PIA18182/PIA18182~orig.jpg',
    embeddedView: 'https://eyes.nasa.gov/apps/solar-system/#/uranus'
  },
  neptune: {
    name: 'Neptune',
    color: '#3F54BA',
    glowColor: '#4169E1',
    size: 42,
    orbitRadius: 670,
    orbitSpeed: 0.54,
    description: 'The windiest planet. Supersonic storms. Has a giant moon called Triton.',
    facts: [
      'Neptune has the strongest winds in the solar system — 2,100 km/h',
      'Neptune takes 165 Earth years to orbit the Sun',
      'Triton orbits backwards and is slowly spiraling inward',
      'Neptune was the first planet discovered by math, not observation'
    ],
    nasaUrl: 'https://images-assets.nasa.gov/image/PIA01492/PIA01492~orig.jpg',
    embeddedView: 'https://eyes.nasa.gov/apps/solar-system/#/neptune'
  },
  pluto: {
    name: 'Pluto',
    color: '#BC8E6E',
    glowColor: '#A0785A',
    size: 15,
    orbitRadius: 750,
    orbitSpeed: 0.38,
    description: 'Dwarf planet. Heart-shaped nitrogen ice plain. New Horizons flew by in 2015.',
    facts: [
      'Pluto has a heart-shaped plain called Tombaugh Regio',
      'One year on Pluto = 248 Earth years',
      'Pluto has 5 moons — largest is Charon, nearly its own size',
      'New Horizons flew within 12,500 km of Pluto in 2015'
    ],
    nasaUrl: 'https://images-assets.nasa.gov/image/PIA19952/PIA19952~orig.jpg',
    embeddedView: 'https://eyes.nasa.gov/apps/solar-system/#/pluto'
  },
  moon: {
    name: 'The Moon',
    color: '#CCCCCC',
    glowColor: '#AAAAAA',
    size: 18,
    description: 'Earth\'s natural satellite. 12 humans have walked on it.',
    facts: [
      '12 humans have walked on the Moon between 1969-1972',
      'The Moon is slowly moving away from Earth at 3.8cm/year',
      'It takes 27.3 days to orbit Earth',
      'The same side of the Moon always faces Earth'
    ],
    nasaUrl: 'https://images-assets.nasa.gov/image/as11-40-5931/as11-40-5931~orig.jpg',
    embeddedView: 'https://eyes.nasa.gov/apps/solar-system/#/moon'
  }
};

// Get NASA APOD (Astronomy Picture of the Day)
export async function getNASAImage(query) {
  try {
    const res = await axios.get(`https://images-api.nasa.gov/search`, {
      params: { q: query, media_type: 'image' },
      timeout: 10000
    });
    const items = res.data.collection?.items || [];
    if (items.length > 0) {
      const links = items[0].links || [];
      return links[0]?.href || null;
    }
  } catch (e) {
    console.log('NASA image error:', e.message);
  }
  return null;
}

// Get today's NASA APOD
export async function getAPOD() {
  try {
    const res = await axios.get(`https://api.nasa.gov/planetary/apod`, {
      params: { api_key: NASA_API_KEY },
      timeout: 10000
    });
    return {
      title: res.data.title,
      explanation: res.data.explanation,
      url: res.data.hdurl || res.data.url,
      date: res.data.date
    };
  } catch (e) {
    console.log('APOD error:', e.message);
    return null;
  }
}

// Get planet by voice input
export function getPlanetFromText(text) {
  const lower = text.toLowerCase();
  for (const [key, planet] of Object.entries(PLANETS)) {
    if (lower.includes(key) || lower.includes(planet.name.toLowerCase())) {
      return { key, ...planet };
    }
  }
  return null;
}
