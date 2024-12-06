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
            batchSize: directions.routes.length,
            destinations: directions.routes.map(route => route.legs[route.legs.length - 1].end_address),
            deliveryWindows: directions.routes.map(() => ({ start: '', end: '' }))
        } : null);

    return (
        <div className="flex flex-col gap-4">
            {batchInfo && (
                <Card className="p-4">
                    <h3 className="text-lg font-semibold mb-2">Delivery Batches</h3>
                    <ScrollArea className="h-[300px] w-full pr-4">
                        <div className="space-y-2">
                            {batchInfo.destinations.map((destination, index) => (
                                <div
                                    key={index}
                                    className={`p-4 rounded-md cursor-pointer transition-colors ${selectedBatchIndex === index
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted hover:bg-muted/80'
                                        }`}
                                    onClick={() => onBatchSelect?.(index)}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-base">Batch {index + 1}</span>
                                        <span className={`text-xs px-2 py-1 rounded-full ${selectedBatchIndex === index
                                            ? 'bg-primary-foreground/20 text-primary-foreground'
                                            : 'bg-background text-muted-foreground'}`}>
                                            {batchInfo.deliveryWindows[index]?.start
                                                ? `${new Date(batchInfo.deliveryWindows[index].start).toLocaleTimeString()} - ${new Date(batchInfo.deliveryWindows[index].end).toLocaleTimeString()}`
                                                : 'No delivery window set'}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">{destination}</p>
                                        <div className="flex gap-3">
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5 opacity-70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <polyline points="12 6 12 12 16 14" />
                                                </svg>
                                                <span className="text-xs opacity-90">
                                                    {routes[index]?.legs[0]?.duration?.text || 'Duration N/A'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5 opacity-70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 2v20M2 12h20" />
                                                </svg>
                                                <span className="text-xs opacity-90">
                                                    {routes[index]?.legs[0]?.distance?.text || 'Distance N/A'}
                                                </span>
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
