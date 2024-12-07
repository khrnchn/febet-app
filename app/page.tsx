"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { orders } from "@/data/deliveries";
import type { Library } from "@react-google-maps/api";
import { Marker, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useState } from "react";
import Map from './_components/map';
import { Card } from "@/components/ui/card"

const center = {
  lat: 3.100240985840765,
  lng: 101.63122341164973
};

const libraries: Library[] = ["places"];

interface Delivery {
  id: string;
  orderNumber: string;
  productId: string;
  customerName: string;
  customerContact: string;
  destination: string;
  coordinates: google.maps.LatLngLiteral;
  deliveryStart: string;
  deliveryEnd: string;
}

interface BatchInfo {
  id: string;
  batchSize: number;
  totalDuration: number;
  totalDistance: number;
  estimatedCompletionTime: number;
  deliveries: (Delivery & { stopNumber: number; estimatedArrival: string; deliveryStart: string; deliveryEnd: string })[];
  routeMetrics: {
    legs: {
      duration: google.maps.Duration | undefined;
      distance: google.maps.Distance | undefined;
      startAddress: string;
      endAddress: string;
    }[];
  };
}

interface DirectionsWithBatchInfo extends google.maps.DirectionsResult {
  batchInfo: {
    totalBatches: number;
    totalDeliveries: number;
    averageDeliveriesPerBatch: number;
    batches: BatchInfo[];
  };
}

const calculateEstimatedPrice = (distanceInMeters: number, numberOfStops: number) => {
  const distanceInKm = distanceInMeters / 1000;
  const basePrice = 5; // First 5km
  const additionalDistance = Math.max(0, distanceInKm - 5);
  const distancePrice = additionalDistance * 1; // RM1 per km after first 5km
  const stopsPrice = numberOfStops * 2; // RM2 per stop
  
  return Math.ceil(basePrice + distancePrice + stopsPrice);
};

const handleOrderService = (service: 'grab' | 'lalamove', batchId: string, price: number) => {
  const servicePrice = service === 'grab' ? price + 1 : price;
  alert(`Ordering with ${service.toUpperCase()}\nEstimated Price: RM${servicePrice}`);
};

