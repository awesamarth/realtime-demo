// src/components/Navbar.tsx
'use client'

import Link from 'next/link'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export default function Navbar() {
 const { theme, setTheme } = useTheme()
 const [mounted, setMounted] = useState(false)

 useEffect(() => {
   setMounted(true)
 }, [])

 const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')
 const isLight = mounted && theme === 'light'

 return (
   <nav className={cn(
     "w-full fixed top-0 z-50 py-4 px-6 md:px-12 flex items-center justify-between border-b transition-colors duration-300",
     isLight
       ? "bg-white border-black/10"
       : "bg-black border-white/10"
   )}>
     {/* Logo */}
     <Link href="/" className="flex items-center">
       <span className={cn(
         "text-2xl font-bold",
         isLight ? "text-black" : "text-white"
       )}>
         Realtime Demo
       </span>
     </Link>

     {/* Right side */}
     <div className="flex items-center gap-4">
       {/* Connect Wallet */}
       
       {/* Theme Toggle */}
       <button
         onClick={toggleTheme}
         className={cn(
           "p-2 rounded-md transition-colors",
           isLight
             ? "hover:bg-gray-100"
             : "hover:bg-gray-800"
         )}
       >
         {mounted && (isLight ? <Moon size={20} /> : <Sun size={20} />)}
       </button>
     </div>
   </nav>
 )
}