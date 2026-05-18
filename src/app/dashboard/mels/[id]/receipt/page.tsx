"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { formatDecimal } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft, Download } from "lucide-react"
import toast from "react-hot-toast"

export default function MelReceiptPage() {
  const params = useParams()
  const router = useRouter()
  const melId = params.id as string
  
  const [mel, setMel] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMel = async () => {
      const { data, error } = await supabase
        .from("mels")
        .select("*")
        .eq("mel_id", melId)
        .single()
      
      if (error) {
        toast.error("Receipt not found")
        router.push("/dashboard/mels")
        return
      }
      
      setMel(data)
      setLoading(false)
    }
    fetchMel()
  }, [melId, router])

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

  if (!mel) return null

  // Ensure 2 decimal places
  const oWeight = Number(mel.order_weight).toFixed(2)
  const mWeight = Number(mel.total_weight).toFixed(2)
  const reqPurity = Number(mel.target_purity_min).toFixed(2)
  const achPurity = Number(mel.achieved_purity).toFixed(2)
  const dateStr = new Date(mel.created_at).toLocaleDateString('en-GB', { 
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      
      {/* Non-printable controls */}
      <div className="flex justify-between items-center print:hidden bg-[#111827] p-4 rounded-xl border border-white/5">
        <Button variant="ghost" onClick={() => router.back()} className="text-muted-foreground hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="space-x-3">
          <Button onClick={handlePrint} className="bg-white text-black hover:bg-white/90">
            <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Printable Receipt Area */}
      <div className="bg-white text-black p-10 rounded-none md:rounded-xl shadow-2xl print:shadow-none print:m-0 print:p-0">
        
        {/* Header */}
        <div className="border-b-2 border-gray-200 pb-6 mb-8 text-center">
          <h1 className="text-3xl font-black uppercase tracking-widest text-gray-900">MEL Formulation Receipt</h1>
          <p className="text-gray-500 mt-2 font-mono text-sm">{mel.mel_id}</p>
        </div>

        {/* Core Details Grid */}
        <div className="grid grid-cols-2 gap-y-8 gap-x-12 mb-12">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">MEL Name</p>
            <p className="text-xl font-bold text-gray-900">{mel.mel_name || "Unnamed MEL"}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Date & Time</p>
            <p className="text-lg text-gray-800">{dateStr}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Party Name</p>
            <p className="text-lg text-gray-800">{mel.party_name}</p>
          </div>
        </div>

        {/* Metrics Block */}
        <div className="bg-gray-50 rounded-xl p-8 border border-gray-100">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 border-b border-gray-200 pb-2">Production Metrics</h3>
          
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Order Weight</p>
                <p className="text-2xl font-mono font-bold text-gray-900">{oWeight} <span className="text-sm text-gray-500 font-sans">g</span></p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Mix Weight</p>
                <p className="text-2xl font-mono font-bold text-emerald-600">{mWeight} <span className="text-sm text-gray-500 font-sans">g</span></p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Required Purity (Min)</p>
                <p className="text-2xl font-mono font-bold text-gray-900">{reqPurity} <span className="text-sm text-gray-500 font-sans">%</span></p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Achieved Mix Purity</p>
                <p className="text-2xl font-mono font-bold text-emerald-600">{achPurity} <span className="text-sm text-gray-500 font-sans">%</span></p>
              </div>
            </div>
          </div>
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
          .max-w-3xl, .max-w-3xl * {
            visibility: visible;
          }
          .max-w-3xl {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
