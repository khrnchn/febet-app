'use client'

import { Checkbox } from "@/components/ui/checkbox"

interface AdditionalServicesProps {
    onDoorToDoorChange?: (checked: boolean) => void
    onRoundTripChange?: (checked: boolean) => void
}

export default function AdditionalServices({ 
    onDoorToDoorChange,
    onRoundTripChange 
}: AdditionalServicesProps) {
    return (
        <div className="mb-6">
            <h2 className="text-sm text-gray-500 mb-2">ADDITIONAL SERVICES</h2>
            <div className="space-y-4">
                <div className="flex items-center space-x-2">
                    <Checkbox 
                        id="door-to-door" 
                        onCheckedChange={onDoorToDoorChange}
                    />
                    <label
                        htmlFor="door-to-door"
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Door-to-door (loading & unloading by driver)
                    </label>
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox 
                        id="round-trip" 
                        onCheckedChange={onRoundTripChange}
                    />
                    <label
                        htmlFor="round-trip"
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Round trip
                    </label>
                </div>
            </div>
        </div>
    )
}