export default function Home() {
  const [localOrders, setLocalOrders] = useState<Delivery[]>(orders);
  const [directions, setDirections] = useState<DirectionsWithBatchInfo | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string>();
  const [markerPositions, setMarkerPositions] = useState<{ [key: string]: google.maps.LatLng }>({});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [activeTab, setActiveTab] = useState<'deliveries' | 'orders'>('deliveries');
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: '',
    libraries
  });

  useEffect(() => {
    if (isLoaded) {
      const geocodeAllDestinations = async () => {
        const positions: { [key: string]: google.maps.LatLng } = {};
        const validOrders: typeof orders = [];

        for (const order of localOrders) {
          try {
            const position = await geocodeAddress(order.destination);
            if (position) {
              positions[order.id] = position;
              validOrders.push(order);
            } else {
              console.error(`Failed to geocode order ${order.orderNumber} - ${order.destination}: No results found`);
            }
          } catch (error) {
            console.error(`Error geocoding order ${order.orderNumber} - ${order.destination}:`, error);
          }
        }

        setMarkerPositions(positions);
        if (validOrders.length !== localOrders.length) {
          console.log(`Removed ${localOrders.length - validOrders.length} orders due to geocoding failures`);
          setLocalOrders(validOrders);
        }
      };

      geocodeAllDestinations();
    }
  }, [isLoaded]);

  const calculateOptimizedRoute = async () => {
    if (!isLoaded) return;
    setIsOptimizing(true);

    // Validate orders have coordinates
    const validOrders = localOrders.filter(order => {
      const hasValidCoords = order.coordinates &&
        typeof order.coordinates.lat === 'number' &&
        typeof order.coordinates.lng === 'number';
      if (!hasValidCoords) {
        console.error(`Order ${order.orderNumber} has invalid coordinates:`, order.coordinates);
      }
      return hasValidCoords;
    });

    if (validOrders.length === 0) {
      console.error("No valid orders with coordinates found");
      setIsOptimizing(false);
      return;
    }

    const directionsService = new google.maps.DirectionsService();
    const bloomThisHQ = new google.maps.LatLng(center.lat, center.lng);

    // Sort orders by delivery start time
    const sortedOrders = [...localOrders].sort((a, b) =>
      new Date(a.deliveryStart).getTime() - new Date(b.deliveryStart).getTime()
    );

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
    const optimizedBatches: Delivery[][] = [];

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
      let currentBatch: Delivery[] = [unassignedOrders[0]];
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
    const batchResults: (google.maps.DirectionsResult & { batchInfo?: BatchInfo })[] = [];

    for (const batch of optimizedBatches) {
      if (batch.length > 0) {
        try {
          // Validate batch data before processing
          if (!batch.every(delivery =>
            delivery?.coordinates?.lat != null &&
            delivery?.coordinates?.lng != null
          )) {
            console.error("Invalid delivery coordinates in batch:", {
              batch: batch.map(d => ({
                orderNumber: d.orderNumber,
                coordinates: d.coordinates,
              }))
            });
            continue;
          }

          const lastDelivery = batch[batch.length - 1];
          const intermediateStops = batch.slice(0, -1);

          // Create and validate waypoints
          const waypoints: google.maps.DirectionsWaypoint[] = intermediateStops.map(order => ({
            location: {
              lat: order.coordinates.lat,
              lng: order.coordinates.lng
            },
            stopover: true
          }));

          const result = await directionsService.route({
            origin: bloomThisHQ,
            destination: {
              lat: lastDelivery.coordinates.lat,
              lng: lastDelivery.coordinates.lng
            },
            waypoints,
            optimizeWaypoints: true,
            travelMode: google.maps.TravelMode.DRIVING,
          });

          if (!result || !result.routes?.[0]) {
            throw new Error('Invalid route result');
          }

          const totalDuration = result.routes[0].legs.reduce(
            (acc, leg) => acc + (leg.duration?.value || 0), 0
          );
          const totalDistance = result.routes[0].legs.reduce(
            (acc, leg) => acc + (leg.distance?.value || 0), 0
          );

          // Get the waypoint order from the optimized route
          const waypointOrder = result.routes[0].waypoint_order || [];

          // Reorder the deliveries based on the optimized waypoint order
          const orderedDeliveries = [...intermediateStops]
            .map((_, index) => intermediateStops[waypointOrder[index] || index])
            .filter(Boolean);

          orderedDeliveries.push(lastDelivery);

          // Calculate cumulative time and ETAs
          let cumulativeSeconds = 0;
          // Set start time to 12:00 PM
          const baseStartTime = (() => {
            const noon = new Date();
            noon.setHours(12, 0, 0, 0);
            return noon;
          })();

          const deliveriesWithETA = orderedDeliveries.map((order, index) => {
            // Get the leg duration in seconds
            const legDuration = result.routes[0].legs[index]?.duration?.value || 0;
            // Add 15 minutes (900 seconds) for each delivery stop
            const stopTime = 900;

            // Calculate arrival time
            const arrivalTime = new Date(baseStartTime);
            arrivalTime.setSeconds(arrivalTime.getSeconds() + cumulativeSeconds + legDuration);

            // Update cumulative time for next delivery
            cumulativeSeconds += legDuration + stopTime;

            return {
              ...order,
              stopNumber: index + 1,
              estimatedArrival: arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              duration: result.routes[0].legs[index]?.duration?.text || 'N/A'
            };
          });

          // Create batch info with ordered deliveries and unique ID
          const batchId = Math.random().toString(36).substr(2, 9);
          (result as any).batchInfo = {
            id: batchId,
            batchSize: batch.length,
            totalDuration,
            totalDistance,
            estimatedCompletionTime: Math.ceil((totalDuration + (batch.length * 15 * 60)) / 60),
            deliveries: deliveriesWithETA,
            routeMetrics: {
              legs: result.routes[0].legs.map(leg => ({
                duration: leg.duration,
                distance: leg.distance,
                startAddress: leg.start_address,
                endAddress: leg.end_address
              }))
            }
          };

          console.log('Created batch:', {
            batchId,
            deliveryCount: orderedDeliveries.length,
            firstDeliveryId: orderedDeliveries[0]?.id,
            lastDeliveryId: orderedDeliveries[orderedDeliveries.length - 1]?.id
          });

          batchResults.push(result as any);
        } catch (error) {
          console.error("Error calculating route for batch:", error);
        }
      }
    }

    // Combine batch results with IDs
    const finalDirections = batchResults.length > 1
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
    setIsOptimizing(false);
  };

  const geocodeAddress = async (address: string): Promise<google.maps.LatLng | null> => {
    const geocoder = new google.maps.Geocoder();
    try {
      const result = await geocoder.geocode({ address: `${address}, Kuala Lumpur, Malaysia` });
      if (result.results[0]?.geometry?.location) {
        return result.results[0].geometry.location;
      }
      return null;
    } catch (error) {
      throw error;
    }
  };

  const handleAutoAssign = async () => {
    setIsOptimizing(true);
    try {
      await calculateOptimizedRoute();
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleBatchSelect = (batchId: string) => {
    setSelectedBatchId(batchId);
  };

  const handleOrderSelect = (order: Delivery) => {
    setSelectedDelivery(order);
    // If the order is part of a batch, select that batch
    if (directions && (directions as any).batchInfo?.batches) {
      for (const batch of (directions as any).batchInfo.batches) {
        if (batch.deliveries.some(delivery => delivery.id === order.id)) {
          setSelectedBatchId(batch.id);
          break;
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <div className="flex flex-1 h-full">
        {/* Left Panel */}
        <div className="flex-none w-[400px] border-r overflow-hidden flex flex-col">
          {/* Tabs */}
          <div className="border-b">
            <div className="flex">
              <button
                className={`flex-1 px-4 py-2 text-sm font-medium ${activeTab === 'deliveries'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
                onClick={() => setActiveTab('deliveries')}
              >
                Deliveries
              </button>
              <button
                className={`flex-1 px-4 py-2 text-sm font-medium ${activeTab === 'orders'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
                onClick={() => setActiveTab('orders')}
              >
                Orders
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto">
            {activeTab === 'deliveries' ? (
              <>
                <div className="p-4 border-b">
                  <h1 className="font-semibold text-lg mb-2">Delivery Route Optimization</h1>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleAutoAssign}
                      disabled={isOptimizing || orders.length === 0}
                      className="w-full"
                    >
                      {isOptimizing ? "Optimizing..." : "Optimize Routes"}
                    </Button>
                  </div>
                </div>
                {
                  directions ? (
                    <RouteInfo
                      directions={directions}
                      selectedBatchId={selectedBatchId}
                      onBatchSelect={handleBatchSelect}
                    />
                  ) : (
                    <div className="p-4 text-sm text-gray-500">
                      No routes optimized yet. Click "Optimize Routes" to start.
                    </div>
                  )
                }
              </>
            ) : (
              <div className="p-4">
                <div className="space-y-4">
                  {localOrders.map((order, index) => (
                    <div
                      key={order.id}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                      onClick={() => handleOrderSelect(order)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">Order #{order.orderNumber}</h3>
                          <p className="text-sm text-gray-500">{order.destination}</p>
                        </div>
                      </div>
                      <div className="flex gap-3 mt-1">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 opacity-70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          <span className="text-xs opacity-90">
                            {new Date(order.deliveryStart).toLocaleTimeString()} - {new Date(order.deliveryEnd).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <Map
          isLoaded={isLoaded}
          center={center}
          directions={directions}
          orders={localOrders}
          selectedBatchId={selectedBatchId}
          onBatchSelect={handleBatchSelect}
          selectedDelivery={selectedDelivery}
          onDeliverySelect={setSelectedDelivery}
        >
          {Object.entries(markerPositions).map(([id, position]) => {
            const order = localOrders.find(o => o.id === id);
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
  selectedBatchId?: string
  onBatchSelect?: (batchId: string) => void
}

function RouteInfo({ directions, selectedBatchId, onBatchSelect }: RouteInfoProps) {
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  if (!directions || !directions.routes[0]) return null

  const routes = directions.routes
  const legs = routes[0].legs

  if (!legs) return null

  // Extract batch information if available
  const batchInfo = (directions as any).batchInfo ||
    (directions.routes.length > 1 ? {
      totalBatches: directions.routes.length,
      totalDeliveries: directions.routes.length,
      averageDeliveriesPerBatch: 1,
      batches: directions.routes.map((route, index) => ({
        id: `batch-${index}`,
        batchSize: 1,
        totalDuration: route.legs[0]?.duration?.value || 0,
        totalDistance: route.legs[0]?.distance?.value || 0,
        estimatedCompletionTime: Math.ceil((route.legs[0]?.duration?.value || 0) / 60),
        deliveries: [{
          destination: route.legs[0]?.end_address || '',
          stopNumber: 1,
          estimatedArrival: route.legs[0]?.duration?.text || 'N/A',
          deliveryStart: '',
          deliveryEnd: ''
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
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Optimized Delivery Batches</h3>
            <div className="flex gap-4 text-sm">
              <span>Total Batches: {batchInfo.totalBatches}</span>
              <span>Total Deliveries: {batchInfo.totalDeliveries}</span>
              <span>Avg. Deliveries/Batch: {batchInfo.averageDeliveriesPerBatch.toFixed(1)}</span>
            </div>
          </div>

          {/* Total Price Summary */}
          <div className="mb-6 p-4 border rounded-lg bg-muted/50">
            <div className="text-sm font-medium mb-3">
              Total Estimated Price: RM
              {batchInfo.batches.reduce((total, batch) => 
                total + calculateEstimatedPrice(batch.totalDistance, batch.batchSize), 0)}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => {
                  const totalPrice = batchInfo.batches.reduce((total, batch) => 
                    total + calculateEstimatedPrice(batch.totalDistance, batch.batchSize), 0);
                  handleOrderService('grab', 'all', totalPrice);
                }}
              >
                Order All with Grab (RM{(batchInfo.batches.reduce((total, batch) => 
                  total + calculateEstimatedPrice(batch.totalDistance, batch.batchSize), 0) + 1)})
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => {
                  const totalPrice = batchInfo.batches.reduce((total, batch) => 
                    total + calculateEstimatedPrice(batch.totalDistance, batch.batchSize), 0);
                  handleOrderService('lalamove', 'all', totalPrice);
                }}
              >
                Order All with Lalamove (RM{batchInfo.batches.reduce((total, batch) => 
                  total + calculateEstimatedPrice(batch.totalDistance, batch.batchSize), 0)})
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {(batchInfo.batches || []).map((batch, batchIndex) => {
              const isExpanded = expandedBatches.has(batch.id);
              
              return (
                <div
                  key={batch.id}
                  className={`p-4 rounded-md cursor-pointer transition-colors ${selectedBatchId === batch.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                    }`}
                  onClick={() => onBatchSelect?.(batch.id)}
                >
                  {/* Batch Summary */}
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

                  {/* Summary Stats */}
                  <div className="flex justify-between text-xs mb-4">
                    <span>Total Distance: {(batch.totalDistance / 1000).toFixed(1)} km</span>
                    <span>Total Duration: {Math.ceil(batch.totalDuration / 60)} mins</span>
                    <span>Service Time: {batch.batchSize * 15} mins</span>
                  </div>

                  {/* Pricing and Order Buttons */}
                  <div className="flex flex-col gap-2 mb-3">
                    <div className="text-xs font-medium">
                      Estimated Price: RM{calculateEstimatedPrice(batch.totalDistance, batch.batchSize)}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOrderService('grab', batch.id, calculateEstimatedPrice(batch.totalDistance, batch.batchSize));
                        }}
                      >
                        Order with Grab (RM{(calculateEstimatedPrice(batch.totalDistance, batch.batchSize) + 1)})
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOrderService('lalamove', batch.id, calculateEstimatedPrice(batch.totalDistance, batch.batchSize));
                        }}
                      >
                        Order with Lalamove (RM{calculateEstimatedPrice(batch.totalDistance, batch.batchSize)})
                      </Button>
                    </div>
                  </div>

                  {/* Expand/Collapse Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedBatches(prev => {
                        const newSet = new Set(prev);
                        if (isExpanded) {
                          newSet.delete(batch.id);
                        } else {
                          newSet.add(batch.id);
                        }
                        return newSet;
                      });
                    }}
                  >
                    {isExpanded ? 'Hide Details' : 'Show Details'}
                  </Button>

                  {/* Expanded Delivery Details */}
                  {isExpanded && (
                    <div className="mt-4 space-y-3">
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
                                {delivery.duration}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 opacity-70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                              <span className="text-xs opacity-90">
                                ETA: {delivery.estimatedArrival}
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
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
