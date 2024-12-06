"use client";

import type { Library } from "@react-google-maps/api";
import { useJsApiLoader } from "@react-google-maps/api";
import { useCallback, useEffect, useRef, useState } from "react";
import DeliveryOptions from '../_components/delivery-options';
import Map from '../_components/map';
import RouteInfo from '../_components/route-info';
import VehicleOptions from '../_components/vehicle-options';
import { Marker } from "@react-google-maps/api";
import { deliveries } from "@/data/deliveries";

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
  const [markerPositions, setMarkerPositions] = useState<{ [key: string]: google.maps.LatLng }>({});
  const [isLoading, setIsLoading] = useState(false);

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
        for (const delivery of deliveries) {
          try {
            const position = await geocodeAddress(delivery.destination);
            positions[delivery.id] = position;
          } catch (error) {
            console.error(`Error geocoding ${delivery.destination}:`, error);
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

  return (
    <div className="flex flex-col h-screen">
      <div className="flex flex-1">
        {/* Left Panel */}
        <div className="w-[400px] border-r p-4 flex flex-col">
          {/* Vehicle Type Section */}
          <VehicleOptions
            selectedVehicle={selectedVehicle}
            onVehicleChange={setSelectedVehicle}
          />

          {/* Route Information */}
          {directions && <RouteInfo directions={directions} />}

          {/* Pricing Options */}
          <DeliveryOptions onOptionChange={(value) => console.log('Selected option:', value)} />

          <button className="mt-4 bg-primary text-primary-foreground py-3 rounded font-medium">
            Next
          </button>
        </div>

        {/* Map Section */}
        <Map
          isLoaded={isLoaded}
          center={center}
          directions={directions}
          onLoad={onLoad}
          onUnmount={onUnmount}
        >
          {Object.entries(markerPositions).map(([id, position]) => {
            const delivery = deliveries.find(d => d.id === id);
            return (
              <Marker
                key={id}
                position={position}
                title={delivery?.destination}
              />
            );
          })}
        </Map>
      </div>
    </div>
  );
}
