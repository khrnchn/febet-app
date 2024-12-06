"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { orders } from "@/data/deliveries";
import type { Library } from "@react-google-maps/api";
import { Marker, useJsApiLoader } from "@react-google-maps/api";
import { useCallback, useEffect, useRef, useState } from "react";
import Map from './_components/map';
import RouteInfo from './_components/route-info';

const center = {
  lat: 3.100240985840765,
  lng: 101.63122341164973
};

const libraries: Library[] = ["places"];

export default function Home() {
  const [selectedVehicle, setSelectedVehicle] = useState("car");
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [showRouteInfo, setShowRouteInfo] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [stops, setStops] = useState<string[]>([]);
  const [markerPositions, setMarkerPositions] = useState<{ [key: string]: google.maps.LatLng }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [localOrders, setLocalOrders] = useState(orders);

  const originRef = useRef<HTMLInputElement>(null);
  const destinationRef = useRef<HTMLInputElement>(null);
  const stopRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  useEffect(() => {
    if (isLoaded) {
      const geocodeAllDestinations = async () => {
        const positions: { [key: string]: google.maps.LatLng } = {};
        for (const order of localOrders) {
          try {
            const position = await geocodeAddress(order.destination);
            positions[order.id] = position;
          } catch (error) {
            console.error(`Error geocoding ${order.destination}:`, error);
          }
        }
        setMarkerPositions(positions);
      };

      geocodeAllDestinations();
    }
  }, [isLoaded]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const calculateOptimizedRoute = async () => {
    if (!isLoaded) return;

    const directionsService = new google.maps.DirectionsService();
    const bloomThisHQ = new google.maps.LatLng(center.lat, center.lng);

    // Sort orders by delivery start time
    const sortedOrders = [...localOrders].sort((a, b) =>
      new Date(a.deliveryStart).getTime() - new Date(b.deliveryStart).getTime()
    );

    // Function to calculate time difference in hours
    const getTimeDifferenceInHours = (start: string, end: string) => {
      const startTime = new Date(start);
      const endTime = new Date(end);
      return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    };

    // Group orders into batches that can be delivered within 2 hours
    const batches: Order[][] = [];
    let currentBatch: Order[] = [];
    let currentBatchStartTime: Date | null = null;

    for (const order of sortedOrders) {
      const orderStartTime = new Date(order.deliveryStart);

      // If no current batch or current batch exceeds 2-hour window, start a new batch
      if (!currentBatchStartTime ||
        getTimeDifferenceInHours(currentBatchStartTime.toISOString(), order.deliveryEnd) > 2) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
        }
        currentBatch = [order];
        currentBatchStartTime = orderStartTime;
      } else {
        currentBatch.push(order);
      }
    }

    // Add the last batch if not empty
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    // Calculate optimized routes for each batch
    const batchResults: google.maps.DirectionsResult[] = [];

    for (const batch of batches) {
      // Create waypoints from all orders except the last one
      const waypoints = batch.slice(0, -1).map(order => ({
        location: order.coordinates,
        stopover: true
      }));

      // Get the last order's destination as the final destination
      const finalDestination = batch[batch.length - 1].coordinates;

      try {
        const result = await directionsService.route({
          origin: bloomThisHQ,
          destination: finalDestination,
          waypoints: waypoints,
          optimizeWaypoints: true,
          travelMode: google.maps.TravelMode.DRIVING,
        });

        // Annotate the result with batch information
        (result as any).batchInfo = {
          batchSize: batch.length,
          destinations: batch.map(order => order.destination),
          deliveryWindows: batch.map(order => ({
            start: order.deliveryStart,
            end: order.deliveryEnd
          }))
        };

        batchResults.push(result);
      } catch (error) {
        console.error("Error calculating route for batch:", error);
      }
    }

    // If we have multiple batch results, combine them
    const finalDirections: google.maps.DirectionsResult = batchResults.length > 1
      ? {
        routes: batchResults.flatMap(result => result.routes),
        request: batchResults[0].request,
        status: google.maps.DirectionsStatus.OK
      }
      : batchResults[0];

    setDirections(finalDirections);
    setShowRouteInfo(true);
  };

  const geocodeAddress = (address: string) => {
    const geocoder = new google.maps.Geocoder();
    return new Promise<google.maps.LatLng>((resolve, reject) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK) {
          resolve(results[0].geometry.location);
        } else {
          reject(status);
        }
      });
    });
  };

  const handleAutoAssign = async () => {
    setIsOptimizing(true);
    try {
      await calculateOptimizedRoute();
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex flex-1">
        {/* Left Panel */}
        <div className="w-[400px] border-r p-4 flex flex-col">
          <h3 className="text-lg font-semibold mb-2">Orders</h3>
          {/* Input Field */}
          <div className="mb-4">
            <Input
              type="text"
              placeholder="Add new order destination"
              ref={(input) => {
                if (input && isLoaded) {
                  const autocomplete = new google.maps.places.Autocomplete(input, {
                    types: ['address'],
                    componentRestrictions: { country: 'my' }
                  });
                  autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    if (place.formatted_address) {
                      const newOrder = {
                        id: `order-${localOrders.length + 1}`,
                        destination: place.formatted_address,
                        coordinates: {
                          lat: place.geometry?.location?.lat() || 0,
                          lng: place.geometry?.location?.lng() || 0,
                        },
                      };
                      setLocalOrders([...localOrders, newOrder]);
                      input.value = '';
                    }
                  });
                }
              }}
            />
          </div>

          {/* Destination List */}
          <ScrollArea className="h-[300px]">
            <ul className="space-y-2">
              {localOrders.map((order) => (
                <li key={order.id} className="flex items-center justify-between p-2 bg-secondary/20 rounded-md">
                  <div className="flex items-center">
                    <span className="mr-2">📍</span>
                    <span>{order.destination}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive/80"
                    onClick={() => setLocalOrders(orders => orders.filter(o => o.id !== order.id))}
                  >
                    ✕
                  </Button>
                </li>
              ))}
            </ul>
          </ScrollArea>

          <Button
            className="mt-4"
            onClick={handleAutoAssign}
            disabled={isOptimizing}
          >
            {isOptimizing ? "Optimizing..." : "Auto-assign"}
          </Button>

          {/* Route Information */}
          {directions && <RouteInfo
            directions={directions}
            isOpen={showRouteInfo}
            onOpenChange={setShowRouteInfo}
          />}

          {/* Pricing Options */}
          {/* <DeliveryOptions onOptionChange={(value) => console.log('Selected option:', value)} /> */}

          {/* <button className="mt-4 bg-primary text-primary-foreground py-3 rounded font-medium">
            Next
          </button> */}
        </div>

        {/* Map */}
        <Map
          isLoaded={isLoaded}
          center={center}
          directions={directions}
          onLoad={onLoad}
          onUnmount={onUnmount}
          orders={localOrders}
        >
          {Object.entries(markerPositions).map(([id, position]) => {
            const order = orders.find(o => o.id === id);
            return (
              <Marker
                key={id}
                position={position}
                title={order?.destination}
              />
            );
          })}
        </Map>
      </div>
    </div>
  );
}
