"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Settings, LogOut, User, LayoutDashboard, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Profile {
    name: string;
    email: string;
    avatar?: string | null;
    role?: string;
}

interface MenuItem {
    label: string;
    value?: string;
    href: string;
    icon: React.ReactNode;
    external?: boolean;
}

interface ProfileDropdownProps extends React.HTMLAttributes<HTMLDivElement> {
    data: Profile;
    isAdmin?: boolean;
    signOutAction: () => Promise<void>;
}

export default function ProfileDropdown({
    data,
    isAdmin = false,
    signOutAction,
    className,
    ...props
}: ProfileDropdownProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    
    const menuItems: MenuItem[] = [
        {
            label: "Dashboard",
            href: "/user/profile",
            icon: <LayoutDashboard className="w-4 h-4" />,
        },
        {
            label: "Profile",
            href: "/user/profile",
            icon: <User className="w-4 h-4" />,
        },
        ...(isAdmin ? [{
            label: "Admin",
            href: "/admin/overview",
            icon: <ShieldCheck className="w-4 h-4" />,
            value: "Admin",
        }] : []),
        {
            label: "Settings",
            href: "/user/profile",
            icon: <Settings className="w-4 h-4" />,
        },
    ];

    const firstInitial = data.name?.charAt(0)?.toUpperCase() ?? "U";

    return (
        <div className={cn("relative", className)} {...props}>
            <DropdownMenu onOpenChange={setIsOpen}>
                <div className="group relative">
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className="flex items-center gap-2 p-1.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 hover:shadow-sm transition-all duration-200 focus:outline-none"
                        >
                            <div className="relative">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-0.5">
                                    <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-zinc-900 flex items-center justify-center">
                                        {data.avatar ? (
                                            <Image
                                                src={data.avatar}
                                                alt={data.name}
                                                width={32}
                                                height={32}
                                                className="w-full h-full object-cover rounded-full"
                                            />
                                        ) : (
                                            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                                                {firstInitial}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </button>
                    </DropdownMenuTrigger>

                    {/* Animated indicator */}
                    <div
                        className={cn(
                            "absolute -right-1 top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none",
                            isOpen
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-60"
                        )}
                    >
                        <svg
                            width="8"
                            height="16"
                            viewBox="0 0 8 16"
                            fill="none"
                            className={cn(
                                "transition-all duration-200",
                                isOpen
                                    ? "text-purple-500 dark:text-purple-400 scale-110"
                                    : "text-zinc-400 dark:text-zinc-500"
                            )}
                            aria-hidden="true"
                        >
                            <path
                                d="M1 2C4 5 4 11 1 14"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                fill="none"
                            />
                        </svg>
                    </div>

                    <DropdownMenuContent
                        align="end"
                        sideOffset={8}
                        className="w-64 p-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl shadow-xl shadow-zinc-900/5 dark:shadow-zinc-950/20"
                    >
                        {/* Profile Header */}
                        <div className="px-3 py-2 mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-0.5 flex-shrink-0">
                                    <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-zinc-900 flex items-center justify-center">
                                        {data.avatar ? (
                                            <Image
                                                src={data.avatar}
                                                alt={data.name}
                                                width={36}
                                                height={36}
                                                className="w-full h-full object-cover rounded-full"
                                            />
                                        ) : (
                                            <span className="text-base font-semibold text-zinc-700 dark:text-zinc-200">
                                                {firstInitial}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                        {data.name}
                                    </p>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                        {data.email}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <DropdownMenuSeparator className="my-2 bg-gradient-to-r from-transparent via-zinc-200 to-transparent dark:via-zinc-800" />

                        <div className="space-y-1">
                            {menuItems.map((item) => (
                                <DropdownMenuItem key={item.label} asChild>
                                    <Link
                                        href={item.href}
                                        className="flex items-center p-2.5 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 rounded-xl transition-all duration-200 cursor-pointer group hover:shadow-sm border border-transparent hover:border-zinc-200/50 dark:hover:border-zinc-700/50"
                                    >
                                        <div className="flex items-center gap-2.5 flex-1">
                                            <span className="text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                                                {item.icon}
                                            </span>
                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 tracking-tight leading-tight whitespace-nowrap group-hover:text-zinc-900 dark:group-hover:text-zinc-50 transition-colors">
                                                {item.label}
                                            </span>
                                        </div>
                                        <div className="flex-shrink-0 ml-auto">
                                            {item.value && (
                                                <span className="text-xs font-medium rounded-md py-1 px-2 tracking-tight text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/10 border border-purple-500/10">
                                                    {item.value}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                        </div>

                        <DropdownMenuSeparator className="my-2 bg-gradient-to-r from-transparent via-zinc-200 to-transparent dark:via-zinc-800" />

                        <DropdownMenuItem asChild>
                            <form action={signOutAction} className="w-full">
                                <button
                                    type="submit"
                                    className="w-full flex items-center gap-2.5 p-2.5 duration-200 bg-red-500/10 rounded-xl hover:bg-red-500/20 cursor-pointer border border-transparent hover:border-red-500/30 hover:shadow-sm transition-all group"
                                >
                                    <LogOut className="w-4 h-4 text-red-500 group-hover:text-red-600" />
                                    <span className="text-sm font-medium text-red-500 group-hover:text-red-600">
                                        Sign Out
                                    </span>
                                </button>
                            </form>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </div>
            </DropdownMenu>
        </div>
    );
}
