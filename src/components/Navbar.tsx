// src/components/Navbar.tsx
'use client'

import Link from 'next/link'
import { useTheme } from 'next-themes'
import { Sun, Moon, Copy, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { createWalletClient, http, publicActions } from 'viem'
import { megaethTestnet, riseTestnet } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { eip712WalletActions } from 'viem/zksync'
import { NETWORKS } from '@/components/SimpleNetworkSelector'

interface NavbarProps {
 onRefreshReady?: (refreshFn: () => void) => void
}

interface NetworkBalances {
 megaeth: string
 rise: string
}

export default function Navbar({ onRefreshReady }: NavbarProps) {
 const { theme, setTheme } = useTheme()
 const [mounted, setMounted] = useState(false)
 const [balances, setBalances] = useState<NetworkBalances>({
   megaeth: '0',
   rise: '0',
 })
 const [copied, setCopied] = useState(false)
 const [isLoadingBalances, setIsLoadingBalances] = useState(false)

 const foundryAccount = privateKeyToAccount(process.env.NEXT_PUBLIC_FOUNDRY_DEFAULT_PRIVATE_KEY as `0x${string}`)

 const NETWORK_CONFIGS = {
   megaeth: {
     chain: megaethTestnet,
     rpc: 'https://carrot.megaeth.com/rpc',
     color: 'text-purple-500'
   },
   rise: {
     chain: riseTestnet,
     rpc: 'https://testnet.riselabs.xyz/',
     color: 'text-blue-500'
   }
 }

 const getNetworkColors = (color: string) => {
   switch (color) {
     case 'yellow': 
       return {
         text: '#d97706',
         border: '#d97706',
         bg: 'rgba(217, 119, 6, 0.1)',
         hoverBg: 'rgba(217, 119, 6, 0.2)',
         dot: '#d97706'
       }
     case 'purple': 
       return {
         text: '#8b7cf6',
         border: '#8b7cf6', 
         bg: 'rgba(139, 124, 246, 0.1)',
         hoverBg: 'rgba(139, 124, 246, 0.2)',
         dot: '#8b7cf6'
       }
     case 'blue': 
       return {
         text: '#3b82f6',
         border: '#3b82f6',
         bg: 'rgba(59, 130, 246, 0.1)',
         hoverBg: 'rgba(59, 130, 246, 0.2)',
         dot: '#3b82f6'
       }
     case 'green': 
       return {
         text: '#10b981',
         border: '#10b981',
         bg: 'rgba(16, 185, 129, 0.1)', 
         hoverBg: 'rgba(16, 185, 129, 0.2)',
         dot: '#10b981'
       }
     case 'gray':
     default:
       return {
         text: '#9ca3af',
         border: '#9ca3af',
         bg: 'rgba(156, 163, 175, 0.1)',
         hoverBg: 'rgba(156, 163, 175, 0.2)',
         dot: '#9ca3af'
       }
   }
 }

 useEffect(() => {
   setMounted(true)
   fetchBalances()

   // Refresh every 10 seconds
   const interval = setInterval(fetchBalances, 15000)
   return () => clearInterval(interval)
 }, [])


 const getNetworkClient = (networkId: keyof typeof NETWORK_CONFIGS) => {
   const config = NETWORK_CONFIGS[networkId]
   const client = createWalletClient({
     account: foundryAccount,
     chain: config.chain,
     transport: http(config.rpc),
   }).extend(publicActions)

   return client
 }

 const fetchBalances = async () => {
   setIsLoadingBalances(true)
   try {
     const balancePromises = Object.keys(NETWORK_CONFIGS).map(async (networkId) => {
       try {
         const client = getNetworkClient(networkId as keyof typeof NETWORK_CONFIGS)
         const balance = await client.getBalance({
           address: foundryAccount.address
         })
         const balanceInEth = Number(balance) / 1e18
         return [networkId, balanceInEth.toFixed(4)]
       } catch (error) {
         console.error(`Failed to fetch ${networkId} balance:`, error)
         return [networkId, '0.0000']
       }
     })

     const results = await Promise.all(balancePromises)
     const newBalances = Object.fromEntries(results) as NetworkBalances
     setBalances(newBalances)
   } catch (error) {
     console.error('Failed to fetch balances:', error)
   } finally {
     setIsLoadingBalances(false)
   }
 }

 useEffect(() => {
   fetchBalances()
   onRefreshReady?.(fetchBalances)
 }, [onRefreshReady])

 const copyAddress = async () => {
   try {
     await navigator.clipboard.writeText(foundryAccount.address)
     setCopied(true)
     setTimeout(() => setCopied(false), 2000)
   } catch (error) {
     console.error('Failed to copy address:', error)
   }
 }

 const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')
 const isLight = mounted && theme === 'light'

 const truncateAddress = (address: string) => {
   return `${address.slice(0, 6)}...${address.slice(-4)}`
 }

 return (
   <nav className={cn(
     "w-full fixed top-0 z-50 py-4 px-6 md:px-12 flex items-center justify-between border-b transition-colors duration-300",
     isLight
       ? "bg-white border-black/10"
       : "bg-black border-white/10"
   )}>
     {/* Left - Logo */}
     <Link href="/" className="flex items-center">
       <span className={cn(
         "text-2xl font-bold",
         isLight ? "text-black" : "text-white"
       )}>
         Realtime Demo
       </span>
     </Link>

     {/* Right - Balances, Address, Theme Toggle */}
     <div className="flex items-center gap-4">
       {/* Network Balances */}
       <div className="flex items-center gap-2">
         {Object.entries(NETWORK_CONFIGS).map(([networkId, config]) => {
           const network = NETWORKS.find(n => n.id === networkId)
           const colors = getNetworkColors(network?.color || 'gray')
           
           const faucetUrls = {
             megaeth: 'https://testnet.megaeth.com/',
             rise: 'https://faucet.testnet.riselabs.xyz/',
           }
           
           return (
             <Link
               key={networkId}
               href={faucetUrls[networkId as keyof typeof faucetUrls]}
               target="_blank"
               rel="noopener noreferrer"
               className={cn(
                 "hover:cursor-pointer flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm transition-all duration-200",
                 isLight
                   ? "bg-gray-50 border-gray-200 text-gray-700"
                   : "bg-gray-800 border-gray-700 text-gray-300"
               )}
               style={{
                 '--hover-bg': colors.bg,
                 '--hover-border': colors.border
               } as React.CSSProperties}
               onMouseEnter={(e) => {
                 e.currentTarget.style.backgroundColor = colors.hoverBg
                 e.currentTarget.style.borderColor = colors.border
               }}
               onMouseLeave={(e) => {
                 e.currentTarget.style.backgroundColor = isLight ? '#f9fafb' : '#1f2937'
                 e.currentTarget.style.borderColor = isLight ? '#e5e7eb' : '#374151'
               }}
             >
               <div 
                 className="w-2 h-2 rounded-full"
                 style={{ backgroundColor: colors.dot }}
               />
               <span className="font-medium">
                 {networkId === 'megaeth' ? 'MegaETH' : "RISE"}
               </span>
               <span className="font-mono">
                 {isLoadingBalances ? '...' : balances[networkId as keyof NetworkBalances]}
               </span>
             </Link>
           )
         })}
       </div>

       {/* Address - Distinguished with different styling */}
       <button
         onClick={copyAddress}
         className={cn(
           "flex items-center hover:cursor-pointer gap-2 px-4 py-2 rounded-lg border-2 transition-all font-mono text-sm font-medium",
           isLight
             ? "bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700"
             : "bg-blue-900/20 border-blue-700 hover:bg-blue-800/30 text-blue-300"
         )}
       >
         {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
         {truncateAddress(foundryAccount.address)}
       </button>

       {/* Theme Toggle */}
       <button
         onClick={toggleTheme}
         className={cn(
           "p-2 rounded-md transition-colors hover:cursor-pointer",
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