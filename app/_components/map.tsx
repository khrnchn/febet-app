'use client'

import { GoogleMap, DirectionsRenderer, Marker, InfoWindow } from '@react-google-maps/api'
import { useState } from 'react'

interface MapProps {
    isLoaded: boolean
    center: google.maps.LatLngLiteral
    directions: google.maps.DirectionsResult | null
    onLoad: (map: google.maps.Map) => void
    onUnmount: () => void
    orders: Delivery[]
    selectedBatchIndex?: number
}

interface Delivery {
    id: string
    destination: string
    coordinates: { lat: number; lng: number }
    vehicleType: string
    deliveryStart: Date
    deliveryEnd: Date
}

export default function Map({ isLoaded, center, directions, onLoad, onUnmount, orders, selectedBatchIndex }: MapProps) {
    const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null)

    // Get the selected batch route
    const selectedRoute = directions && selectedBatchIndex !== undefined && directions.routes[selectedBatchIndex]
        ? {
            ...directions,
            routes: [directions.routes[selectedBatchIndex]]
        }
        : directions;

    return (
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
                    {orders.map((order) => (
                        <Marker
                            key={order.id}
                            position={{ lat: order.coordinates.lat, lng: order.coordinates.lng }}
                            title={order.destination}
                            icon={{
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 8,
                                fillColor: '#007bff',
                                fillOpacity: 1,
                                strokeWeight: 0,
                            }}
                            onClick={() => setSelectedDelivery(order)}
                        />
                    ))}
                    {selectedDelivery && (
                        <InfoWindow
                            position={{ lat: selectedDelivery.coordinates.lat, lng: selectedDelivery.coordinates.lng }}
                            onCloseClick={() => setSelectedDelivery(null)}
                        >
                            <div>
                                <h2>{selectedDelivery.destination}</h2>
                                <p><strong>Vehicle:</strong> {selectedDelivery.vehicleType}</p>
                                <p><strong>Start:</strong> {new Date(selectedDelivery.deliveryStart).toLocaleString()}</p>
                                <p><strong>End:</strong> {new Date(selectedDelivery.deliveryEnd).toLocaleString()}</p>
                            </div>
                        </InfoWindow>
                    )}
                    {selectedRoute && (
                        <DirectionsRenderer
                            directions={selectedRoute}
                            options={{
                                suppressMarkers: false,
                                polylineOptions: {
                                    strokeColor: "#459AFE",
                                    strokeWeight: 4,
                                },
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