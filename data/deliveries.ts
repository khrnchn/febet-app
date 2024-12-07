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

// Generate a random location within Klang Valley bounds (excluding Klang)
const generateRandomLocation = () => {
  // Klang Valley bounds (excluding Klang, covering KL, PJ, Shah Alam, Subang, etc.)
  const bounds = {
    north: 3.2614, // Rawang area
    south: 2.8850, // Putrajaya/Cyberjaya area
    east: 101.8921, // Ampang/Hulu Langat area
    west: 101.4456  // Shah Alam area
  };

  const lat = bounds.south + Math.random() * (bounds.north - bounds.south);
  const lng = bounds.west + Math.random() * (bounds.east - bounds.west);

  return { lat, lng };
};

// List of popular areas in Klang Valley (excluding Klang) for more realistic addresses
const popularAreas = [
  "Petaling Jaya",
  "Shah Alam",
  "Subang Jaya",
  "Ampang",
  "Cheras",
  "Puchong",
  "Cyberjaya",
  "Putrajaya",
  "Rawang",
  "Kajang",
  "Seri Kembangan",
  "Bangi",
  "Damansara",
  "Mont Kiara",
  "Kepong",
  "Gombak",
  "Setapak",
  "Wangsa Maju",
  "Bangsar",
  "USJ",
  "Kota Damansara",
  "Ara Damansara"
];

const generateRandomAddress = () => {
  const area = popularAreas[Math.floor(Math.random() * popularAreas.length)];
  const streetNumber = Math.floor(Math.random() * 200) + 1;
  const streetTypes = ["Jalan", "Lorong", "Persiaran", "Lebuh"];
  const streetType = streetTypes[Math.floor(Math.random() * streetTypes.length)];
  const streetName = Math.floor(Math.random() * 50) + 1;

  return `${streetNumber}, ${streetType} ${streetName}, ${area}, Selangor`;
};

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
export const orders: Delivery[] = Array.from({ length: 30 }, (_, i) => {
  const id = (i + 1).toString().padStart(3, '0');
  const location = generateRandomAddress();
  const coords = generateRandomLocation();
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