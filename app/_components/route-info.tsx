'use client'

import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"

interface RouteInfoProps {
    directions: google.maps.DirectionsResult | null
    selectedBatchIndex?: number
    onBatchSelect?: (index: number) => void
}

export default function RouteInfo({ directions, selectedBatchIndex, onBatchSelect }: RouteInfoProps) {
    if (!directions || !directions.routes[0]) return null

    const route = directions.routes[0]
    const legs = route.legs

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
            batchSize: directions.routes.length,
            destinations: directions.routes.map(route => route.legs[route.legs.length - 1].end_address),
            deliveryWindows: directions.routes.map(() => ({ start: '', end: '' }))
        } : null);

    return (
        <div className="flex flex-col gap-4">
            <Card className="p-4">
                <h3 className="text-lg font-semibold mb-4">Route Summary</h3>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="font-medium">Total Distance:</span>
                        <span>{distanceInKm} km</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="font-medium">Estimated Duration:</span>
                        <span>{hours > 0 ? `${hours}h ` : ''}{minutes}min</span>
                    </div>
                </div>
            </Card>

            {batchInfo && (
                <Card className="p-4">
                    <h3 className="text-lg font-semibold mb-2">Delivery Batches</h3>
                    <ScrollArea className="h-[300px] w-full pr-4">
                        <div className="space-y-2">
                            {batchInfo.destinations.map((destination, index) => (
                                <div
                                    key={index}
                                    className={`p-3 rounded-md cursor-pointer transition-colors ${selectedBatchIndex === index
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted hover:bg-muted/80'
                                        }`}
                                    onClick={() => onBatchSelect?.(index)}
                                >
                                    <div className="flex justify-between">
                                        <span className="font-medium">Batch {index + 1}</span>
                                        <span className="text-sm opacity-90">
                                            {batchInfo.deliveryWindows[index]?.start
                                                ? `${new Date(batchInfo.deliveryWindows[index].start).toLocaleTimeString()} - ${new Date(batchInfo.deliveryWindows[index].end).toLocaleTimeString()}`
                                                : 'Time not specified'}
                                        </span>
                                    </div>
                                    <p className="text-sm mt-1">{destination}</p>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </Card>
            )}
        </div>
    )
}
