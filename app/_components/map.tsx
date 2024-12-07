'use client'

import { Delivery } from '@/data/deliveries'
import { GoogleMap, DirectionsRenderer, Marker, InfoWindow } from '@react-google-maps/api'
import { useState } from 'react'

interface MapProps {
    isLoaded: boolean
    center: { lat: number; lng: number }
    directions: google.maps.DirectionsResult | null
    orders: Delivery[]
    selectedBatchId: string | undefined
    onBatchSelect: (batchId: string) => void
    selectedDelivery: Delivery | null
    onDeliverySelect: (delivery: Delivery | null) => void
    children?: React.ReactNode
}

export default function Map({ 
    isLoaded, 
    center, 
    directions, 
    orders, 
    selectedBatchId,
    onBatchSelect,
    selectedDelivery,
    onDeliverySelect,
    children 
}: MapProps) {
    // Define batch colors
    const batchColors = [
        "#459AFE", // Original blue
        "#FF4444", // Red
        "#4CAF50", // Green
        "#9C27B0", // Purple
        "#FF9800", // Orange
        "#795548", // Brown
        "#607D8B", // Blue Grey
        "#E91E63", // Pink
        "#FFEB3B", // Yellow
        "#00BCD4"  // Cyan
    ];

    // Function to get batch ID for an order
    const getOrderBatchId = (orderId: string) => {
        if (!directions || !(directions as any).batchInfo?.batches) return null;

        // Debug log the batches data
        console.log('Checking batches for order:', orderId);
        console.log('Available batches:', (directions as any).batchInfo.batches);
        
        for (const batch of (directions as any).batchInfo.batches) {
            const found = batch.deliveries.some(delivery => delivery.id === orderId);
            if (found) {
                console.log('Found order in batch:', batch.id);
                return batch.id;
            }
        }
        
        console.log('Order not found in any batch');
        return null;
    };

    // Get the selected batch route
    const selectedRoute = directions && selectedBatchId
        ? {
            ...directions,
            routes: [(directions as any).batchInfo.batches.findIndex(
                (batch: any) => batch.id === selectedBatchId
            )].filter(index => index !== -1).map(index => directions.routes[index])
        }
        : directions;

    // Function to get batch color by ID
    const getBatchColor = (batchId: string | null) => {
        if (!batchId || !directions || !(directions as any).batchInfo?.batches) {
            console.log('No batch ID or directions data:', { batchId });
            return "#808080"; // Grey for unassigned
        }

        const batchIndex = (directions as any).batchInfo.batches.findIndex(
            (batch: any) => batch.id === batchId
        );

        console.log('Batch color lookup:', { 
            batchId, 
            batchIndex, 
            color: batchIndex >= 0 ? batchColors[batchIndex % batchColors.length] : "#808080" 
        });

        return batchIndex >= 0 ? batchColors[batchIndex % batchColors.length] : "#808080";
    };

    const handleMarkerClick = (order: Delivery) => {
        onDeliverySelect(order);
        const batchId = getOrderBatchId(order.id);
        if (batchId) {
            onBatchSelect(batchId);
        }
    };

    return (
        <div className="h-full w-full">
            {isLoaded ? (
                <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={center}
                    zoom={12}
                    options={{
                        zoomControl: false,
                        mapTypeControl: false,
                        streetViewControl: false,
                        fullscreenControl: false,
                        styles: [
                            {
                                featureType: "poi",
                                elementType: "labels",
                                stylers: [{ visibility: "off" }],
                            },
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
                    {orders.map((order, index) => {
                        const batchId = getOrderBatchId(order.id);
                        const isInSelectedBatch = selectedBatchId === batchId;
                        const markerColor = getBatchColor(batchId);
                        const isSelected = selectedDelivery?.id === order.id;
                        
                        return (
                            <Marker
                                key={order.id}
                                position={{ lat: order.coordinates.lat, lng: order.coordinates.lng }}
                                label={{
                                    text: (index + 1).toString(),
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: 'bold'
                                }}
                                icon={{
                                    path: google.maps.SymbolPath.CIRCLE,
                                    fillColor: markerColor,
                                    fillOpacity: selectedBatchId ? (isInSelectedBatch ? 1 : 0.3) : 1,
                                    strokeWeight: isSelected ? 4 : 2,
                                    strokeColor: isSelected ? markerColor : 'white',
                                    scale: isSelected ? 14 : 12,
                                }}
                                title={`${order.orderNumber} - ${order.destination}`}
                                onClick={() => handleMarkerClick(order)}
                            />
                        );
                    })}
                    {selectedDelivery && (
                        <InfoWindow
                            position={{ lat: selectedDelivery.coordinates.lat, lng: selectedDelivery.coordinates.lng }}
                            onCloseClick={() => onDeliverySelect(null)}
                        >
                            <div className="p-2">
                                <h3 className="font-medium mb-2">Order #{selectedDelivery.orderNumber}</h3>
                                <p className="text-sm mb-2">{selectedDelivery.destination}</p>
                                <div className="text-xs text-gray-600">
                                    <p><strong>Start:</strong> {new Date(selectedDelivery.deliveryStart).toLocaleTimeString()}</p>
                                    <p><strong>End:</strong> {new Date(selectedDelivery.deliveryEnd).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        </InfoWindow>
                    )}
                    {directions && (
                        <DirectionsRenderer
                            directions={selectedRoute}
                            options={{
                                suppressMarkers: true,
                                polylineOptions: {
                                    strokeColor: selectedBatchId ? "#459AFE" : "#459AFE",
                                    strokeOpacity: 0.8,
                                    strokeWeight: 4,
                                },
                                markerOptions: {
                                    visible: false
                                }
                            }}
                        />
                    )}
                    <Marker
                        position={{ lat: 3.100240985840765, lng: 101.63122341164973 }}
                        title="BloomThis HQ"
                        icon={{
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: 'red',
                            fillOpacity: 1,
                            strokeWeight: 0,
                        }}
                    />
                </GoogleMap>
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            )}
        </div>
    )
}