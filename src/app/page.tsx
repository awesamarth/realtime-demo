// src/app/test-megaeth/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { createWalletClient, http, publicActions, Hex } from 'viem'
import { megaethTestnet, abstractTestnet, riseTestnet } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { SimpleNetworkSelector, NETWORKS, Network } from '@/components/SimpleNetworkSelector'
import { eip712WalletActions } from 'viem/zksync'
import { Loader2, Zap } from 'lucide-react'

interface PreSignedPool {
  transactions: string[]
  currentIndex: number
  baseNonce: number
  isRefilling: boolean
}

export default function TestRealtimeEndpoints() {
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(NETWORKS[0])
  const [isInitializing, setIsInitializing] = useState(false)
  const [preSignedPool, setPreSignedPool] = useState<PreSignedPool | null>(null)
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isExecuting, setIsExecuting] = useState(false)

  // Cache clients to avoid recreation
  const clientCache = useRef<Record<string, any>>({})

  const foundryAccount = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')

  const CONTRACT_ADDRESSES = {
    megaeth: "0x0D0ba0Ea8d031d093eA36c1A1176B066Fd08fadB",
    rise: "0x06dA3169CfEA164E8308b5977D89E296e75FB62D",
    abstract: "0x67106EaCAf99c93DB14921b9577098eB24369592"
  }

  const getChainConfig = (networkId: string) => {
    switch (networkId) {
      case 'megaeth': return megaethTestnet
      case 'rise': return riseTestnet
      case 'abstract': return abstractTestnet
      default: return megaethTestnet
    }
  }

  const getRpcUrl = (networkId: string) => {
    switch (networkId) {
      case 'megaeth': return 'https://carrot.megaeth.com/rpc'
      case 'rise': return 'https://testnet.riselabs.xyz/'
      case 'abstract': return 'https://api.testnet.abs.xyz'
      default: return 'https://carrot.megaeth.com/rpc'
    }
  }

  // Create and cache client
  const getNetworkClient = (networkId: string) => {
    if (networkId === 'select') return null

    // Return cached client if exists
    if (clientCache.current[networkId]) {
      return clientCache.current[networkId]
    }

    const client = createWalletClient({
      account: foundryAccount,
      chain: getChainConfig(networkId),
      transport: http(getRpcUrl(networkId)),
    }).extend(publicActions)

    // Extend with zkSync actions for Abstract
    const finalClient = networkId === 'abstract' ? client.extend(eip712WalletActions()) : client

    // Cache the client
    clientCache.current[networkId] = finalClient
    return finalClient
  }

  // Fixed refill function
  const refillPool = async (networkId: string) => {
    try {
      setPreSignedPool(prev => {
        if (!prev || prev.isRefilling) return prev
        return { ...prev, isRefilling: true }
      })

      const client = getNetworkClient(networkId)
      if (!client) return

      console.log(`🔄 Refilling pool for ${networkId}...`)

      const currentPool = preSignedPool!
      const nextNonce = currentPool.baseNonce + currentPool.transactions.length

      // Use same gas logic as initialization
      let gasPrice: bigint
      let gasLimit: bigint

      try {
        const networkGasPrice = await client.getGasPrice()

        switch (networkId) {
          case 'megaeth':
            gasPrice = networkGasPrice / 2n
            gasLimit = 50000n
            break
          case 'rise':
            gasPrice = networkGasPrice / 10n
            gasLimit = 50000n
            break
          case 'abstract':
            gasPrice = networkGasPrice
            gasLimit = 200000n
            break
          default:
            gasPrice = networkGasPrice / 2n
            gasLimit = 50000n
        }
      } catch (gasError) {
        // Same fallback logic
        switch (networkId) {
          case 'megaeth':
            gasPrice = 1000000000n
            gasLimit = 50000n
            break
          case 'rise':
            gasPrice = 100000000n
            gasLimit = 50000n
            break
          case 'abstract':
            gasPrice = 50000000000n
            gasLimit = 200000n
            break
          default:
            gasPrice = 1000000000n
            gasLimit = 50000n
        }
      }

      // Pre-sign 5 more transactions
      const signingPromises = Array.from({ length: 5 }, async (_, i) => {
        return await client.signTransaction({
          account: foundryAccount,
          to: CONTRACT_ADDRESSES[networkId as keyof typeof CONTRACT_ADDRESSES] as `0x${string}`,
          data: '0xa2e62045',
          nonce: nextNonce + i,
          maxFeePerGas: gasPrice,
          maxPriorityFeePerGas: gasPrice / 10n,
          value: 0n,
          type: 'eip1559' as const,
          gas: gasLimit,
        })
      })

      const newTransactions = await Promise.all(signingPromises)

      setPreSignedPool(prev => {
        if (!prev) return null
        return {
          ...prev,
          transactions: [...prev.transactions, ...newTransactions],
          isRefilling: false
        }
      })

      console.log(`✅ Added 5 more transactions. Total: ${currentPool.transactions.length + 5}`)

    } catch (error) {
      console.error('❌ Failed to refill pool:', error)
      setPreSignedPool(prev => prev ? { ...prev, isRefilling: false } : null)
    }
  }

  const initializeNetwork = async (networkId: string) => {
    if (networkId === 'select') return

    setIsInitializing(true)
    setError('')
    setPreSignedPool(null)

    try {
      const client = getNetworkClient(networkId)
      if (!client) throw new Error('Failed to create client')

      console.log(`🚀 Initializing ${selectedNetwork.name} with pre-signed transactions...`)

      const nonce = await client.getTransactionCount({
        address: foundryAccount.address
      })

      // Get actual gas price from network and apply smart adjustments
      let gasPrice: bigint
      let gasLimit: bigint

      try {
        const networkGasPrice = await client.getGasPrice()

        // Apply conservative multipliers for testnets
        switch (networkId) {
          case 'megaeth':
            gasPrice = networkGasPrice / 2n // Use half the network gas price
            gasLimit = 50000n
            console.log(`🔥 MegaETH - Network: ${networkGasPrice}, Using: ${gasPrice}`)
            break
          case 'rise':
            gasPrice = networkGasPrice / 10n // Use 1/10th for RISE testnet
            gasLimit = 50000n
            console.log(`⚡ RISE - Network: ${networkGasPrice}, Using: ${gasPrice}`)
            break
          case 'abstract':
            gasPrice = networkGasPrice
            gasLimit = 200000n
            console.log(`🔮 Abstract - Network: ${networkGasPrice}, Using: ${gasPrice}`)
            break
          default:
            gasPrice = networkGasPrice / 2n
            gasLimit = 50000n
        }

        console.log(`📊 Gas config - Price: ${gasPrice}, Limit: ${gasLimit}`)

      } catch (gasError) {
        console.warn('⚠️ Failed to get gas price, using fallback:', gasError)
        // Fallback to very low prices for testnets
        switch (networkId) {
          case 'megaeth':
            gasPrice = 1000000000n // 1 gwei
            gasLimit = 50000n
            break
          case 'rise':
            gasPrice = 100000000n // 0.1 gwei
            gasLimit = 50000n
            break
          case 'abstract':
            gasPrice = 50000000000n // 50 gwei
            gasLimit = 200000n
            break
          default:
            gasPrice = 1000000000n
            gasLimit = 50000n
        }
        console.log(`🔄 Using fallback gas - Price: ${gasPrice}, Limit: ${gasLimit}`)
      }

      // Pre-sign 10 transactions initially
      console.log(`🔐 Pre-signing 10 transactions...`)
      const signingPromises = Array.from({ length: 10 }, async (_, i) => {
        return await client.signTransaction({
          account: foundryAccount,
          to: CONTRACT_ADDRESSES[networkId as keyof typeof CONTRACT_ADDRESSES] as `0x${string}`,
          data: '0xa2e62045',
          nonce: nonce + i,
          maxFeePerGas: gasPrice,
          maxPriorityFeePerGas: gasPrice / 10n, // 10% tip
          value: 0n,
          type: 'eip1559' as const,
          gas: gasLimit,
        })
      })

      const transactions = await Promise.all(signingPromises)

      setPreSignedPool({
        transactions,
        currentIndex: 0,
        baseNonce: nonce,
        isRefilling: false
      })

      // Calculate total cost for user info
      const totalCostPerTx = gasLimit * gasPrice
      const totalCostFor10Tx = totalCostPerTx * 10n
      const costInEth = Number(totalCostFor10Tx) / 1e18

      console.log(`✅ Pre-signed 10 transactions for ${selectedNetwork.name}`)
      console.log(`💰 Cost per tx: ${Number(totalCostPerTx) / 1e18} ETH`)
      console.log(`💰 Total cost for 10 tx: ${costInEth} ETH`)

    } catch (err: any) {
      console.error('❌ Error initializing network:', err)
      setError(`Failed to initialize ${selectedNetwork.name}: ${err.message}`)
    } finally {
      setIsInitializing(false)
    }
  }

  // Fixed execution with proper refill trigger
  const executeTransaction = async () => {
    if (!preSignedPool || preSignedPool.currentIndex >= preSignedPool.transactions.length) {
      setError('No pre-signed transactions available')
      return
    }

    setIsExecuting(true)
    setError('')
    setResult('')

    try {
      const client = getNetworkClient(selectedNetwork.id)
      if (!client) throw new Error('Failed to create client')

      const signedTx = preSignedPool.transactions[preSignedPool.currentIndex]

      // ADD THIS DEBUG LOGGING 🔍
      console.log(`🔍 Using transaction index: ${preSignedPool.currentIndex}`)
      console.log(`🔍 Total transactions in pool: ${preSignedPool.transactions.length}`)
      console.log(`🔍 Base nonce: ${preSignedPool.baseNonce}`)
      console.log(`🔍 Expected nonce for this tx: ${preSignedPool.baseNonce + preSignedPool.currentIndex}`)
      console.log(`🔍 Transaction hash preview: ${signedTx.slice(0, 20)}...`)

      console.log(`⚡ Executing with ${selectedNetwork.endpoint}...`)

      const startTime = performance.now()

      const result = await client.request({
        //@ts-ignore
        method: selectedNetwork.endpoint,
        params: [signedTx]
      })

      const endTime = performance.now()
      const timeTaken = Math.round(endTime - startTime)

      console.log(`✅ ${selectedNetwork.name} result:`, result)
      console.log(`⏱️  Time taken: ${timeTaken}ms`)

      // Update pool index and check for refill AFTER state update
      setPreSignedPool(prev => {
        if (!prev) return null

        const newCurrentIndex = prev.currentIndex + 1
        const availableAfterThis = prev.transactions.length - newCurrentIndex

        // Trigger refill when we have 3 or fewer transactions left
        if (availableAfterThis <= 3 && !prev.isRefilling) {
          console.log(`🔔 Triggering refill at ${availableAfterThis} transactions remaining`)
          // Use setTimeout to avoid blocking the current state update
          setTimeout(() => refillPool(selectedNetwork.id), 0)
        }

        return {
          ...prev,
          currentIndex: newCurrentIndex
        }
      })

      setResult(`Success! Hash: ${result}, Time: ${timeTaken}ms`)

    } catch (err: any) {
      console.error('❌ Error executing:', err)
      setError(err.message)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleNetworkChange = (network: Network) => {
    setSelectedNetwork(network)
    setPreSignedPool(null)
    setResult('')
    setError('')

    // Clear client cache when switching networks
    clientCache.current = {}

    if (network.id !== 'select') {
      initializeNetwork(network.id)
    }
  }

  const availableTransactions = preSignedPool ? preSignedPool.transactions.length - preSignedPool.currentIndex : 0

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-2 text-black dark:text-white">
        Realtime Blockchain Endpoints
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8 text-center max-w-2xl">
        Compare the performance of different blockchain networks' realtime transaction endpoints
      </p>

      {/* Network Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          Select Network
        </label>
        <SimpleNetworkSelector
          selectedNetwork={selectedNetwork}
          onSelectNetwork={handleNetworkChange}
          disabled={isInitializing || isExecuting}
        />
      </div>

      {/* Endpoint Highlight */}
      {selectedNetwork.id !== 'select' && (
        <div className="mb-8 p-6 border-2 border-dashed border-blue-500/30 rounded-xl bg-blue-500/5 max-w-lg text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="text-blue-500" size={20} />
            <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400">
              Realtime Endpoint
            </h3>
          </div>
          <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-blue-700 dark:text-blue-300">
            {selectedNetwork.endpoint}
          </code>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            This endpoint is designed for ultra-low latency transaction submission
          </p>
        </div>
      )}

      {/* Initialization Status */}
      {isInitializing && (
        <div className="mb-6 flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <Loader2 className="animate-spin" size={20} />
          <span>Pre-signing transactions for {selectedNetwork.name}...</span>
        </div>
      )}



      {/* Execute Button */}
      <div className="mb-8">
        <button
          onClick={executeTransaction}
          disabled={isExecuting || isInitializing || !preSignedPool || availableTransactions === 0 || selectedNetwork.id === 'select'}
          className="px-8 py-4 hover:cursor-pointer bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg transition-all duration-200 hover:scale-105"
        >
          {isExecuting ? (
            <>
              <Loader2 className="animate-spin inline mr-2" size={20} />
              Testing {selectedNetwork.name}...
            </>
          ) : (
            `Test ${selectedNetwork.name === "Select Network" ? "" : selectedNetwork.name} Endpoint`
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="mb-6 p-4 bg-green-100 dark:bg-green-900 rounded-lg max-w-2xl">
          <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
            ✅ Transaction Successful
          </h3>
          <p className="text-green-700 dark:text-green-300">
            {result}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 rounded-lg max-w-2xl">
          <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
            ❌ Error
          </h3>
          <p className="text-red-700 dark:text-red-300 break-all">
            {error}
          </p>
        </div>
      )}

      {/* Network Info */}
      {selectedNetwork.id !== 'select' && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center space-y-1">
          <p>Contract: {CONTRACT_ADDRESSES[selectedNetwork.id as keyof typeof CONTRACT_ADDRESSES]}</p>
          <p>Chain: {selectedNetwork.name} ({selectedNetwork.chainId})</p>
        </div>
      )}
    </div>
  )
}