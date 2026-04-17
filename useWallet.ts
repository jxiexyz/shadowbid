import { useState, useEffect, useCallback, useRef } from 'react'
import { getBalance } from '../lib/rpc'

export type WalletProvider = 'phantom' | 'solflare' | null

interface WalletState {
  connected: boolean
  connecting: boolean
  publicKey: string | null
  balance: number | null
  provider: WalletProvider
  needsDevnet: boolean
}

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean
      publicKey?: { toString(): string }
      connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>
      disconnect(): Promise<void>
      on(event: string, handler: (...args: unknown[]) => void): void
      off(event: string, handler: (...args: unknown[]) => void): void
      request?(args: { method: string; params?: unknown }): Promise<unknown>
      network?: string
    }
    phantom?: {
      solana?: {
        isPhantom?: boolean
        publicKey?: { toString(): string }
        connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>
        disconnect(): Promise<void>
        on(event: string, handler: (...args: unknown[]) => void): void
        off(event: string, handler: (...args: unknown[]) => void): void
        request?(args: { method: string; params?: unknown }): Promise<unknown>
        network?: string
      }
    }
    solflare?: {
      isSolflare?: boolean
      publicKey?: { toString(): string }
      isConnected?: boolean
      connect(): Promise<{ publicKey: { toString(): string } } | void>
      disconnect(): Promise<void>
      on(event: string, handler: (...args: unknown[]) => void): void
      off(event: string, handler: (...args: unknown[]) => void): void
      network?: string
    }
  }
}

const STORAGE_KEY = 'shadowbid_wallet'
const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'

function getPhantomProvider() {
  if (window.phantom?.solana?.isPhantom) return window.phantom.solana
  if (window.solana?.isPhantom) return window.solana
  return null
}

async function checkIsDevnet(provider: WalletProvider): Promise<boolean> {
  try {
    if (provider === 'phantom') {
      const p = getPhantomProvider()
      if (!p) return true
      const network = (p as any).network
      if (network) return network === 'devnet'
      try {
        const hash = await p.request?.({ method: 'getGenesisHash' }) as string
        return hash === DEVNET_GENESIS
      } catch { return true }
    } else if (provider === 'solflare' && window.solflare) {
      const network = (window.solflare as any).network
      if (network) return network === 'devnet'
      return true
    }
  } catch { /* ignore */ }
  return true
}

