"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { formatDecimal, cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Activity, Target, Scale, Zap, CheckCircle2, ChevronRight, Calculator, SlidersHorizontal, Scissors, Save, Search } from "lucide-react"
import toast from "react-hot-toast"

export default function MelEnginePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [parties, setParties] = useState<any[]>([])
  const [dbMetals, setDbMetals] = useState<any[]>([])
  const [splitMetals, setSplitMetals] = useState<any[]>([]) // Temporarily split items

  // Settings State
  const [useBundi, setUseBundi] = useState(false)
  const [usePiecewiseChorsa, setUsePiecewiseChorsa] = useState(false)
  const [useCopper, setUseCopper] = useState(true)

  // Input State
  const [selectedPartyId, setSelectedPartyId] = useState<string>("")
  const [orderWeight, setOrderWeight] = useState<string>("0")
  const [targetMin, setTargetMin] = useState<string>("50")
  const [targetMax, setTargetMax] = useState<string>("60")
  
  // Katra State
  const [katraAvailableWeight, setKatraAvailableWeight] = useState<string>("0")
  const [katraPurity, setKatraPurity] = useState<string>("0")
  const [katraUsedWeight, setKatraUsedWeight] = useState<string>("0")

  // Interactive State
  const [selectedMetalIds, setSelectedMetalIds] = useState<Set<string>>(new Set())
  const [isFinalizing, setIsFinalizing] = useState(false)

  // Split Modal State
  const [splitModalOpen, setSplitModalOpen] = useState(false)
  const [metalToSplit, setMetalToSplit] = useState<any>(null)
  const [splitWeights, setSplitWeights] = useState<string>("") // comma separated

  // Confirm Modal State
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [generatedMelId, setGeneratedMelId] = useState("")
  const [customMelName, setCustomMelName] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data: partiesData } = await supabase.from("parties").select("id, name").order("name")
      if (partiesData) setParties(partiesData)

      const { data: metalsData } = await supabase
        .from("metal_items")
        .select("*, parties(name)")
        .eq("is_used", false)
        .order("purity", { ascending: false })
      if (metalsData) setDbMetals(metalsData)

      setLoading(false)
    }
    fetchData()
  }, [])

  // MEL Search Logic
  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length > 1) {
      const { data } = await supabase
        .from("mels")
        .select("mel_id, mel_name")
        .or(`mel_name.ilike.%${query}%,mel_id.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(5)
      setSearchResults(data || [])
    } else {
      setSearchResults([])
    }
  }

  // Combine DB metals with split pieces, excluding the original bulk items that were split
  const availableMetals = useMemo(() => {
    const splitOriginalIds = new Set(splitMetals.map(sm => sm.original_id))
    const untouchedMetals = dbMetals.filter(m => !splitOriginalIds.has(m.metal_id))
    return [...untouchedMetals, ...splitMetals]
  }, [dbMetals, splitMetals])

  // Derived calculations
  const oWeight = parseFloat(orderWeight) || 0
  const tMin = parseFloat(targetMin) || 0
  const tMax = parseFloat(targetMax) || 0

  const kAvail = parseFloat(katraAvailableWeight) || 0
  const kUsed = Math.min(parseFloat(katraUsedWeight) || 0, kAvail)
  const kPurity = parseFloat(katraPurity) || 0
  const kFine = kUsed * (kPurity / 100)

  const selectedMetals = useMemo(() => {
    return availableMetals.filter(m => selectedMetalIds.has(m.metal_id || m.virtual_id))
  }, [availableMetals, selectedMetalIds])

  const unselectedMetals = useMemo(() => {
    return availableMetals.filter(m => !selectedMetalIds.has(m.metal_id || m.virtual_id))
  }, [availableMetals, selectedMetalIds])

  const { totalWeight, totalFine, finalPurity } = useMemo(() => {
    const selWeight = selectedMetals.reduce((sum, m) => sum + Number(m.weight), 0)
    const selFine = selectedMetals.reduce((sum, m) => sum + Number(m.fine), 0)
    
    const totW = kUsed + selWeight
    const totF = kFine + selFine
    const fPurity = totW > 0 ? (totF / totW) * 100 : 0

    return { totalWeight: totW, totalFine: totF, finalPurity: fPurity }
  }, [kUsed, kFine, selectedMetals])

  const purityDifference = finalPurity - tMin

  const purityStatus = useMemo(() => {
    if (finalPurity === 0 && kUsed === 0) return "none"
    if (finalPurity >= tMin && finalPurity <= tMax) return "green" // within range
    if (finalPurity < tMin && finalPurity >= tMin - 5) return "yellow" // near lower
    return "red" // outside
  }, [finalPurity, tMin, tMax, kUsed])

  const handleAutoSuggest = () => {
    if (oWeight === 0) {
      toast.error("Please enter Order Weight.")
      return
    }

    // Sort priority: Copper (if enabled), Purity DESC, then Type
    const typePriority: Record<string, number> = { 'Copper': 1, 'Chorsa': 2, 'Peti': 3, 'Patla': 4, 'Bundi': 5, 'Others': 6 }
    
    const sorted = [...availableMetals].sort((a, b) => {
      const pDiff = Number(b.purity) - Number(a.purity)
      if (pDiff !== 0) return pDiff
      return (typePriority[a.metal_type] || 5) - (typePriority[b.metal_type] || 5)
    })

    let bestSelection = new Set<string>()
    let bestKatraUsed = kAvail
    let bestScore = -Infinity

    const passes = 100
    // Target purity strategy: Safely inside the range, biased toward lower portion.
    // e.g. if range is 60-62, safeTMin = 60 + (2 * 0.2) = 60.4
    const safeTMin = tMin + (tMax - tMin) * 0.2
    
    for (let pass = 0; pass < passes; pass++) {
      const currentSelection = new Set<string>()
      let S_w = 0
      let S_f = 0
      
      const candidates = pass === 0 ? sorted : [...sorted].sort(() => Math.random() - 0.5)

      for (const m of candidates) {
        if (!useBundi && m.metal_type === 'Bundi') continue
        if (!useCopper && m.metal_type === 'Copper') continue
        
        currentSelection.add(m.metal_id || m.virtual_id)
        S_w += Number(m.weight)
        S_f += Number(m.fine)
        
        let K_w = 0
        if (kPurity !== safeTMin) {
          K_w = (S_w * safeTMin - S_f * 100) / (kPurity - safeTMin)
        }
        
        K_w = Math.max(0, Math.min(K_w, kAvail))
        
        const totW = K_w + S_w
        const totF = K_w * (kPurity / 100) + S_f
        const purity = totW > 0 ? (totF / totW) * 100 : 0
        
        if (purity >= tMin && purity <= tMax && totW >= oWeight) {
          // Penalty for being far from safe target
          const purityExcess = Math.abs(purity - safeTMin)
          const score = totW - (purityExcess * 5000)
          
          if (score > bestScore) {
            bestScore = score
            bestSelection = new Set(currentSelection)
            bestKatraUsed = K_w
          }
        }
      }
    }

    if (bestSelection.size > 0) {
      setSelectedMetalIds(bestSelection)
      setKatraUsedWeight(bestKatraUsed.toFixed(4))
      toast.success("Optimal production mix found!")
    } else {
      toast.error("Could not find a valid mix meeting all constraints. Try adjusting manually.")
    }
  }

  const toggleMetal = (id: string) => {
    const next = new Set(selectedMetalIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedMetalIds(next)
  }

  const handleSplitChorsa = (e: React.FormEvent) => {
    e.preventDefault()
    if (!metalToSplit) return

    const weightsStr = splitWeights.split(',').map(w => w.trim()).filter(w => w !== "")
    const weights = weightsStr.map(w => parseFloat(w))
    
    if (weights.some(isNaN)) return toast.error("Invalid weights entered")
    
    const sum = weights.reduce((a, b) => a + b, 0)
    if (sum > Number(metalToSplit.weight)) {
      return toast.error("Total split weight exceeds available bulk weight")
    }

    const newPieces = []
    let currentVirtualId = Date.now()

    let pieceIndex = 1
    for (const w of weights) {
      newPieces.push({
        ...metalToSplit,
        virtual_id: `virtual-${currentVirtualId++}`,
        original_id: metalToSplit.metal_id,
        weight: w,
        fine: w * (Number(metalToSplit.purity) / 100),
        custom_type: `${metalToSplit.metal_type} Piece ${pieceIndex++} - ${formatDecimal(w)}g (from total ${formatDecimal(metalToSplit.weight)}g)`
      })
    }

    const remaining = Number(metalToSplit.weight) - sum
    if (remaining > 0.01) {
      newPieces.push({
        ...metalToSplit,
        virtual_id: `virtual-${currentVirtualId++}`,
        original_id: metalToSplit.metal_id,
        weight: remaining,
        fine: remaining * (Number(metalToSplit.purity) / 100),
        custom_type: `${metalToSplit.metal_type} Remainder - ${formatDecimal(remaining)}g (from total ${formatDecimal(metalToSplit.weight)}g)`
      })
    }

    setSplitMetals([...splitMetals, ...newPieces])
    setSplitModalOpen(false)
    setSplitWeights("")
    toast.success("Material split successfully!")
  }

  const prepareConfirmation = () => {
    if (!selectedPartyId) return toast.error("Please select a party")
    if (selectedMetals.length === 0 && kUsed === 0) return toast.error("No metals or Katra specified")
    if (finalPurity < tMin || finalPurity > tMax) return toast.error("Purity is out of bounds!")

    const party = parties.find(p => p.id === selectedPartyId)
    const partyName = party?.name || "Unknown"

    const now = new Date()
    const yyyymmdd = now.toISOString().split('T')[0].replace(/-/g, '')
    const hhmmss = now.toTimeString().split(' ')[0].replace(/:/g, '')
    const random4 = Math.random().toString(36).substring(2, 6).toUpperCase()
    const autoId = `MEL-${yyyymmdd}-${hhmmss}-${random4}`
    
    const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const defaultName = `${partyName} - ${formatDecimal(finalPurity)}% - ${dateStr}`

    setGeneratedMelId(autoId)
    setCustomMelName(defaultName)
    setConfirmModalOpen(true)
  }

  const handleFinalize = async () => {
    if (!customMelName.trim()) return toast.error("Please provide a MEL name")
    setIsFinalizing(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const party = parties.find(p => p.id === selectedPartyId)
      const partyName = party?.name || "Unknown"

      const { data: melData, error: melError } = await supabase.from("mels").insert([{
        mel_id: generatedMelId,
        mel_name: customMelName,
        party_name: partyName,
        target_purity_min: tMin,
        target_purity_max: tMax,
        order_weight: oWeight,
        production_target_weight: totalWeight,
        required_fine: oWeight * (tMin / 100),
        katra_weight: kUsed,
        katra_weight_available: kAvail,
        katra_purity: kPurity,
        katra_fine: kFine,
        achieved_purity: finalPurity,
        total_weight: totalWeight,
        total_fine: totalFine,
        user_id: user.id
      }])

      if (melError) throw new Error(`Failed to create MEL record: ${melError.message}`)

      // Final synchronization: mark exactly what is selected as used.
      for (const m of selectedMetals) {
        if (m.virtual_id) {
          // Mark original as used
          await supabase.from("metal_items").update({ is_used: true }).eq("metal_id", m.original_id)
          // Insert unselected sibling pieces back into inventory
          const unselectedSiblings = unselectedMetals.filter(um => um.original_id === m.original_id)
          for (const sibling of unselectedSiblings) {
            await supabase.from("metal_items").insert([{
               party_id: sibling.party_id,
               batch_id: sibling.batch_id,
               metal_type: sibling.metal_type,
               custom_type: sibling.custom_type,
               weight: sibling.weight,
               purity: sibling.purity,
               fine: sibling.fine,
               is_used: false,
               user_id: user.id
            }])
            setSplitMetals(prev => prev.filter(sm => sm.virtual_id !== sibling.virtual_id))
          }
        } else {
          await supabase.from("metal_items").update({ is_used: true }).eq("metal_id", m.metal_id)
        }

        // Each piece used creates an out_stock record
        await supabase.from("out_stock").insert([{
          metal_id: m.original_id || m.metal_id,
          party_id: selectedPartyId,
          metal_type: m.custom_type || m.metal_type,
          weight: m.weight,
          purity: m.purity,
          fine: m.fine,
          mel_id: generatedMelId,
          user_id: user.id
        }])

        await supabase.from("mel_items").insert([{
          mel_id: generatedMelId,
          metal_id: m.original_id || m.metal_id,
          weight: m.weight,
          purity: m.purity,
          fine: m.fine
        }])
      }

      toast.success(`MEL Confirmed Successfully!`)
      router.push(`/dashboard/mels/${generatedMelId}/receipt`)
    } catch (err: any) {
      toast.error(err.message || "Failed to finalize MEL")
      setIsFinalizing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-end flex-col sm:flex-row gap-4 sm:gap-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center">
            <Zap className="mr-3 h-8 w-8 text-primary" />
            MEL Engine
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Automated Profit-Optimized Decision Support System</p>
        </div>
        
        {/* Quick Search */}
        <div className="relative w-full sm:w-72 z-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search existing MELs..." 
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 bg-[#09090B] border-white/5 font-mono text-xs"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full right-0 mt-2 w-full bg-[#18181B] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              {searchResults.map((mel) => (
                <button
                  key={mel.mel_id}
                  onClick={() => router.push(`/dashboard/mels/${mel.mel_id}/receipt`)}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 flex flex-col"
                >
                  <span className="text-white font-bold">{mel.mel_name || "Unnamed MEL"}</span>
                  <span className="text-[10px] text-muted-foreground font-mono mt-1">{mel.mel_id}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TOP BAR: Real-time Production Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        <Card className="bg-[#09090B] border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Calculator className="h-12 w-12 text-primary" />
          </div>
          <CardContent className="p-4 flex flex-col relative z-10">
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Suggested Katra Weight</span>
            <div className="text-2xl font-bold text-primary font-mono mt-1">{formatDecimal(kUsed)} g</div>
          </CardContent>
        </Card>

        <Card className="bg-[#09090B] border-white/5">
          <CardContent className="p-4 flex flex-col relative">
            <div className="flex justify-between items-center w-full">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Mix Weight</span>
              {totalWeight > oWeight && (
                <span className="text-[10px] font-bold font-mono text-emerald-400/80">
                  +{formatDecimal(totalWeight - oWeight)}g
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-white font-mono mt-1">{formatDecimal(totalWeight)} g</div>
          </CardContent>
        </Card>

        <Card className="bg-[#09090B] border-white/5">
          <CardContent className="p-4 flex flex-col relative">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Fine</span>
            <div className="text-2xl font-bold text-white font-mono mt-1">{formatDecimal(totalFine)} g</div>
          </CardContent>
        </Card>

        <Card className={cn(
          "bg-[#09090B] border transition-all duration-300 relative overflow-hidden",
          purityStatus === "green" ? "border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]" :
          purityStatus === "yellow" ? "border-yellow-500/50" :
          purityStatus === "red" ? "border-rose-500/50" : "border-white/5"
        )}>
          <CardContent className="p-4 flex flex-col relative z-10">
            <div className="flex justify-between items-center w-full">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Achieved Purity</span>
              <span className={cn("text-[10px] font-bold font-mono", purityDifference > 0 ? "text-emerald-400/80" : "text-rose-400/80")}>
                Δ {purityDifference > 0 ? "+" : ""}{formatDecimal(purityDifference)}%
              </span>
            </div>
            <div className={cn(
              "text-3xl font-black tracking-tighter mt-1",
              purityStatus === "green" ? "text-emerald-400" :
              purityStatus === "yellow" ? "text-yellow-400" :
              purityStatus === "red" ? "text-rose-400" : "text-white"
            )}>
              {formatDecimal(finalPurity)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col xl:grid xl:grid-cols-12 gap-6 flex-1 xl:min-h-0 overflow-y-auto xl:overflow-hidden pb-10 xl:pb-0 pr-2 xl:pr-0">
        
        {/* LEFT PANEL: Inputs & Settings */}
        <div className="xl:col-span-3 space-y-4 flex flex-col xl:h-full xl:overflow-y-auto xl:pr-2 scrollbar-hide pb-6 xl:pb-10">
          <Card className="bg-[#111827] border-white/5 shrink-0">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-sm font-bold flex items-center text-white">
                <Target className="mr-2 h-4 w-4 text-primary" /> Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Party</Label>
                <select 
                  value={selectedPartyId}
                  onChange={(e) => setSelectedPartyId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-white/5 bg-[#09090B] px-3 py-1 text-sm text-white focus:ring-1 focus:ring-primary/50 cursor-pointer"
                >
                  <option value="">Select Party</option>
                  {parties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Order Weight (g)</Label>
                <Input 
                  type="number" step="0.0001" min="0"
                  value={orderWeight} onChange={e => setOrderWeight(e.target.value)}
                  className="bg-[#09090B] border-white/5 h-9 font-mono text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Target Min %</Label>
                  <Input 
                    type="number" step="0.01" 
                    value={targetMin} onChange={e => setTargetMin(e.target.value)}
                    className="bg-[#09090B] border-white/5 h-9 font-mono text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Target Max %</Label>
                  <Input 
                    type="number" step="0.01" 
                    value={targetMax} onChange={e => setTargetMax(e.target.value)}
                    className="bg-[#09090B] border-white/5 h-9 font-mono text-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Katra Input */}
          <Card className="bg-[#111827] border-white/5 shrink-0">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-sm font-bold text-white">Available Katra</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Available (g)</Label>
                  <Input 
                    type="number" step="0.0001" min="0"
                    value={katraAvailableWeight} onChange={e => setKatraAvailableWeight(e.target.value)}
                    className="bg-[#09090B] border-white/5 h-9 font-mono text-white text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Purity (%)</Label>
                  <Input 
                    type="number" step="0.0001" min="0" max="100"
                    value={katraPurity} onChange={e => setKatraPurity(e.target.value)}
                    className="bg-[#09090B] border-white/5 h-9 font-mono text-white text-xs"
                  />
                </div>
              </div>

              <Button onClick={handleAutoSuggest} className="w-full orange-gradient shadow-lg shadow-orange-500/20 text-white border-0 h-11 mt-4 font-bold text-sm">
                <Calculator className="mr-2 h-5 w-5" /> Generate Ideal Mix
              </Button>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card className="bg-[#111827] border-white/5 shrink-0">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-sm font-bold flex items-center text-white">
                <SlidersHorizontal className="mr-2 h-4 w-4 text-emerald-400" /> Options
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="copper" checked={useCopper} onCheckedChange={(e) => setUseCopper(!!e)} />
                <Label htmlFor="copper" className="text-xs text-white/80 font-medium cursor-pointer">Use Copper to optimize mix</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="piecewise" checked={usePiecewiseChorsa} onCheckedChange={(e) => setUsePiecewiseChorsa(!!e)} />
                <Label htmlFor="piecewise" className="text-xs text-white/80 font-medium cursor-pointer">Use Piece-wise Selection</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="bundi" checked={useBundi} onCheckedChange={(e) => setUseBundi(!!e)} />
                <Label htmlFor="bundi" className="text-xs text-white/80 font-medium cursor-pointer">Use Bundi for Fine Tuning</Label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CENTER: Selected Metals */}
        <div className="xl:col-span-4 flex flex-col h-[500px] xl:h-[calc(100vh-250px)]">
          <Card className="bg-[#111827] border-white/5 flex-1 flex flex-col overflow-hidden">
            <CardHeader className="pb-4 border-b border-white/5 bg-[#111827] z-10 shrink-0 flex flex-col space-y-3">
              <div className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-white flex items-center">
                  <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> Ideal Mix Suggestion
                </CardTitle>
                {selectedMetals.length > 0 && (
                  <Button 
                    size="sm" variant="ghost" 
                    onClick={() => setSelectedMetalIds(new Set())}
                    className="h-6 text-[10px] uppercase text-muted-foreground hover:text-rose-400 px-2"
                  >
                    Clear All
                  </Button>
                )}
              </div>
              <div className="space-y-1.5 bg-[#09090B] p-3 rounded-xl border border-primary/20">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] font-bold text-primary uppercase tracking-widest">Adjust Used Katra</Label>
                  <div className="flex gap-3 text-[10px] font-mono text-muted-foreground">
                    <span>W: <span className="text-white">{formatDecimal(kUsed)}</span>g</span>
                    <span>P: <span className="text-white">{formatDecimal(kPurity)}</span>%</span>
                    <span>F: <span className="text-primary">{formatDecimal(kFine)}</span>g</span>
                  </div>
                </div>
                <input 
                  type="range" min="0" max={kAvail || 100} step="0.01"
                  value={katraUsedWeight} onChange={e => setKatraUsedWeight(e.target.value)}
                  className="w-full accent-primary h-1 bg-white/10 rounded-lg appearance-none cursor-pointer mt-2"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1 scrollbar-hide">
              {selectedMetals.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                  <Activity className="h-8 w-8 mb-3 opacity-20" />
                  <p className="text-sm">No metals selected.</p>
                  <p className="text-xs opacity-50 mt-1">Click "Generate Ideal Mix" to automate selection.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {selectedMetals.map(m => (
                    <div key={m.virtual_id || m.metal_id} className="p-3 flex items-center justify-between bg-emerald-500/[0.02] hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center space-x-3">
                        <Checkbox 
                          checked={true} 
                          onCheckedChange={() => toggleMetal(m.virtual_id || m.metal_id)}
                          className="border-emerald-500/50 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-white"
                        />
                        <div>
                          <p className="text-[11px] font-bold text-white leading-tight">{m.custom_type || m.metal_type}</p>
                          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{formatDecimal(m.weight)}g @ {formatDecimal(m.purity)}%</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-emerald-400 font-mono">{formatDecimal(m.fine)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            
            <div className="p-4 border-t border-white/5 bg-[#09090B] shrink-0">
              <Button 
                onClick={prepareConfirmation} 
                disabled={selectedMetals.length === 0 && kUsed === 0}
                className="w-full bg-emerald-500 hover:bg-emerald-600 border-0 font-bold shadow-lg shadow-emerald-500/20 text-white h-12 text-base transition-colors"
              >
                Confirm MEL Formulation
              </Button>
            </div>
          </Card>
        </div>

        {/* RIGHT PANEL: Available Metals */}
        <div className="xl:col-span-5 flex flex-col h-[500px] xl:h-[calc(100vh-250px)] mt-4 xl:mt-0">
          <Card className="bg-[#111827] border-white/5 flex-1 flex flex-col overflow-hidden">
            <CardHeader className="pb-4 border-b border-white/5 bg-[#111827] z-10 shrink-0">
              <CardTitle className="text-sm font-bold text-white flex items-center justify-between">
                <span>Available Materials ({unselectedMetals.length})</span>
                <span className="text-[10px] text-muted-foreground uppercase font-normal">For Manual Adjustments</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1 scrollbar-hide">
              {unselectedMetals.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <p className="text-sm">No available metals in stock.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {unselectedMetals.map(m => (
                    <div key={m.virtual_id || m.metal_id} className="p-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors group">
                      <div className="flex items-center space-x-3 flex-1 cursor-pointer" onClick={() => toggleMetal(m.virtual_id || m.metal_id)}>
                        <Checkbox 
                          checked={false} 
                          onCheckedChange={() => toggleMetal(m.virtual_id || m.metal_id)}
                          className="border-white/20 group-hover:border-primary/50 transition-colors"
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[11px] font-bold text-white/90 leading-tight max-w-[200px] truncate">{m.custom_type || m.metal_type}</span>
                            {!m.virtual_id && (
                              <span className="text-[9px] px-1.5 rounded bg-white/5 text-muted-foreground font-mono shrink-0">
                                {(m.parties?.name || "").substring(0, 8)}
                              </span>
                            )}
                          </div>
                          <div className="flex space-x-2 mt-1 text-[10px] font-mono text-muted-foreground/80">
                            <span>W: <span className="text-white/70">{formatDecimal(m.weight)}</span></span>
                            <span>P: <span className="text-white/70">{formatDecimal(m.purity)}</span></span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        {/* Piece-wise Button for all relevant metals */}
                        {usePiecewiseChorsa && !m.virtual_id && ['Chorsa', 'Copper', 'Peti', 'Bundi'].includes(m.metal_type) && (
                          <Button 
                            variant="ghost" size="icon" 
                            onClick={(e) => { e.stopPropagation(); setMetalToSplit(m); setSplitModalOpen(true); }}
                            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg shrink-0"
                            title="Split Piece"
                          >
                            <Scissors className="h-3 w-3" />
                          </Button>
                        )}
                        
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-primary/80 font-mono">{formatDecimal(m.fine)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Split Modal */}
      {splitModalOpen && metalToSplit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-sm shadow-2xl border-primary/20 bg-[#18181B] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-lg font-bold text-white flex items-center">
                <Scissors className="mr-2 h-5 w-5 text-primary" /> Split {metalToSplit.metal_type}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="bg-[#09090B] p-3 rounded-xl border border-white/5 mb-4 text-xs font-mono text-muted-foreground">
                Original Weight: <span className="text-white font-bold">{formatDecimal(metalToSplit.weight)}</span> g
              </div>
              <form onSubmit={handleSplitChorsa} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Enter Piece Weights (comma separated)</Label>
                  <Input 
                    placeholder="e.g. 493, 510"
                    value={splitWeights}
                    onChange={(e) => setSplitWeights(e.target.value)}
                    className="bg-[#09090B] border-white/5 font-mono"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setSplitModalOpen(false)} className="text-muted-foreground">Cancel</Button>
                  <Button type="submit" className="orange-gradient text-white font-bold">Split</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirm Details Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl border-emerald-500/20 bg-[#18181B] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-lg font-bold text-white flex items-center">
                <Save className="mr-2 h-5 w-5 text-emerald-400" /> Save MEL Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
              
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Custom MEL Name</Label>
                <Input 
                  value={customMelName}
                  onChange={(e) => setCustomMelName(e.target.value)}
                  className="bg-[#09090B] border-white/5"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">System Generated ID (Immutable)</Label>
                <div className="bg-[#09090B] border border-white/5 p-3 rounded-lg flex items-center">
                  <span className="font-mono text-sm text-primary/80 font-bold">{generatedMelId}</span>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-white/5">
                <Button type="button" variant="ghost" onClick={() => setConfirmModalOpen(false)} disabled={isFinalizing} className="text-muted-foreground">Cancel</Button>
                <Button type="button" onClick={handleFinalize} disabled={isFinalizing} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold">
                  {isFinalizing ? "Saving..." : "Save & Generate Receipt"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  )
}
