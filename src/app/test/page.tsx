// src/app/test-megaeth/page.tsx
'use client'

import { useState } from 'react'
import { createWalletClient, http, publicActions, Hex } from 'viem'
import { megaethTestnet } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

export default function TestMegaETH() {
  const [isLoading, setIsLoading] = useState(false)
  const [preSignedTx, setPreSignedTx] = useState<string>('')
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')

  // Using Foundry's default account
  const foundryAccount = privateKeyToAccount(process.env.NEXT_PUBLIC_FOUNDRY_DEFAULT_PRIVATE_KEY as `0x${string}`)

  const megaClient = createWalletClient({
    account: foundryAccount,
    chain: megaethTestnet,
    transport: http('https://carrot.megaeth.com/rpc'),
  }).extend(publicActions)

  // Contract addresses from your constants
  const MEGA_UPDATER_ADDRESS = "0x0D0ba0Ea8d031d093eA36c1A1176B066Fd08fadB"

  const preSignTransaction = async () => {
    setIsLoading(true)
    setError('')
    setPreSignedTx('')

    try {
      console.log('Pre-signing transaction for MegaETH...')

      const nonce = await megaClient.getTransactionCount({
        address: foundryAccount.address
      })

      console.log("dekh nonce toh ye rahi: ", nonce)

      const gasPrice = 20000000000n // 20 gwei

      const signedTx = await megaClient.signTransaction({
        account: foundryAccount,
        to: MEGA_UPDATER_ADDRESS as `0x${string}`,
        data: '0xa2e62045', // update() function
        nonce,
        maxFeePerGas: gasPrice,
        maxPriorityFeePerGas: gasPrice / 10n,
        value: 0n,
        type: 'eip1559' as const,
        gas: 100000n,
      })

      console.log('Transaction pre-signed:', signedTx)
      setPreSignedTx(signedTx)

    } catch (err: any) {
      console.error('Error pre-signing:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const executeTransaction = async () => {
    if (!preSignedTx) {
      setError('No pre-signed transaction available')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      console.log('Executing with realtime_sendRawTransaction...')

      const startTime = performance.now()

      const result = await megaClient.request({
        //@ts-ignore
        method: 'realtime_sendRawTransaction',
        params: [preSignedTx]
      })

      const endTime = performance.now()

      console.log('MegaETH result:', result)
      console.log('Time taken:', endTime - startTime, 'ms')

      setResult(`Success! Hash: ${result}, Time: ${Math.round(endTime - startTime)}ms`)

    } catch (err: any) {
      console.error('Error executing:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8 text-black dark:text-white">
        MegaETH Realtime Test
      </h1>

      <div className="space-y-4 w-full max-w-md">
        <button
          onClick={preSignTransaction}
          disabled={isLoading}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Pre-signing...' : 'Pre-Sign Transaction'}
        </button>

        <button
          onClick={executeTransaction}
          disabled={isLoading || !preSignedTx}
          className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {isLoading ? 'Executing...' : 'Execute with realtime_sendRawTransaction'}
        </button>
      </div>

      {preSignedTx && (
        <div className="mt-6 p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg max-w-2xl">
          <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            Pre-Signed Transaction Ready:
          </h3>
          <p className="font-mono text-xs text-yellow-700 dark:text-yellow-300 break-all">
            {preSignedTx.slice(0, 100)}...
          </p>
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-green-100 dark:bg-green-900 rounded-lg max-w-2xl">
          <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
            Result:
          </h3>
          <p className="text-green-700 dark:text-green-300">
            {result}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-100 dark:bg-red-900 rounded-lg max-w-2xl">
          <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
            Error:
          </h3>
          <p className="text-red-700 dark:text-red-300 break-all">
            {error}
          </p>
        </div>
      )}

      <div className="mt-8 text-sm text-gray-600 dark:text-gray-400 text-center">
        <p>Contract: {MEGA_UPDATER_ADDRESS}</p>
        <p>Account: {foundryAccount.address.slice(0, 10)}...</p>
        <p>Chain: MegaETH Testnet (6342)</p>
      </div>
    </div>
  )
}