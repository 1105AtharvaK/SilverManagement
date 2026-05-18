"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { formatDecimal } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import toast from "react-hot-toast"

export default function OutStockPage() {
  const searchParams = useSearchParams()
  const partyParam = searchParams.get("party")

  const [outStock, setOutStock] = useState<any[]>([])
  const [parties, setParties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [selectedParty, setSelectedParty] = useState<string>(partyParam || "")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const fetchParties = async () => {
      const { data } = await supabase.from("parties").select("id, name").order("name")
      if (data) setParties(data)
    }
    fetchParties()
  }, [])

  useEffect(() => {
    const fetchOutStock = async () => {
      setLoading(true)
      let query = supabase
        .from("out_stock")
        .select(`
          *,
          parties (name)
        `)
        .order("used_date", { ascending: false })

      if (selectedParty) {
        query = query.eq("party_id", selectedParty)
      }

      const { data, error } = await query

      if (error) {
        toast.error("Error fetching out-stock data")
      } else {
        setOutStock(data || [])
      }
      setLoading(false)
    }

    fetchOutStock()
  }, [selectedParty])

  const filteredOutStock = outStock.filter(item => 
    item.mel_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.metal_type?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalUsedWeight = filteredOutStock.reduce((acc, item) => acc + Number(item.weight), 0)
  const totalUsedFine = filteredOutStock.reduce((acc, item) => acc + Number(item.fine), 0)

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Out-Stock</h2>
          <p className="text-muted-foreground text-sm mt-1">Log of all used metals and melting IDs</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedParty}
            onChange={(e) => setSelectedParty(e.target.value)}
            className="flex h-11 w-full sm:w-[200px] rounded-xl border border-white/5 bg-[#18181B] px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all appearance-none cursor-pointer"
          >
            <option value="">All Parties</option>
            {parties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="relative w-full sm:w-[280px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search Mel ID or Type..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 bg-[#18181B] border-white/5 rounded-xl h-11 focus:border-primary/50"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-rose-500/[0.03] border-rose-500/10 rounded-2xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Search className="h-12 w-12 text-rose-500" />
          </div>
          <CardContent className="p-6 flex justify-between items-center">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-widest">Filtered Weight</span>
            <span className="text-3xl font-bold font-mono text-white tracking-tighter">{formatDecimal(totalUsedWeight)} g</span>
          </CardContent>
        </Card>
        <Card className="bg-rose-500/[0.03] border-rose-500/10 rounded-2xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Search className="h-12 w-12 text-rose-500" />
          </div>
          <CardContent className="p-6 flex justify-between items-center">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-widest">Filtered Fine</span>
            <span className="text-3xl font-bold font-mono text-rose-400 tracking-tighter">{formatDecimal(totalUsedFine)} g</span>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : filteredOutStock.length === 0 ? (
        <div className="text-center py-20 bg-[#18181B] border border-white/5 rounded-2xl">
          <p className="text-muted-foreground">No out-stock records found.</p>
        </div>
      ) : (
        <Card className="overflow-hidden bg-[#18181B] border-white/5 rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[11px] text-muted-foreground uppercase bg-white/[0.02] border-b border-white/5">
                <tr>
                  <th className="px-6 py-4 font-bold tracking-wider">Date Used</th>
                  <th className="px-6 py-4 font-bold tracking-wider">Party</th>
                  <th className="px-6 py-4 font-bold tracking-wider">Mel ID</th>
                  <th className="px-6 py-4 font-bold tracking-wider">Type</th>
                  <th className="px-6 py-4 text-right font-bold tracking-wider">Weight</th>
                  <th className="px-6 py-4 text-right font-bold tracking-wider">Purity</th>
                  <th className="px-6 py-4 text-right font-bold tracking-wider text-rose-400">Fine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredOutStock.map((item) => (
                  <tr key={item.out_id} className="hover:bg-white/[0.01] transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground font-medium">
                      {new Date(item.used_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-bold text-white">
                      {item.parties?.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded bg-[#09090B] text-white text-[10px] font-mono border border-white/5 group-hover:border-white/10 transition-colors">
                        {item.mel_id || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                        {item.metal_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                      {formatDecimal(item.weight)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                      {formatDecimal(item.purity)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-rose-400 font-bold group-hover:scale-110 transition-transform origin-right">
                      {formatDecimal(item.fine)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

