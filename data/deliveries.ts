export interface Delivery {
  id: string;
  orderNumber: string;
  source: string;
  destination: string;
  coordinates: { lat: number; lng: number };
  deliveryStart: string;
  deliveryEnd: string;
  customerName: string;
  customerContact: string;
  productId: string;
}

// Generate random coordinates within KL area
const generateLocation = () => {
  // KL area bounds
  const KL_BOUNDS = {
    lat: { min: 3.0800, max: 3.1800 },
    lng: { min: 101.6500, max: 101.7500 }
  };
  
  return {
    lat: KL_BOUNDS.lat.min + Math.random() * (KL_BOUNDS.lat.max - KL_BOUNDS.lat.min),
    lng: KL_BOUNDS.lng.min + Math.random() * (KL_BOUNDS.lng.max - KL_BOUNDS.lng.min)
  };
};

// Common locations in KL
const locations = [
  "Pavilion Kuala Lumpur",
  "Suria KLCC",
  "Mid Valley Megamall",
  "The Gardens Mall",
  "Berjaya Times Square",
  "Nu Sentral",
  "Lot 10",
  "Starhill Gallery",
  "Publika Shopping Gallery",
  "The Intermark Mall",
  "Avenue K",
  "Quill City Mall",
  "Central Market",
  "Ampang Park",
  "Great Eastern Mall",
  "Bangsar Shopping Centre",
  "Bangsar Village",
  "The Sphere",
  "Sunway Velocity Mall",
  "MyTown Shopping Centre"
];

// Product types
const products = [
  "BT-ROSE",
  "BT-LILY",
  "BT-TULIP",
  "BT-ORCHID",
  "BT-SUNFLOWER",
  "BT-DAISY",
  "BT-PEONY",
  "BT-CARNATION"
];

// Generate orders
export const orders: Delivery[] = Array.from({ length: 100 }, (_, i) => {
  const id = (i + 1).toString().padStart(3, '0');
  const location = locations[Math.floor(Math.random() * locations.length)];
  const coords = generateLocation();
  const productType = products[Math.floor(Math.random() * products.length)];
  const productId = `${productType}-${Math.floor(Math.random() * 10 + 1).toString().padStart(2, '0')}`;
  
  // Generate a random time between 12:00 and 16:00
  const deliveryDate = new Date('2024-01-15');
  deliveryDate.setDate(deliveryDate.getDate() + Math.floor(i / 5)); // Spread orders across days
  const deliveryStart = new Date(deliveryDate);
  deliveryStart.setHours(12, 0, 0);
  const deliveryEnd = new Date(deliveryDate);
  deliveryEnd.setHours(16, 0, 0);

  return {
    id,
    orderNumber: `BT-2401-${id}`,
    source: "BloomThis HQ",
    destination: location,
    coordinates: coords,
    deliveryStart: deliveryStart.toISOString(),
    deliveryEnd: deliveryEnd.toISOString(),
    customerName: `Customer ${id}`,
    customerContact: `+60 12-345-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
    productId
  };
});