"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Search, User, Settings, List } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const BottomNav = () => {
    const pathname = usePathname()

    const navigation = [
        { name: 'Home', href: '/', icon: Home },
        { name: 'History', href: '/history', icon: List },
        { name: 'Settings', href: '/settings', icon: Settings },
    ]

    return (
        <nav className="fixed bottom-0 left-0 z-50 w-full border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-around">
                {navigation.map((item) => {
                    const isActive = pathname === item.href
                    return (
                        <Button
                            key={item.name}
                            variant="ghost"
                            asChild
                            className={cn(
                                "flex flex-col h-auto py-2 px-1 hover:bg-transparent",
                                isActive && "text-primary"
                            )}
                        >
                            <Link href={item.href}>
                                <item.icon className="h-5 w-5" />
                                <span className="text-xs mt-1">{item.name}</span>
                            </Link>
                        </Button>
                    )
                })}
            </div>
        </nav>
    )
}

export default BottomNav