// Get Solflare publicKey - tries direct property, then polls via event
async function getSolflarePublicKey(timeoutMs = 2000): Promise<string | null> {
  const sf = window.solflare
  if (!sf) return null

  // Already available
  if (sf.publicKey) return sf.publicKey.toString()

  // Wait for 'connect' event
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      sf.off('connect', handler)
      // Last chance - direct check
      resolve(sf.publicKey ? sf.publicKey.toString() : null)
    }, timeoutMs)

    const handler = () => {
      clearTimeout(timer)
      sf.off('connect', handler)
      resolve(sf.publicKey ? sf.publicKey.toString() : null)
    }
    sf.on('connect', handler)
  })
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    connected: false,
    connecting: false,
    publicKey: null,
    balance: null,
    provider: null,
    needsDevnet: false,
  })

  const stateRef = useRef(state)
  stateRef.current = state

  const fetchBalance = useCallback(async (pk: string) => {
    try {
      const bal = await getBalance(pk)
      setState((s) => ({ ...s, balance: bal }))
    } catch { /* ignore */ }
  }, [])

  const setConnected = useCallback(
    async (pk: string, provider: WalletProvider) => {
      const isDevnet = await checkIsDevnet(provider)
      setState({
        connected: true,
        connecting: false,
        publicKey: pk,
        balance: null,
        provider,
        needsDevnet: !isDevnet,
      })
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ pk, provider }))
      fetchBalance(pk)
    },
    [fetchBalance]
  )

  const dismissDevnetPrompt = useCallback(() => {
    setState((s) => ({ ...s, needsDevnet: false }))
  }, [])

  // Auto-reconnect on mount - tries trusted/silent first, falls back to full connect
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return
    try {
      const { pk, provider } = JSON.parse(stored) as { pk: string; provider: WalletProvider }

      if (provider === 'phantom') {
        const p = getPhantomProvider()
        if (!p) { localStorage.removeItem(STORAGE_KEY); return }

        // Try silent first (already approved), fallback to full connect
        p.connect({ onlyIfTrusted: true })
          .then((res) => setConnected(res.publicKey.toString(), 'phantom'))
          .catch(() => {
            // User may have revoked or it's a fresh session - try full connect
            p.connect()
              .then((res) => setConnected(res.publicKey.toString(), 'phantom'))
              .catch(() => localStorage.removeItem(STORAGE_KEY))
          })

      } else if (provider === 'solflare') {
        const sf = window.solflare
        if (!sf?.isSolflare) { localStorage.removeItem(STORAGE_KEY); return }

        // Solflare: check if already connected (session still active)
        if (sf.isConnected && sf.publicKey) {
          setConnected(sf.publicKey.toString(), 'solflare')
          return
        }

        sf.connect()
          .then(async () => {
            const pk2 = await getSolflarePublicKey()
            if (pk2) {
              setConnected(pk2, 'solflare')
            } else {
              localStorage.removeItem(STORAGE_KEY)
            }
          })
          .catch(() => localStorage.removeItem(STORAGE_KEY))

      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [setConnected])

  // Listen to wallet events for auto-disconnect
  useEffect(() => {
    const handlePhantomDisconnect = () => {
      if (stateRef.current.provider === 'phantom') {
        localStorage.removeItem(STORAGE_KEY)
        setState({ connected: false, connecting: false, publicKey: null, balance: null, provider: null, needsDevnet: false })
      }
    }
    const handleSolflareDisconnect = () => {
      if (stateRef.current.provider === 'solflare') {
        localStorage.removeItem(STORAGE_KEY)
        setState({ connected: false, connecting: false, publicKey: null, balance: null, provider: null, needsDevnet: false })
      }
    }

    const p = getPhantomProvider()
    if (p) p.on('disconnect', handlePhantomDisconnect)
    if (window.solflare) window.solflare.on('disconnect', handleSolflareDisconnect)

    return () => {
      if (p) p.off('disconnect', handlePhantomDisconnect)
      if (window.solflare) window.solflare.off('disconnect', handleSolflareDisconnect)
    }
  }, [])

  const connect = useCallback(
    async (provider: WalletProvider) => {
      setState((s) => ({ ...s, connecting: true }))
      try {
        if (provider === 'phantom') {
          const p = getPhantomProvider()
          if (!p) {
            window.open('https://phantom.app/', '_blank')
            setState((s) => ({ ...s, connecting: false }))
            return
          }
          const res = await p.connect()
          await setConnected(res.publicKey.toString(), 'phantom')

        } else if (provider === 'solflare') {
          const sf = window.solflare
          if (!sf?.isSolflare) {
            window.open('https://solflare.com/', '_blank')
            setState((s) => ({ ...s, connecting: false }))
            return
          }

          // Check if already connected (no popup needed)
          if (sf.isConnected && sf.publicKey) {
            await setConnected(sf.publicKey.toString(), 'solflare')
            return
          }

          await sf.connect()
          const pk = await getSolflarePublicKey()
          if (pk) {
            await setConnected(pk, 'solflare')
          } else {
            setState((s) => ({ ...s, connecting: false }))
          }
        }
      } catch {
        setState((s) => ({ ...s, connecting: false }))
      }
    },
    [setConnected]
  )

  const disconnect = useCallback(async () => {
    try {
      if (stateRef.current.provider === 'phantom') {
        const p = getPhantomProvider()
        if (p) await p.disconnect()
      } else if (stateRef.current.provider === 'solflare' && window.solflare) {
        await window.solflare.disconnect()
      }
    } catch { /* ignore */ }
    localStorage.removeItem(STORAGE_KEY)
    setState({ connected: false, connecting: false, publicKey: null, balance: null, provider: null, needsDevnet: false })
  }, [])

  const refreshBalance = useCallback(() => {
    const pk = stateRef.current.publicKey
    if (pk) fetchBalance(pk)
  }, [fetchBalance])

  return { ...state, connect, disconnect, refreshBalance, dismissDevnetPrompt }
}
