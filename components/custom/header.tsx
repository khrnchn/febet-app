"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { cn } from "@/lib/utils"

const navigationItems = [
    { href: "/", label: "Deliveries" },
    { href: "/history", label: "History" },
    { href: "/report", label: "Report" },
] as const

export default function Header() {
    const pathname = usePathname()

    return (
        <header className="border-b">
            <div className="flex h-14 items-center px-4">
                <NavigationMenu>
                    <NavigationMenuList>
                        {navigationItems.map((item) => (
                            <NavigationMenuItem key={item.href}>
                                <Link href={item.href} passHref>
                                    <NavigationMenuLink className={cn(
                                        navigationMenuTriggerStyle(),
                                        pathname === item.href && "bg-primary text-primary-foreground"
                                    )}>
                                        {item.label}
                                    </NavigationMenuLink>
                                </Link>
                            </NavigationMenuItem>
                        ))}
                    </NavigationMenuList>
                </NavigationMenu>
            </div>
        </header>
    )
}