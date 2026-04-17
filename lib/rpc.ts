/**
 * Solana RPC - Direct ke Quicknode Devnet
 * Set VITE_SOLANA_RPC di .env.local dengan URL Quicknode lo
 * Fallback ke public Devnet kalau env kosong
 */

const RPC_ENDPOINT =
  import.meta.env.VITE_SOLANA_RPC ||
  'https://api.devnet.solana.com'

interface RPCResponse<T> {
  jsonrpc: string
  id: number
  result?: T
  error?: { code: number; message: string }
}

async function rpcCall<T>(method: string, params: unknown[] = []): Promise<T> {
  const response = await fetch(RPC_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const data: RPCResponse<T> = await response.json()
  if (data.error) throw new Error(data.error.message)
  return data.result as T
}

/** Get SOL balance for a wallet address in lamports */
export async function getBalance(walletAddress: string): Promise<number> {
  const result = await rpcCall<{ value: number }>('getBalance', [walletAddress])
  return result.value / 1_000_000_000 // Convert lamports to SOL
}

/** Get current slot */
export async function getSlot(): Promise<number> {
  return rpcCall<number>('getSlot')
}

/** Get recent blockhash */
export async function getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  const result = await rpcCall<{ value: { blockhash: string; lastValidBlockHeight: number } }>(
    'getLatestBlockhash'
  )
  return result.value
}

/** Check if an address is a valid Solana public key */
export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
}

/** Shorten a wallet address for display */
export function shortenAddress(address: string, chars = 4): string {
  if (!address) return ''
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}
