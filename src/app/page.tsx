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
  hasTriggeredRefill: boolean
}

export default function TestRealtimeEndpoints() {
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(NETWORKS[0])
  const [isInitializing, setIsInitializing] = useState(false)
  const [preSignedPool, setPreSignedPool] = useState<PreSignedPool | null>(null)
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [transactionHistory, setTransactionHistory] = useState<Array<{
    network: string
    hash: string
    time: number
  }>>([])

  // Cache clients to avoid recreation
  const clientCache = useRef<Record<string, any>>({})



  // ⚠️⚠️ WARNING: This is Foundry's well-known test private key used for demonstration only.
  // NEVER use your real private key in client-side code or commit it to version control!
  // This key is publicly known and should ONLY be used for testing purposes.
  const foundryAccount = privateKeyToAccount(process.env.NEXT_PUBLIC_FOUNDRY_DEFAULT_PRIVATE_KEY as `0x${string}`)

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

  const extendPool = async (networkId: string) => {
    try {
      setPreSignedPool(prev => {
        if (!prev || prev.isRefilling) return prev
        return { ...prev, isRefilling: true }
      })

      const client = getNetworkClient(networkId)
      if (!client) return

      console.log(`Extending pool for ${networkId}...`)

      const currentPool = preSignedPool!
      const nextNonce = currentPool.baseNonce + currentPool.transactions.length

      // Use same gas logic as initialization
      let gasPrice: bigint
      let gasLimit: bigint

      try {
        const networkGasPrice = await client.getGasPrice()

        switch (networkId) {
          case 'megaeth':
            gasPrice = networkGasPrice
            gasLimit = 100000n
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

      // Pre-sign 10 more transactions
      const signingPromises = Array.from({ length: 10 }, async (_, i) => {
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

      // EXTEND the pool (append new transactions)
      setPreSignedPool(prev => {
        if (!prev) return null
        return {
          ...prev,
          transactions: [...prev.transactions, ...newTransactions],
          isRefilling: false,
          hasTriggeredRefill: false  // Reset flag for next refill
        }
      })

      console.log(`✅ Extended pool with 10 more transactions. Total: ${currentPool.transactions.length + 10}`)

    } catch (error) {
      console.error('❌ Failed to extend pool:', error)
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
        address: foundryAccount.address,

      })



      // Get actual gas price from network and apply smart adjustments
      let gasPrice: bigint
      let gasLimit: bigint

      try {
        const networkGasPrice = await client.getGasPrice()

        // Apply conservative multipliers for testnets
        switch (networkId) {
          case 'megaeth':
            gasPrice = networkGasPrice
            gasLimit = 100000n
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
        console.log(`Using fallback gas - Price: ${gasPrice}, Limit: ${gasLimit}`)
      }

      // Pre-sign 10 transactions initially
      console.log(`Pre-signing 10 transactions...`)
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
        isRefilling: false,
        hasTriggeredRefill: false
      })

      // Calculate total cost for user info
      const totalCostPerTx = gasLimit * gasPrice
      const totalCostFor10Tx = totalCostPerTx * 10n
      const costInEth = Number(totalCostFor10Tx) / 1e18

      console.log(`Pre-signed 10 transactions for ${selectedNetwork.name}`)

    } catch (err: any) {
      console.error('Error initializing network:', err)
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



      const startTime = performance.now()

      const result = await client.request({
        //@ts-ignore
        method: selectedNetwork.endpoint,
        params: [signedTx]
      })


      const endTime = performance.now()
      const timeTaken = Math.round(endTime - startTime)
      console.log("result: ", result)


      setPreSignedPool(prev => {
        if (!prev) return null

        const newCurrentIndex = prev.currentIndex + 1

        // Refill every 5 transactions (50% of initial 10), but only once per batch
        if (newCurrentIndex % 5 === 0 && !prev.hasTriggeredRefill) {
          console.log(`🔔 Triggering refill at ${newCurrentIndex} transactions used`)
          setTimeout(() => extendPool(selectedNetwork.id), 0)
          return {
            ...prev,
            currentIndex: newCurrentIndex,
            hasTriggeredRefill: true  // Only set this when we actually trigger refill
          }
        }

        return {
          ...prev,
          currentIndex: newCurrentIndex
        }
      })

      setResult(`Hash: ${result?.transactionHash}\nTime: ${timeTaken}ms`)
      setTransactionHistory(prev => [
        {
          network: selectedNetwork.name,
          hash: result?.transactionHash || 'N/A',
          time: timeTaken
        },
        ...prev.slice(0, 9) // Keep only last 10
      ])

    } catch (err: any) {
      console.error('❌ Error executing:', err)
      setError(err.message)
    } finally {
      setIsExecuting(false)
    }
  }

  const clearHistory = () => {
    setTransactionHistory([])
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
    <div className="flex flex-col items-center justify-start min-h-screen pt-28 p-8">
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

      {result && (
        <div className="mb-6 p-4 bg-green-100 dark:bg-green-900 rounded-lg max-w-2xl">
          <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
            ✅ Transaction Successful
          </h3>
          <div className="text-green-700 dark:text-green-300 space-y-2">
            {result.split('\n').map((line, index) => {
              if (line.startsWith('Hash:')) {
                const hash = line.replace('Hash: ', '')
                const getExplorerUrl = (networkId: string, hash: string) => {
                  switch (networkId) {
                    case 'abstract': return `https://explorer.testnet.abs.xyz/tx/${hash}`
                    case 'megaeth': return `https://www.megaexplorer.xyz/tx/${hash}`
                    case 'rise': return `https://explorer.testnet.riselabs.xyz/tx/${hash}`
                    default: return '#'
                  }
                }

                return (
                  <div key={index}>
                    <span>Hash: </span>
                    <a
                      href={getExplorerUrl(selectedNetwork.id, hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 font-mono break-all"
                    >
                      {hash}
                    </a>
                  </div>
                )
              }
              return <p key={index}>{line}</p>
            })}
          </div>
        </div>
      )
      }

      {
        error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 rounded-lg max-w-2xl">
            <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
              ❌ Error
            </h3>
            <p className="text-red-700 dark:text-red-300 break-all">
              {error}
            </p>
          </div>
        )
      }

      {/* Floating scroll indicator */}
      {transactionHistory.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-blue-600 text-white rounded-full p-3 shadow-lg hover:bg-blue-700 transition-all duration-200 cursor-pointer animate-pulse"
            onClick={() => {
              document.querySelector('.transaction-history-table')?.scrollIntoView({
                behavior: 'smooth'
              })
            }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {transactionHistory.length} transaction{transactionHistory.length>1?"s":""}
              </span>
              <div className="text-lg">↓</div>
            </div>
          </div>
        </div>
      )}

      {/* Network Info */}
      {
        selectedNetwork.id !== 'select' && (
          <div className="mb-8 text-xs text-gray-500 dark:text-gray-400 text-center space-y-1">
            <p>Contract: {CONTRACT_ADDRESSES[selectedNetwork.id as keyof typeof CONTRACT_ADDRESSES]}</p>
            <p>Chain: {selectedNetwork.name} ({selectedNetwork.chainId})</p>
          </div>
        )
      }

      {/* Transaction History Table */}
      {transactionHistory.length > 0 && (
        <div className="w-full max-w-4xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Last {transactionHistory.length>1?transactionHistory.length:""} Transaction{transactionHistory.length>1?"s":""}
            </h3>
            <button
              onClick={clearHistory}
              className="text-sm text-gray-500 hover:text-red-500 transition-colors"
            >
              Clear History
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg">
            <table className="w-full transaction-history-table">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                    Network
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                    Hash
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {transactionHistory.map((tx, index) => {
                  const getExplorerUrl = (networkName: string, hash: string) => {
                    const networkId = networkName.toLowerCase().replace(' ', '')
                    switch (networkId) {
                      case 'abstract': return `https://explorer.testnet.abs.xyz/tx/${hash}`
                      case 'megaeth': return `https://www.megaexplorer.xyz/tx/${hash}`
                      case 'rise': return `https://explorer.testnet.riselabs.xyz/tx/${hash}`
                      default: return '#'
                    }
                  }

                  return (
                    <tr key={`${tx.hash}-${index}`} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${tx.network === 'MegaETH' ? 'bg-purple-500' :
                            tx.network === 'RISE' ? 'bg-blue-500' : 'bg-green-500'
                            }`} />
                          <span className="text-gray-900 dark:text-gray-100 font-medium">{tx.network}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <a
                          href={getExplorerUrl(tx.network, tx.hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-mono text-xs hover:underline"
                        >
                          {tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-gray-100">
                        <span className={`px-2 py-1 rounded-full text-xs ${tx.time < 200 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          tx.time < 500 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                          {tx.time}ms
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Scroll indicator for mobile */}
          <div className="flex justify-center mt-2 md:hidden">
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <span>←</span>
              <span>Scroll to see all columns</span>
              <span>→</span>
            </div>
          </div>
        </div>
      )}

    </div >
  )
}