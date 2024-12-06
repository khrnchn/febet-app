'use client'

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

interface DeliveryOptionsProps {
    onOptionChange?: (value: string) => void
}

export default function DeliveryOptions({ onOptionChange }: DeliveryOptionsProps) {
    return (
        <div className="mt-auto">
            <RadioGroup 
                defaultValue="balanced" 
                className="grid grid-cols-3 gap-2 mt-auto"
                onValueChange={onOptionChange}
            >
                <div>
                    <RadioGroupItem value="fastest" id="fastest" className="peer sr-only" />
                    <Label
                        htmlFor="fastest"
                        className="flex flex-col p-3 rounded bg-gray-50 hover:bg-gray-100 peer-data-[state=checked]:bg-secondary peer-data-[state=checked]:border-2 peer-data-[state=checked]:border-primary"
                    >
                        <div className="flex items-center gap-1 mb-1">
                            <span>⚡</span>
                            <span className="text-sm">Fastest</span>
                        </div>
                        <p className="font-semibold">RM32.90</p>
                        <p className="text-xs text-gray-500">Priority delivery, minimal waiting</p>
                    </Label>
                </div>

                <div>
                    <RadioGroupItem value="cheapest" id="cheapest" className="peer sr-only" />
                    <Label
                        htmlFor="cheapest"
                        className="flex flex-col p-3 rounded bg-gray-50 hover:bg-gray-100 peer-data-[state=checked]:bg-secondary peer-data-[state=checked]:border-2 peer-data-[state=checked]:border-primary"
                    >
                        <div className="flex items-center gap-1 mb-1">
                            <span>💰</span>
                            <span className="text-sm">Cheapest</span>
                        </div>
                        <p className="font-semibold">RM21.90</p>
                        <p className="text-xs text-gray-500">Best value, longer waiting time</p>
                    </Label>
                </div>

                <div>
                    <RadioGroupItem value="balanced" id="balanced" className="peer sr-only" />
                    <Label
                        htmlFor="balanced"
                        className="flex flex-col p-3 rounded bg-gray-50 hover:bg-gray-100 peer-data-[state=checked]:bg-secondary peer-data-[state=checked]:border-2 peer-data-[state=checked]:border-primary"
                    >
                        <div className="flex items-center gap-1 mb-1">
                            <span>⚖️</span>
                            <span className="text-sm">Balanced</span>
                        </div>
                        <p className="font-semibold">RM26.90</p>
                        <p className="text-xs text-gray-500">Optimal mix of speed and cost</p>
                    </Label>
                </div>
            </RadioGroup>
        </div>
    )
}
