"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { formatDecimal, cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Download, Eye, EyeOff, Package, Activity } from "lucide-react"
import toast from "react-hot-toast"

export default function PartyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const partyId = params.id as string

  const [party, setParty] = useState<any>(null)
  const [inStockItems, setInStockItems] = useState<any[]>([])
  const [outStockItems, setOutStockItems] = useState<any[]>([])
  const [showOutStock, setShowOutStock] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [stats, setStats] = useState({
    givenWeight: 0,
    givenFine: 0,
    usedWeight: 0,
    usedFine: 0,
    remainingWeight: 0,
    remainingFine: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPartyData = async () => {
      try {
        const { data: partyData, error: partyError } = await supabase
          .from("parties")
          .select("*")
          .eq("id", partyId)
          .single()

        if (partyError) throw partyError
        setParty(partyData)

        const { data: metals, error: metalsError } = await supabase
          .from("metal_items")
          .select("*, batches(batch_title, date_time, received_from)")
          .eq("party_id", partyId)

        if (metalsError) throw metalsError

        const { data: outStock, error: outStockError } = await supabase
          .from("out_stock")
          .select("*")
          .eq("party_id", partyId)
          .order("used_date", { ascending: false })

        if (outStockError) throw outStockError

        setInStockItems(metals || [])
        setOutStockItems(outStock || [])

        let rWeight = 0, rFine = 0, uWeight = 0, uFine = 0
        
        metals?.forEach((item) => {
          if (!item.is_used) {
            rWeight += Number(item.weight)
            rFine += Number(item.fine)
          }
        })
        
        outStock?.forEach((item) => {
          uWeight += Number(item.weight)
          uFine += Number(item.fine)
        })

        // Total Given is explicitly calculated from Remaining + Used to perfectly ignore 
        // deleted items and avoid duplicating split components.
        setStats({
          givenWeight: rWeight + uWeight,
          givenFine: rFine + uFine,
          usedWeight: uWeight,
          usedFine: uFine,
          remainingWeight: rWeight,
          remainingFine: rFine,
        })
      } catch (error) {
        toast.error("Failed to load party details")
        router.push("/dashboard/parties")
      } finally {
        setLoading(false)
      }
    }

    if (partyId) fetchPartyData()
  }, [partyId, router])

  // ─── Export: Redirect to unified PDF Receipt ──────
  const handleExport = () => {
    router.push(`/dashboard/parties/${partyId}/receipt`)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="secondary" size="icon" onClick={() => router.push("/dashboard/parties")} className="rounded-full bg-[#18181B] border-white/5 text-muted-foreground hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">{party?.name}</h2>
            <p className="text-muted-foreground text-sm">{party?.contact || "No contact info"}</p>
          </div>
        </div>
        <Button
          onClick={handleExport}
          className="bg-white text-black hover:bg-white/90 font-bold shadow-lg"
        >
          <Download className="mr-2 h-4 w-4" />
          View / Print PDF
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {[
          { label: "Remaining", value: stats.remainingWeight, fine: stats.remainingFine, primary: true },
          { label: "Total Given (In)", value: stats.givenWeight, fine: stats.givenFine, primary: false },
          { label: "Total Used (Out)", value: stats.usedWeight, fine: stats.usedFine, primary: false },
        ].map((card, i) => (
          <Card key={i} className={cn(
            "bg-[#18181B] border-white/5 rounded-2xl overflow-hidden",
            card.primary && "ring-1 ring-primary/20 bg-primary/5"
          )}>
            <CardHeader className="pb-2">
              <CardTitle className={cn("text-[11px] font-bold uppercase tracking-[0.1em]", card.primary ? "text-primary" : "text-muted-foreground")}>
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {formatDecimal(card.value)}
                <span className="ml-2 text-sm font-medium text-muted-foreground">g</span>
              </div>
              <p className={cn("text-[11px] mt-2 font-medium", card.primary ? "text-primary/70" : "text-muted-foreground/60")}>
                Fine: {formatDecimal(card.fine)} g
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* In-Stock List */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-white">In-Stock History</h3>
        </div>

        {inStockItems.filter(item => !item.is_used).length === 0 ? (
          <div className="text-center py-12 bg-[#18181B] border border-white/5 rounded-2xl">
            <p className="text-muted-foreground text-sm">No metals received from this party yet.</p>
          </div>
        ) : (
          <Card className="overflow-hidden bg-[#18181B] border-white/5 rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] text-muted-foreground uppercase bg-[#09090B] border-b border-white/5">
                  <tr>
                    <th className="px-6 py-4 font-bold tracking-wider">Batch</th>
                    <th className="px-6 py-4 font-bold tracking-wider">Date</th>
                    <th className="px-6 py-4 font-bold tracking-wider">Type</th>
                    <th className="px-6 py-4 text-right font-bold tracking-wider">Weight</th>
                    <th className="px-6 py-4 text-right font-bold tracking-wider">Purity</th>
                    <th className="px-6 py-4 text-right font-bold tracking-wider text-primary">Fine</th>
                    <th className="px-6 py-4 text-center font-bold tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {inStockItems.filter(item => !item.is_used).map((item) => (
                    <tr key={item.metal_id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4 font-bold text-white">
                        {item.batches?.batch_title || 'Late Addition'}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground font-medium">
                        {item.batches?.date_time ? new Date(item.batches.date_time).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-md bg-secondary text-foreground text-[10px] font-bold uppercase tracking-wider border border-white/5">
                          {item.metal_type === "Others" ? item.custom_type : item.metal_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                        {formatDecimal(item.weight)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                        {formatDecimal(item.purity)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-primary group-hover:scale-110 transition-transform origin-right">
                        {formatDecimal(item.fine)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                          In-Stock
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <div className="flex justify-center pt-4">
        <Button
          variant="secondary"
          onClick={() => setShowOutStock(!showOutStock)}
          className="rounded-full bg-[#18181B] border-white/5 text-muted-foreground hover:text-white px-8"
        >
          {showOutStock ? (
            <><EyeOff className="mr-2 h-4 w-4" /> Hide Out-Stock Entries</>
          ) : (
            <><Eye className="mr-2 h-4 w-4" /> View Out-Stock Entries</>
          )}
        </Button>
      </div>

      {/* Out-Stock List */}
      {showOutStock && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-rose-500/10 rounded-lg">
              <Activity className="h-4 w-4 text-rose-500" />
            </div>
            <h3 className="text-lg font-bold text-white">Out-Stock History</h3>
          </div>

          {outStockItems.length === 0 ? (
            <div className="text-center py-12 bg-[#18181B] border border-white/5 rounded-2xl">
              <p className="text-muted-foreground text-sm">No metals used from this party yet.</p>
            </div>
          ) : (
            <Card className="overflow-hidden bg-[#18181B] border-rose-500/10 rounded-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[11px] text-muted-foreground uppercase bg-rose-500/5 border-b border-white/5">
                    <tr>
                      <th className="px-6 py-4 font-bold tracking-wider">Date Used</th>
                      <th className="px-6 py-4 font-bold tracking-wider">Type</th>
                      <th className="px-6 py-4 text-right font-bold tracking-wider">Weight</th>
                      <th className="px-6 py-4 text-right font-bold tracking-wider">Purity</th>
                      <th className="px-6 py-4 text-right font-bold tracking-wider text-rose-400">Fine</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {outStockItems.map((item) => (
                      <tr key={item.out_id} className="hover:bg-rose-500/[0.02] transition-colors">
                        <td className="px-6 py-4 font-medium text-muted-foreground">
                          {new Date(item.used_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-md bg-secondary text-foreground text-[10px] font-bold uppercase tracking-wider">
                            {item.metal_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                          {formatDecimal(item.weight)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                          {formatDecimal(item.purity)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-rose-400">
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
      )}
    </div>
  )
}
