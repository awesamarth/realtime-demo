// src/components/SimpleNetworkSelector.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Network {
  id: string
  name: string
  color: string
  chainId: number
  endpoint: string
}

export const NETWORKS: Network[] = [
  { 
    id: 'select', 
    name: 'Select Network', 
    color: 'gray',
    chainId: 0,
    endpoint: ''
  },
  { 
    id: 'megaeth', 
    name: 'MegaETH', 
    color: 'yellow',
    chainId: 6342,
    endpoint: 'realtime_sendRawTransaction'
  },
  { 
    id: 'rise', 
    name: 'RISE', 
    color: 'purple',
    chainId: 11155931,
    endpoint: 'eth_sendRawTransactionSync'
  },
  { 
    id: 'abstract', 
    name: 'Abstract', 
    color: 'green',
    chainId: 11124,
    endpoint: 'zks_sendRawTransactionWithDetailedOutput'
  }
]

interface SimpleNetworkSelectorProps {
  selectedNetwork: Network
  onSelectNetwork: (network: Network) => void
  disabled?: boolean
}

export function SimpleNetworkSelector({
  selectedNetwork,
  onSelectNetwork,
  disabled = false
}: SimpleNetworkSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const getNetworkColors = (color: string) => {
    switch (color) {
      case 'yellow': 
        return {
          text: '#f5f5dc',
          border: '#f5f5dc',
          bg: 'rgba(245, 245, 220, 0.1)',
          hoverBg: 'rgba(245, 245, 220, 0.2)',
          dot: '#f5f5dc'
        }
      case 'purple': 
        return {
          text: '#8b7cf6',
          border: '#8b7cf6', 
          bg: 'rgba(139, 124, 246, 0.1)',
          hoverBg: 'rgba(139, 124, 246, 0.2)',
          dot: '#8b7cf6'
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

  if (!mounted) return null

  const colors = getNetworkColors(selectedNetwork.color)

return (
  <div className="relative w-80" ref={dropdownRef}> {/* Fixed width instead of w-full max-w-sm */}
    <button
      onClick={() => !disabled && setIsOpen(!isOpen)}
      disabled={disabled}
      className={cn(
        "w-full flex items-center justify-between px-4 py-3 border-2 rounded-xl transition-all duration-200 font-medium min-w-0", // Added min-w-0
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && "hover:cursor-pointer hover:scale-[1.02]"
      )}
      style={{
        color: colors.text,
        borderColor: colors.border,
        backgroundColor: colors.bg,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = colors.hoverBg
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = colors.bg
        }
      }}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1"> {/* Added min-w-0 flex-1 */}
        <div 
          className="w-3 h-3 rounded-full flex-shrink-0" 
          style={{ backgroundColor: colors.dot }}
        />
        <span className="text-base font-semibold truncate">{selectedNetwork.name}</span> {/* Added truncate */}
      </div>
      <ChevronDown 
        size={18} 
        className={cn("transition-transform duration-200 flex-shrink-0 ml-2", isOpen && "rotate-180")} 
        style={{ color: colors.text }}
      />
    </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden backdrop-blur-sm">
          {NETWORKS.map((network) => {
            const networkColors = getNetworkColors(network.color)
            return (
              <button
                key={network.id}
                onClick={() => {
                  onSelectNetwork(network)
                  setIsOpen(false)
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150",
                  "hover:bg-gray-50 dark:hover:bg-gray-800",
                  selectedNetwork.id === network.id && "bg-gray-100 dark:bg-gray-700"
                )}
              >
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: networkColors.dot }}
                />
                <div className="flex-1 min-w-0">
                  <div 
                    className="font-semibold text-sm"
                    style={{ color: networkColors.text }}
                  >
                    {network.name}
                  </div>
                  {network.endpoint && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {network.endpoint}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}