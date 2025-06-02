// src/components/Footer.tsx
'use client'

import Link from 'next/link'
import { Github } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export const Footer = () => {
    const { theme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const currentYear = new Date().getFullYear()

    useEffect(() => {
        setMounted(true)
    }, [])

    const isLight = mounted && theme === 'light'

    return (
        <footer className={cn(
            "w-full py-6 px-6 md:px-12 border-t transition-colors duration-300",
            isLight
                ? "bg-white border-black/10"
                : "bg-black border-white/10"
        )}>
            <div className="flex justify-between items-center">
                {/* Project name */}
                <div className={cn(
                    "text-sm",
                    isLight ? "text-gray-600" : "text-gray-400"
                )}>
                    © {currentYear} Realtime Demo
                </div>

                {/* GitHub link */}
                <Link
                    href="https://github.com/awesamarth/realtime-demo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                        "flex items-center gap-2 transition-colors",
                        isLight
                            ? "text-gray-600 hover:text-black"
                            : "text-gray-400 hover:text-white"
                    )}
                >
                    <Github size={16} className='self-center' />
                </Link>
            </div>
        </footer>
    )
}