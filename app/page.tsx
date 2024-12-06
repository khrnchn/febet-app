"use client";

import type { Library } from "@react-google-maps/api";
import { DirectionsRenderer, GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { Bus, Car, Package, Truck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/custom/header";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const center = {
  lat: 3.1319,
  lng: 101.6841
};

const libraries: Library[] = ["places"];

export default function Home() {
  const [selectedVehicle, setSelectedVehicle] = useState("car");
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [stops, setStops] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const originRef = useRef<HTMLInputElement>(null);
  const destinationRef = useRef<HTMLInputElement>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: 'AIzaSyB9ZJBHD09W3Wj4uu6dIcA4ShvQWa0qu4E',
    libraries
  });

  useEffect(() => {
    if (isLoaded && originRef.current && destinationRef.current) {
      const originAutocomplete = new google.maps.places.Autocomplete(originRef.current, {
        fields: ["formatted_address", "geometry"],
        types: ["geocode", "establishment"]
      });

      const destinationAutocomplete = new google.maps.places.Autocomplete(destinationRef.current, {
        fields: ["formatted_address", "geometry"],
        types: ["geocode", "establishment"]
      });

      originAutocomplete.addListener("place_changed", () => {
        const place = originAutocomplete.getPlace();
        if (place.formatted_address) {
          setOrigin(place.formatted_address);
        }
      });

      destinationAutocomplete.addListener("place_changed", () => {
        const place = destinationAutocomplete.getPlace();
        if (place.formatted_address) {
          setDestination(place.formatted_address);
        }
      });
    }
  }, [isLoaded]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const calculateRoute = async () => {
    if (!window.google || !map) return;
    setIsLoading(true);

    const directionsService = new google.maps.DirectionsService();

    try {
      const waypoints = stops.map(stop => ({
        location: stop,
        stopover: true
      }));

      const result = await directionsService.route({
        origin,
        destination,
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true,
      });

      setDirections(result);

      // Fit the map bounds to show the entire route
      if (result.routes[0]?.bounds) {
        map.fitBounds(result.routes[0].bounds);
      }

      // Calculate total distance and duration
      const route = result.routes[0];
      if (route?.legs) {
        const totalDistance = route.legs.reduce((acc, leg) => acc + (leg.distance?.value || 0), 0);
        const totalDuration = route.legs.reduce((acc, leg) => acc + (leg.duration?.value || 0), 0);
        console.log(`Total Distance: ${totalDistance / 1000} km`);
        console.log(`Total Duration: ${Math.round(totalDuration / 60)} minutes`);
      }
    } catch (error) {
      console.error("Error calculating route:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addStop = () => {
    if (stops.length < 18) { // Max 20 stops including origin and destination
      setStops([...stops, ""]);
    }
  };

  const updateStop = (index: number, value: string) => {
    const newStops = [...stops];
    newStops[index] = value;
    setStops(newStops);
  };

  const removeStop = (index: number) => {
    const newStops = stops.filter((_, i) => i !== index);
    setStops(newStops);
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex flex-1">
        {/* Left Panel */}
        <div className="w-[400px] border-r p-4 flex flex-col">
          {/* Route Section */}
          <div className="mb-6">
            <h2 className="text-sm text-gray-500 mb-2">ROUTE (MAX. 20 STOPS)</h2>
            <div className="space-y-4">
              {/* Origin */}
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground">1</div>
                <div className="flex-1">
                  <input
                    type="text"
                    ref={originRef}
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="Enter pickup location"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Intermediate Stops */}
              {stops.map((stop, index) => (
                <div key={index} className="flex gap-3">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground">
                    {index + 2}
                  </div>
                  <div className="flex-1">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={stop}
                        onChange={(e) => updateStop(index, e.target.value)}
                        className="flex-1 p-2 border rounded"
                        placeholder="Enter stop address"
                      />
                      <button
                        onClick={() => removeStop(index)}
                        className="px-2 text-gray-500 hover:text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Destination */}
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground">
                  {stops.length + 2}
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    ref={destinationRef}
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Enter drop-off location"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-4">
              <button
                onClick={addStop}
                disabled={stops.length >= 18}
                className="text-primary flex items-center gap-2 disabled:opacity-50"
              >
                <span>+</span> Add Stop
              </button>
              <button
                onClick={calculateRoute}
                disabled={isLoading}
                className="px-4 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
              >
                {isLoading ? "Calculating..." : "Calculate Route"}
              </button>
            </div>
          </div>

          {/* Vehicle Type Section */}
          <div className="mb-6">
            <h2 className="text-sm text-gray-500 mb-2">VEHICLE TYPE</h2>
            <RadioGroup
              defaultValue="car"
              value={selectedVehicle}
              onValueChange={setSelectedVehicle}
              className="grid grid-cols-4 gap-2"
            >
              <div>
                <RadioGroupItem
                  value="car"
                  id="car"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="car"
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer",
                  )}
                >
                  <Car className="mb-2 h-6 w-6" />
                  <p className="text-sm font-medium">Car</p>
                  <p className="text-xs text-muted-foreground">0.5 x 0.5 x 0.5 Meter</p>
                  <p className="text-xs text-muted-foreground">40 kg</p>
                </Label>
              </div>

              <div>
                <RadioGroupItem
                  value="pickup"
                  id="pickup"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="pickup"
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer",
                  )}
                >
                  <Package className="mb-2 h-6 w-6" />
                  <p className="text-sm font-medium">Pickup (4x4)</p>
                  <p className="text-xs text-muted-foreground">1.5 x 1.5 x 1.5 Meter</p>
                  <p className="text-xs text-muted-foreground">800 kg</p>
                </Label>
              </div>

              <div>
                <RadioGroupItem
                  value="van7"
                  id="van7"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="van7"
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer",
                  )}
                >
                  <Bus className="mb-2 h-6 w-6" />
                  <p className="text-sm font-medium">Van 7-ft</p>
                  <p className="text-xs text-muted-foreground">2.1 x 1.6 x 1.4 Meter</p>
                  <p className="text-xs text-muted-foreground">1000 kg</p>
                </Label>
              </div>

              <div>
                <RadioGroupItem
                  value="van9"
                  id="van9"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="van9"
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer",
                  )}
                >
                  <Truck className="mb-2 h-6 w-6" />
                  <p className="text-sm font-medium">Large Van 9-ft</p>
                  <p className="text-xs text-muted-foreground">2.7 x 1.6 x 1.8 Meter</p>
                  <p className="text-xs text-muted-foreground">2000 kg</p>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Additional Services */}
          <div className="mb-6">
            <h2 className="text-sm text-gray-500 mb-2">ADDITIONAL SERVICES</h2>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-gray-300" />
                <span>Door-to-door (loading & unloading by driver)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-gray-300" />
                <span>Round trip</span>
              </label>
            </div>
          </div>

          {/* Route Information */}
          {directions && directions.routes[0] && (
            <div className="mb-6 p-4 bg-gray-50 rounded">
              <h2 className="text-sm font-medium mb-2">Route Information</h2>
              <div className="space-y-2 text-sm">
                <p>Distance: {directions.routes[0].legs[0].distance?.text}</p>
                <p>Duration: {directions.routes[0].legs[0].duration?.text}</p>
              </div>
            </div>
          )}

          {/* Pricing Options */}
          <div className="grid grid-cols-3 gap-2 mt-auto">
            <div className="p-3 rounded bg-gray-50">
              <div className="flex items-center gap-1 mb-1">
                <span>⚡</span>
                <span className="text-sm">Priority</span>
              </div>
              <p className="font-semibold">RM29.70</p>
              <p className="text-xs text-gray-500">Match faster for quick deliveries</p>
            </div>
            <div className="p-3 rounded bg-secondary border-2 border-primary">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-sm">Regular</span>
              </div>
              <p className="font-semibold">RM24.30</p>
            </div>
            <div className="p-3 rounded bg-gray-50">
              <div className="flex items-center gap-1 mb-1">
                <span>🤝</span>
                <span className="text-sm">Pooling</span>
              </div>
              <p className="font-semibold">RM21.90</p>
              <p className="text-xs text-gray-500">Save costs • Wait a little longer</p>
            </div>
          </div>

          <button className="mt-4 bg-primary text-primary-foreground py-3 rounded font-medium">
            Next
          </button>
        </div>

        {/* Map Section */}
        <div className="flex-1 relative">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={center}
              zoom={13}
              onLoad={onLoad}
              onUnmount={onUnmount}
              options={{
                zoomControl: false,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                styles: [
                  {
                    featureType: 'all',
                    elementType: 'labels',
                    stylers: [{ visibility: 'on' }],
                  },
                  {
                    featureType: 'road',
                    elementType: 'geometry',
                    stylers: [{ lightness: 100 }, { visibility: 'simplified' }],
                  },
                  {
                    featureType: 'water',
                    elementType: 'geometry',
                    stylers: [{ color: '#C9E4F0' }],
                  },
                  {
                    featureType: 'poi',
                    elementType: 'labels',
                    stylers: [{ visibility: 'off' }],
                  },
                  {
                    featureType: 'transit',
                    elementType: 'labels',
                    stylers: [{ visibility: 'off' }],
                  },
                ],
              }}
            >
              {directions && (
                <DirectionsRenderer
                  directions={directions}
                  options={{
                    suppressMarkers: false,
                    polylineOptions: {
                      strokeColor: "#459AFE",
                      strokeWeight: 4,
                    },
                  }}
                />
              )}
            </GoogleMap>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
