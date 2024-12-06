"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { orders } from "@/data/deliveries";
import type { Library } from "@react-google-maps/api";
import { Marker, useJsApiLoader } from "@react-google-maps/api";
import { useCallback, useEffect, useRef, useState } from "react";
import Map from './_components/map';
import { Card } from "@/components/ui/card"

const center = {
  lat: 3.100240985840765,
  lng: 101.63122341164973
};

const libraries: Library[] = ["places"];

export default function Home() {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [selectedBatchIndex, setSelectedBatchIndex] = useState<number | undefined>(undefined);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [markerPositions, setMarkerPositions] = useState<{ [key: string]: google.maps.LatLng }>({});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [localOrders, setLocalOrders] = useState(orders);

  const originRef = useRef<HTMLInputElement>(null);
  const destinationRef = useRef<HTMLInputElement>(null);

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
    const getTimeDifferenceInHours = (start: string | number, end: string | number) => {
      const startTime = typeof start === 'string' ? new Date(start).getTime() : start;
      const endTime = typeof end === 'string' ? new Date(end).getTime() : end;
      return (endTime - startTime) / (1000 * 60 * 60);
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

    // Function to estimate route duration including service time
    const estimateRouteDuration = (route: any[]) => {
      let totalDuration = 0;
      const serviceTimePerStop = 15 * 60; // 15 minutes in seconds

      // Add travel time between points
      for (let i = 0; i < route.length - 1; i++) {
        const distance = calculateDistance(route[i].coordinates, route[i + 1].coordinates);
        const travelTime = (distance / 30) * 3600; // Convert to seconds (assuming 30 km/h average speed)
        totalDuration += travelTime + serviceTimePerStop;
      }

      return totalDuration;
    };

    // Function to check if a route is feasible within time windows
    const isRouteFeasible = (route: any[]) => {
      let currentTime = new Date(route[0].deliveryStart).getTime();
      
      for (const stop of route) {
        const windowStart = new Date(stop.deliveryStart).getTime();
        const windowEnd = new Date(stop.deliveryEnd).getTime();
        
        // If we arrive before the window starts, wait
        currentTime = Math.max(currentTime, windowStart);
        
        // If we arrive after the window ends, route is infeasible
        if (currentTime > windowEnd) return false;
        
        // Add service time (15 minutes)
        currentTime += 15 * 60 * 1000;
        
        // If we're not at the last stop, add travel time to next stop
        if (stop !== route[route.length - 1]) {
          const nextStop = route[route.indexOf(stop) + 1];
          const distance = calculateDistance(stop.coordinates, nextStop.coordinates);
          const travelTime = (distance / 30) * 3600 * 1000; // Convert to milliseconds
          currentTime += travelTime;
        }
      }
      
      // Check if total duration is within 2 hours
      const totalDuration = (currentTime - new Date(route[0].deliveryStart).getTime()) / (1000 * 60 * 60);
      return totalDuration <= 4;
    };

    // Create optimized batches using a greedy algorithm with time windows
    const optimizedBatches: any[][] = [];
    
    // Set all orders to have time window 12:00-16:00
    const standardizedOrders = sortedOrders.map(order => ({
      ...order,
      deliveryStart: '2024-01-01T12:00:00',
      deliveryEnd: '2024-01-01T16:00:00'
    }));

    let unassignedOrders = [...standardizedOrders];

    // Sort orders by distance from HQ since all time windows are same
    unassignedOrders.sort((a, b) => {
      const distA = calculateDistance(bloomThisHQ, a.coordinates);
      const distB = calculateDistance(bloomThisHQ, b.coordinates);
      return distA - distB;
    });

    while (unassignedOrders.length > 0) {
      let currentBatch: any[] = [unassignedOrders[0]];
      unassignedOrders = unassignedOrders.slice(1);
      
      // Keep adding orders until batch is full
      while (unassignedOrders.length > 0) {
        let bestOrder = {
          order: null as any,
          position: -1,
          score: -Infinity
        };

        // Try each remaining order
        for (let i = 0; i < unassignedOrders.length; i++) {
          const order = unassignedOrders[i];
          
          // Try inserting at each position
          for (let pos = 0; pos <= currentBatch.length; pos++) {
            const newRoute = [
              ...currentBatch.slice(0, pos),
              order,
              ...currentBatch.slice(pos)
            ];

            if (!isRouteFeasible(newRoute)) continue;

            // Calculate score based primarily on route size and duration
            const routeDuration = estimateRouteDuration(newRoute);
            const score = newRoute.length * 10 + // Heavily weight number of stops
                         (7200 - routeDuration) / 60; // Add small bonus for shorter routes

            if (score > bestOrder.score) {
              bestOrder = {
                order,
                position: pos,
                score
              };
            }
          }
        }

        if (bestOrder.order) {
          currentBatch.splice(bestOrder.position, 0, bestOrder.order);
          unassignedOrders = unassignedOrders.filter(o => o !== bestOrder.order);
        } else {
          break;
        }
      }

      // Final pass: try to add any remaining orders that fit
      let added;
      do {
        added = false;
        for (let i = 0; i < unassignedOrders.length; i++) {
          const testRoute = [...currentBatch, unassignedOrders[i]];
          if (isRouteFeasible(testRoute)) {
            currentBatch.push(unassignedOrders[i]);
            unassignedOrders.splice(i, 1);
            added = true;
            break;
          }
        }
      } while (added && unassignedOrders.length > 0);

      optimizedBatches.push(currentBatch);
    }

    // Calculate routes for optimized batches
    const batchResults: google.maps.DirectionsResult[] = [];

    for (const batch of optimizedBatches) {
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

        // Calculate actual route metrics
        const totalDuration = result.routes[0].legs.reduce(
          (acc, leg) => acc + (leg.duration?.value || 0), 0
        );
        const totalDistance = result.routes[0].legs.reduce(
          (acc, leg) => acc + (leg.distance?.value || 0), 0
        );

        (result as any).batchInfo = {
          batchSize: batch.length,
          totalDuration: totalDuration,
          totalDistance: totalDistance,
          estimatedCompletionTime: Math.ceil((totalDuration + (batch.length * 15 * 60)) / 60), // in minutes
          deliveries: batch.map((order, index) => ({
            ...order,
            stopNumber: index + 1,
            estimatedArrival: result.routes[0].legs[index]?.duration?.text || 'N/A'
          })),
          routeMetrics: {
            legs: result.routes[0].legs.map(leg => ({
              duration: leg.duration,
              distance: leg.distance,
              startAddress: leg.start_address,
              endAddress: leg.end_address
            }))
          }
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
          totalBatches: batchResults.length,
          totalDeliveries: optimizedBatches.reduce((acc, batch) => acc + batch.length, 0),
          averageDeliveriesPerBatch: optimizedBatches.reduce((acc, batch) => acc + batch.length, 0) / optimizedBatches.length,
          batches: batchResults.map(result => result.batchInfo)
        }
      } as any
      : batchResults[0];

    setDirections(finalDirections);
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
          <div className="flex flex-col gap-4 p-4">
            <h2 className="text-xl font-bold">Orders List</h2>
            <div className="overflow-y-auto max-h-[500px] pr-2">
              <div className="flex flex-col gap-4">
                {localOrders.map((order) => (
                  <div key={order.id} className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-lg font-semibold text-primary">{order.orderNumber}</div>
                      <div className="px-2 py-1 bg-primary/10 rounded-full text-sm text-primary">
                        {order.productId}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">👤</span>
                        <div>
                          <div className="font-medium">{order.customerName}</div>
                          <div className="text-sm text-gray-600">{order.customerContact}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <span className="text-gray-600">📍</span>
                        <div className="text-sm">{order.destination}</div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">🕒</span>
                        <div className="text-sm">
                          {new Date(order.deliveryStart).toLocaleTimeString()} - 
                          {new Date(order.deliveryEnd).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 w-full text-destructive hover:text-destructive/80 border border-destructive/20"
                      onClick={() => setLocalOrders(orders => orders.filter(o => o.id !== order.id))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

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

interface RouteInfoProps {
    directions: google.maps.DirectionsResult | null
    selectedBatchIndex?: number
    onBatchSelect?: (index: number) => void
}

function RouteInfo({ directions, selectedBatchIndex, onBatchSelect }: RouteInfoProps) {
    if (!directions || !directions.routes[0]) return null

    const routes = directions.routes
    const legs = routes[0].legs

    if (!legs) return null

    const totalDistance = legs.reduce((acc, leg) => acc + (leg.distance?.value || 0), 0)
    const stopBuffer = 900 * (legs.length) // 15 minutes per stop
    const totalDuration = legs.reduce((acc, leg) => acc + (leg.duration?.value || 0), 0) + stopBuffer

    // Convert to human-readable format
    const distanceInKm = (totalDistance / 1000).toFixed(2)
    const durationInMinutes = Math.round(totalDuration / 60)
    const hours = Math.floor(durationInMinutes / 60)
    const minutes = durationInMinutes % 60

    // Extract batch information if available
    const batchInfo = (directions as any).batchInfo ||
        (directions.routes.length > 1 ? {
            totalBatches: directions.routes.length,
            totalDeliveries: directions.routes.length,
            averageDeliveriesPerBatch: 1,
            batches: directions.routes.map((route, index) => ({
                batchSize: 1,
                totalDuration: route.legs[0]?.duration?.value || 0,
                totalDistance: route.legs[0]?.distance?.value || 0,
                estimatedCompletionTime: Math.ceil((route.legs[0]?.duration?.value || 0) / 60),
                deliveries: [{
                    destination: route.legs[0]?.end_address || '',
                    stopNumber: 1,
                    estimatedArrival: route.legs[0]?.duration?.text || 'N/A'
                }],
                routeMetrics: {
                    legs: route.legs.map(leg => ({
                        duration: leg.duration,
                        distance: leg.distance,
                        startAddress: leg.start_address,
                        endAddress: leg.end_address
                    }))
                }
            }))
        } : null);

    return (
        <div className="flex flex-col gap-4">
            {batchInfo && (
                <Card className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Optimized Delivery Batches</h3>
                        <div className="flex gap-4 text-sm">
                            <span>Total Batches: {batchInfo.totalBatches}</span>
                            <span>Total Deliveries: {batchInfo.totalDeliveries}</span>
                            <span>Avg. Deliveries/Batch: {batchInfo.averageDeliveriesPerBatch.toFixed(1)}</span>
                        </div>
                    </div>
                    <ScrollArea className="h-[300px] w-full pr-4">
                        <div className="space-y-4">
                            {(batchInfo.batches || []).map((batch, batchIndex) => (
                                <div
                                    key={batchIndex}
                                    className={`p-4 rounded-md cursor-pointer transition-colors ${
                                        selectedBatchIndex === batchIndex
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted hover:bg-muted/80'
                                    }`}
                                    onClick={() => onBatchSelect?.(batchIndex)}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <span className="font-semibold text-base">Batch {batchIndex + 1}</span>
                                            <span className="text-xs px-2 py-1 rounded-full bg-muted-foreground/10">
                                                {batch.batchSize} deliveries
                                            </span>
                                            <span className="text-xs px-2 py-1 rounded-full bg-muted-foreground/10">
                                                {Math.ceil(batch.estimatedCompletionTime)} min total
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {batch.deliveries.map((delivery, index) => (
                                            <div key={index} className="pl-4 border-l-2 border-muted-foreground/20">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-medium bg-muted-foreground/10 px-1.5 py-0.5 rounded">
                                                        Stop {delivery.stopNumber}
                                                    </span>
                                                    <p className="text-sm">{delivery.destination}</p>
                                                </div>
                                                <div className="flex gap-3 mt-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <svg className="w-3.5 h-3.5 opacity-70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="10" />
                                                            <polyline points="12 6 12 12 16 14" />
                                                        </svg>
                                                        <span className="text-xs opacity-90">
                                                            {delivery.estimatedArrival}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <svg className="w-3.5 h-3.5 opacity-70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M12 2v20M2 12h20" />
                                                        </svg>
                                                        <span className="text-xs opacity-90">
                                                            {batch.routeMetrics.legs[index]?.distance?.text || 'Distance N/A'}
                                                        </span>
                                                    </div>
                                                    {delivery.deliveryStart && (
                                                        <div className="flex items-center gap-1.5">
                                                            <svg className="w-3.5 h-3.5 opacity-70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                                <line x1="16" y1="2" x2="16" y2="6" />
                                                                <line x1="8" y1="2" x2="8" y2="6" />
                                                                <line x1="3" y1="10" x2="21" y2="10" />
                                                            </svg>
                                                            <span className="text-xs opacity-90">
                                                                {new Date(delivery.deliveryStart).toLocaleTimeString()} - {new Date(delivery.deliveryEnd).toLocaleTimeString()}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        <div className="mt-3 pt-3 border-t border-muted-foreground/10">
                                            <div className="flex justify-between text-xs">
                                                <span>Total Distance: {(batch.totalDistance / 1000).toFixed(1)} km</span>
                                                <span>Total Duration: {Math.ceil(batch.totalDuration / 60)} mins</span>
                                                <span>Service Time: {batch.batchSize * 15} mins</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </Card>
            )}
        </div>
    )
}
