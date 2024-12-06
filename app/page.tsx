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
  const [selectedBatchIndex, setSelectedBatchIndex] = useState<number | undefined>(undefined);
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
    googleMapsApiKey: '',
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

    // Helper functions
    const getTimeDifferenceInHours = (start: string, end: string) => {
      const startTime = new Date(start);
      const endTime = new Date(end);
      return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    };

    const calculateDistance = (coord1: google.maps.LatLngLiteral, coord2: google.maps.LatLngLiteral) => {
      const R = 6371; // Earth's radius in km
      const lat1 = coord1.lat * Math.PI / 180;
      const lat2 = coord2.lat * Math.PI / 180;
      const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
      const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;

      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // Function to check if an order can be added to a batch
    const canAddToBatch = (batch: any[], newOrder: any): boolean => {
      if (batch.length === 0) return true;
      if (batch.length >= 10) return false; // Maximum 10 deliveries per batch

      const batchStartTime = Math.min(
        ...batch.map(order => new Date(order.deliveryStart).getTime())
      );
      const batchEndTime = Math.max(
        ...batch.map(order => new Date(order.deliveryEnd).getTime())
      );
      const orderStartTime = new Date(newOrder.deliveryStart).getTime();
      const orderEndTime = new Date(newOrder.deliveryEnd).getTime();

      // Check time window overlap
      const overlapStart = Math.max(batchStartTime, orderStartTime);
      const overlapEnd = Math.min(batchEndTime, orderEndTime);
      if (overlapStart > overlapEnd) return false;

      // Calculate estimated delivery time including the new order
      let totalDistance = 0;
      const allPoints = [...batch.map(o => o.coordinates), newOrder.coordinates];

      // Calculate total route distance (simplified estimation)
      for (let i = 0; i < allPoints.length - 1; i++) {
        totalDistance += calculateDistance(allPoints[i], allPoints[i + 1]);
      }

      // Estimate delivery time (assume average speed of 30 km/h in city traffic)
      const estimatedTimeHours = totalDistance / 30;
      const stopTime = (batch.length + 1) * 0.25; // 15 minutes per stop
      const totalTimeHours = estimatedTimeHours + stopTime;

      return totalTimeHours <= 2;
    };

    // Create optimized batches
    const batches: any[][] = [];
    const unassignedOrders = [...sortedOrders];

    while (unassignedOrders.length > 0) {
      const currentBatch: any[] = [];
      const seed = unassignedOrders[0];
      currentBatch.push(seed);
      unassignedOrders.splice(0, 1);

      // Try to add more orders to the current batch
      let added: boolean;
      do {
        added = false;
        let bestDistance = Infinity;
        let bestOrderIndex = -1;

        // Find the closest order that can be added to the batch
        for (let i = 0; i < unassignedOrders.length; i++) {
          const order = unassignedOrders[i];
          if (canAddToBatch(currentBatch, order)) {
            const lastOrder = currentBatch[currentBatch.length - 1];
            const distance = calculateDistance(lastOrder.coordinates, order.coordinates);
            if (distance < bestDistance) {
              bestDistance = distance;
              bestOrderIndex = i;
            }
          }
        }

        // Add the best order to the batch
        if (bestOrderIndex !== -1) {
          currentBatch.push(unassignedOrders[bestOrderIndex]);
          unassignedOrders.splice(bestOrderIndex, 1);
          added = true;
        }
      } while (added && currentBatch.length < 10);

      batches.push(currentBatch);
    }

    // Calculate optimized routes for each batch
    const batchResults: google.maps.DirectionsResult[] = [];

    for (const batch of batches) {
      const waypoints = batch.slice(0, -1).map(order => ({
        location: order.coordinates,
        stopover: true
      }));

      try {
        const result = await directionsService.route({
          origin: bloomThisHQ,
          destination: batch[batch.length - 1].coordinates,
          waypoints: waypoints,
          optimizeWaypoints: true,
          travelMode: google.maps.TravelMode.DRIVING,
        });

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

    // Combine batch results
    const finalDirections: google.maps.DirectionsResult = batchResults.length > 1
      ? {
        routes: batchResults.flatMap(result => result.routes),
        request: batchResults[0].request,
        status: google.maps.DirectionsStatus.OK,
        batchInfo: {
          batchSize: batches.reduce((total, batch) => total + batch.length, 0),
          destinations: batches.flatMap(batch => batch.map(order => order.destination)),
          deliveryWindows: batches.flatMap(batch =>
            batch.map(order => ({
              start: order.deliveryStart,
              end: order.deliveryEnd
            }))
          )
        }
      } as any
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

  const handleBatchSelect = (index: number) => {
    setSelectedBatchIndex(index);
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
            selectedBatchIndex={selectedBatchIndex}
            onBatchSelect={handleBatchSelect}
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
          selectedBatchIndex={selectedBatchIndex}
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
