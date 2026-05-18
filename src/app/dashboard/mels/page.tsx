"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { formatDecimal } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Printer, ChevronRight, Zap } from "lucide-react"

export default function MelsHistoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [mels, setMels] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const fetchMels = async () => {
      setLoading(true)
      const { data } = await supabase
        .from("mels")
        .select("*")
        .order("created_at", { ascending: false })
      
      if (data) setMels(data)
      setLoading(false)
    }
    fetchMels()
  }, [])

  const filteredMels = mels.filter(mel => {
    const term = searchQuery.toLowerCase()
    return (
      (mel.mel_name && mel.mel_name.toLowerCase().includes(term)) ||
      (mel.mel_id && mel.mel_id.toLowerCase().includes(term)) ||
      (mel.party_name && mel.party_name.toLowerCase().includes(term))
    )
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center">
            <Zap className="mr-3 h-8 w-8 text-emerald-500" />
            MEL History
          </h2>
          <p className="text-muted-foreground mt-1">Confirmed production mixes and formulation receipts</p>
        </div>
        <Button onClick={() => router.push("/dashboard/mel")} className="orange-gradient text-white border-0">
          Create New MEL
        </Button>
      </div>

      <Card className="bg-[#111827] border-white/5 flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-[#18181B] p-4 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by MEL Name, ID, or Party..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#09090B] border-white/10 w-full max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-auto flex-1">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
          ) : filteredMels.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <p>No MEL records found.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-[#09090B] sticky top-0 z-10 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4 font-bold tracking-wider">Date</th>
                  <th className="px-6 py-4 font-bold tracking-wider">MEL Name / ID</th>
                  <th className="px-6 py-4 font-bold tracking-wider">Party</th>
                  <th className="px-6 py-4 font-bold tracking-wider text-right">Target Range</th>
                  <th className="px-6 py-4 font-bold tracking-wider text-right">Achieved Purity</th>
                  <th className="px-6 py-4 font-bold tracking-wider text-right">Total Weight</th>
                  <th className="px-6 py-4 font-bold tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredMels.map((mel) => (
                  <tr key={mel.mel_id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs text-white/70 whitespace-nowrap">
                      {new Date(mel.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-white mb-0.5">{mel.mel_name || "Unnamed MEL"}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{mel.mel_id}</div>
                    </td>
                    <td className="px-6 py-4 text-white/90">
                      {mel.party_name}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground text-xs">
                      {formatDecimal(mel.target_purity_min)}% - {formatDecimal(mel.target_purity_max)}%
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                        {formatDecimal(mel.achieved_purity)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-white/90">
                      {formatDecimal(mel.total_weight)} g
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button 
                        variant="ghost" size="sm"
                        onClick={() => router.push(`/dashboard/mels/${mel.mel_id}/receipt`)}
                        className="h-8 text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <Printer className="h-4 w-4 mr-2" /> Receipt
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
