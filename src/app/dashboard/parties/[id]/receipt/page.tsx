"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { formatDecimal } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft } from "lucide-react"
import toast from "react-hot-toast"

export default function PartyReceiptPage() {
  const params = useParams()
  const router = useRouter()
  const partyId = params.id as string
  
  const [party, setParty] = useState<any>(null)
  const [metals, setMetals] = useState<any[]>([])
  const [stats, setStats] = useState({ weight: 0, fine: 0 })
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

        const { data: metalData, error: metalError } = await supabase
          .from("metal_items")
          .select("metal_type, custom_type, weight, purity, fine, batches(date_time)")
          .eq("party_id", partyId)
          .eq("is_used", false)
          .order("created_at", { ascending: true })

        if (metalError) throw metalError
        setMetals(metalData || [])

        let tWeight = 0, tFine = 0
        metalData?.forEach(m => {
          tWeight += Number(m.weight)
          tFine += Number(m.fine)
        })
        setStats({ weight: tWeight, fine: tFine })

      } catch (err) {
        toast.error("Failed to load party data")
        router.push("/dashboard/parties")
      } finally {
        setLoading(false)
      }
    }
    fetchPartyData()
  }, [partyId, router])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!party) return null

  const dateStr = new Date().toLocaleDateString('en-GB', { 
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      
      {/* Non-printable controls */}
      <div className="flex justify-between items-center print:hidden bg-[#111827] p-4 rounded-xl border border-white/5">
        <Button variant="ghost" onClick={() => router.back()} className="text-muted-foreground hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
        <div className="space-x-3">
          <Button onClick={handlePrint} className="bg-white text-black hover:bg-white/90 font-bold">
            <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Printable Receipt Area */}
      <div className="bg-white text-black p-10 rounded-none md:rounded-xl shadow-2xl print:shadow-none print:m-0 print:p-0">
        
        {/* Header */}
        <div className="border-b-2 border-gray-200 pb-6 mb-8 text-center">
          <h1 className="text-3xl font-black uppercase tracking-widest text-gray-900">Inventory Report</h1>
          <p className="text-gray-500 mt-2 font-mono text-sm">Generated: {dateStr}</p>
        </div>

        {/* Core Details Grid */}
        <div className="grid grid-cols-2 gap-y-8 gap-x-12 mb-10">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Party Name</p>
            <p className="text-2xl font-black text-gray-900">{party.name}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Contact</p>
            <p className="text-lg text-gray-800">{party.contact || "N/A"}</p>
          </div>
        </div>

        {/* Metrics Block */}
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 mb-8 flex justify-around">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">Active Total Weight</p>
            <p className="text-2xl font-mono font-bold text-gray-900">{formatDecimal(stats.weight)} <span className="text-sm text-gray-500 font-sans">g</span></p>
          </div>
          <div className="text-center border-l border-gray-200 pl-16">
            <p className="text-sm text-gray-500 mb-1">Active Total Fine</p>
            <p className="text-2xl font-mono font-bold text-emerald-600">{formatDecimal(stats.fine)} <span className="text-sm text-gray-500 font-sans">g</span></p>
          </div>
        </div>

        {/* Data Table */}
        <div className="mb-12">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Current In-Stock Items</h3>
          {metals.length === 0 ? (
            <p className="text-gray-500 italic">No active inventory.</p>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200 text-gray-500">
                  <th className="py-3 px-2 font-bold uppercase tracking-wider text-xs">Date Received</th>
                  <th className="py-3 px-2 font-bold uppercase tracking-wider text-xs">Metal Type</th>
                  <th className="py-3 px-2 text-right font-bold uppercase tracking-wider text-xs">Weight (g)</th>
                  <th className="py-3 px-2 text-right font-bold uppercase tracking-wider text-xs">Purity (%)</th>
                  <th className="py-3 px-2 text-right font-bold uppercase tracking-wider text-xs">Fine (g)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {metals.map((m, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="py-3 px-2 text-gray-600 font-medium">
                      {m.batches?.date_time ? new Date(m.batches.date_time).toLocaleDateString('en-GB') : 'N/A'}
                    </td>
                    <td className="py-3 px-2 font-bold text-gray-800">
                      {m.metal_type === "Others" ? m.custom_type : m.metal_type}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-gray-600">
                      {formatDecimal(m.weight)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-gray-600">
                      {formatDecimal(m.purity)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-bold text-gray-900">
                      {formatDecimal(m.fine)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400 font-mono">Generated securely by Silver Inventory System</p>
        </div>

      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .max-w-4xl, .max-w-4xl * {
            visibility: visible;
          }
          .max-w-4xl {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page { margin: 1cm; }
        }
      `}</style>
    </div>
  )
}
