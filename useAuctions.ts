import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { MOCK_AUCTIONS, type Auction } from '../lib/mockData'

export type AuctionStatus = 'live' | 'ended' | 'settled' | 'all'
export type SortOrder = 'ending_soon' | 'newest' | 'highest_bid' | 'most_bids'

export function useAuctions(isDemoMode = false) {
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAuctions = useCallback(async () => {
    setLoading(true)

    // Demo mode only: use mock data
    if (isDemoMode) {
      setAuctions(MOCK_AUCTIONS)
      setLoading(false)
      return
    }

    // Real mode: only real data from Supabase, no mock fallback mixed in
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAuctions((data || []) as Auction[])
    } catch {
      // If Supabase fails entirely, show empty - don't show mock to real users
      setAuctions([])
    } finally {
      setLoading(false)
    }
  }, [isDemoMode])

  useEffect(() => {
    fetchAuctions()
  }, [fetchAuctions])

  useEffect(() => {
    if (isDemoMode) return
    const channel = supabase
      .channel('auctions_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, () => {
        fetchAuctions()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchAuctions, isDemoMode])

  const filterAndSort = (
    status: AuctionStatus,
    sort: SortOrder,
    search: string
  ): Auction[] => {
    let filtered = [...auctions]

    if (status !== 'all') {
      filtered = filtered.filter((a) => a.status === status)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.collection?.toLowerCase().includes(q) ?? false)
      )
    }

    switch (sort) {
      case 'ending_soon':
        filtered.sort((a, b) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime())
        break
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'highest_bid':
        filtered.sort((a, b) => (b.min_bid ?? 0) - (a.min_bid ?? 0))
        break
      case 'most_bids':
        filtered.sort((a, b) => (b.bid_count ?? 0) - (a.bid_count ?? 0))
        break
    }

    return filtered
  }

  return { auctions, loading, refetch: fetchAuctions, filterAndSort }
}
