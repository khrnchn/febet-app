'use client'

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Car, Package, Bus, Truck } from "lucide-react"

interface VehicleOptionsProps {
    selectedVehicle: string
    onVehicleChange: (value: string) => void
}

export default function VehicleOptions({ selectedVehicle, onVehicleChange }: VehicleOptionsProps) {
    return (
        <div className="mb-6">
            <h2 className="text-sm text-gray-500 mb-2">VEHICLE TYPE</h2>
            <RadioGroup
                defaultValue="car"
                value={selectedVehicle}
                onValueChange={onVehicleChange}
                className="grid grid-cols-4 gap-2"
            >
                <div>
                    <RadioGroupItem
                        value="car"
                        id="car"
                        className="peer sr-only"
                    />
                    <Label
                        htmlFor="car"
                        className={cn(
                            "flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer",
                        )}
                    >
                        <Car className="mb-2 h-6 w-6" />
                        <p className="text-sm font-medium">Car</p>
                        <p className="text-xs text-muted-foreground">0.5 x 0.5 x 0.5 Meter</p>
                        <p className="text-xs text-muted-foreground">40 kg</p>
                    </Label>
                </div>

                <div>
                    <RadioGroupItem
                        value="pickup"
                        id="pickup"
                        className="peer sr-only"
                    />
                    <Label
                        htmlFor="pickup"
                        className={cn(
                            "flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer",
                        )}
                    >
                        <Package className="mb-2 h-6 w-6" />
                        <p className="text-sm font-medium">Pickup (4x4)</p>
                        <p className="text-xs text-muted-foreground">1.5 x 1.5 x 1.5 Meter</p>
                        <p className="text-xs text-muted-foreground">800 kg</p>
                    </Label>
                </div>

                <div>
                    <RadioGroupItem
                        value="van7"
                        id="van7"
                        className="peer sr-only"
                    />
                    <Label
                        htmlFor="van7"
                        className={cn(
                            "flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer",
                        )}
                    >
                        <Bus className="mb-2 h-6 w-6" />
                        <p className="text-sm font-medium">Van 7-ft</p>
                        <p className="text-xs text-muted-foreground">2.1 x 1.6 x 1.4 Meter</p>
                        <p className="text-xs text-muted-foreground">1000 kg</p>
                    </Label>
                </div>

                <div>
                    <RadioGroupItem
                        value="van9"
                        id="van9"
                        className="peer sr-only"
                    />
                    <Label
                        htmlFor="van9"
                        className={cn(
                            "flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer",
                        )}
                    >
                        <Truck className="mb-2 h-6 w-6" />
                        <p className="text-sm font-medium">Large Van 9-ft</p>
                        <p className="text-xs text-muted-foreground">2.7 x 1.6 x 1.8 Meter</p>
                        <p className="text-xs text-muted-foreground">2000 kg</p>
                    </Label>
                </div>
            </RadioGroup>
        </div>
    )
}
