"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase/client"
import { cn, formatDecimal } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, ChevronDown, ChevronUp, CheckCircle2, Trash2, Activity } from "lucide-react"
import toast from "react-hot-toast"

export default function InStockPage() {
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({})
  
  // Modal state for marking as used
  const [useModalOpen, setUseModalOpen] = useState(false)
  const [selectedMetal, setSelectedMetal] = useState<any>(null)
  const [melId, setMelId] = useState("")

  // Modal state for deleting batch
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [batchToDelete, setBatchToDelete] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Modal state for adding late metal
  const [addMetalModalOpen, setAddMetalModalOpen] = useState(false)
  const [batchForNewMetal, setBatchForNewMetal] = useState<any>(null)
  const [newMetal, setNewMetal] = useState({ metal_type: "Chorsa", custom_type: "", weight: "", purity: "" })
  const [isAddingMetal, setIsAddingMetal] = useState(false)

  const fetchInStock = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("batches")
      .select(`
        *,
        parties (name),
        metal_items (*)
      `)
      .order("date_time", { ascending: false })

    if (error) {
      toast.error("Error fetching inventory")
    } else {
      setBatches(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchInStock()
  }, [])

  const toggleBatch = (batchId: string) => {
    setExpandedBatches(prev => ({
      ...prev,
      [batchId]: !prev[batchId]
    }))
  }

  const handleOpenUseModal = (metal: any) => {
    if (metal.is_used) return
    setSelectedMetal(metal)
    setMelId("")
    setUseModalOpen(true)
  }

  const handleMarkAsUsed = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMetal) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // 1. Update metal_items.is_used = true
      const { error: updateError } = await supabase
        .from("metal_items")
        .update({ is_used: true })
        .eq("metal_id", selectedMetal.metal_id)

      if (updateError) throw updateError

      // 2. Insert into out_stock
      const { error: insertError } = await supabase
        .from("out_stock")
        .insert([{
          user_id: user.id,
          metal_id: selectedMetal.metal_id,
          party_id: selectedMetal.party_id,
          metal_type: selectedMetal.metal_type === "Others" ? selectedMetal.custom_type : selectedMetal.metal_type,
          weight: selectedMetal.weight,
          purity: selectedMetal.purity,
          fine: selectedMetal.fine,
          mel_id: melId
        }])

      if (insertError) {
        // Rollback is_used if insert fails (manual rollback for now)
        await supabase.from("metal_items").update({ is_used: false }).eq("metal_id", selectedMetal.metal_id)
        throw insertError
      }

      toast.success("Metal marked as used and added to out-stock!")
      setUseModalOpen(false)
      fetchInStock() // Refresh data

    } catch (error: any) {
      toast.error(error.message || "Failed to mark as used")
    }
  }

  const handleOpenDeleteModal = (e: React.MouseEvent, batch: any) => {
    e.stopPropagation() // Prevent toggling the accordion
    setBatchToDelete(batch)
    setDeleteModalOpen(true)
  }

  const confirmDeleteBatch = async () => {
    if (!batchToDelete) return
    setIsDeleting(true)
    
    try {
      const metalIds = batchToDelete.metal_items.map((m: any) => m.metal_id)
      
      if (metalIds.length > 0) {
        // Delete out_stock items first
        const { error: outStockError } = await supabase
          .from("out_stock")
          .delete()
          .in("metal_id", metalIds)
          
        if (outStockError) throw outStockError
        
        // Delete metal items
        const { error: metalsError } = await supabase
          .from("metal_items")
          .delete()
          .eq("batch_id", batchToDelete.batch_id)
          
        if (metalsError) throw metalsError
      }
      
      // Delete batch
      const { error: batchError } = await supabase
        .from("batches")
        .delete()
        .eq("batch_id", batchToDelete.batch_id)
        
      if (batchError) throw batchError
      
      toast.success("Batch deleted successfully")
      setDeleteModalOpen(false)
      fetchInStock()
    } catch (error: any) {
      toast.error(error.message || "Failed to delete batch")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleOpenAddMetalModal = (batch: any) => {
    setBatchForNewMetal(batch)
    setNewMetal({ metal_type: "Chorsa", custom_type: "", weight: "", purity: "" })
    setAddMetalModalOpen(true)
  }

  const handleAddLateMetal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!batchForNewMetal) return
    setIsAddingMetal(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const weight = parseFloat(newMetal.weight)
      const purity = parseFloat(newMetal.purity)
      const fine = (weight * purity) / 100

      const { error } = await supabase.from("metal_items").insert([{
        user_id: user.id,
        batch_id: batchForNewMetal.batch_id,
        party_id: batchForNewMetal.party_id,
        metal_type: newMetal.metal_type,
        custom_type: newMetal.metal_type === "Others" ? newMetal.custom_type : null,
        weight: weight,
        purity: purity,
        fine: fine,
        is_used: false
      }])

      if (error) throw error

      toast.success("Late metal added to batch successfully!")
      setAddMetalModalOpen(false)
      fetchInStock()
    } catch (error: any) {
      toast.error(error.message || "Failed to add metal")
    } finally {
      setIsAddingMetal(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">In-Stock</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage received batches and mark items as used</p>
        </div>
        <Link href="/dashboard/in-stock/add">
          <Button className="orange-gradient border-0 text-white font-bold shadow-lg shadow-orange-500/20">
            <Plus className="mr-2 h-4 w-4" /> Add Batch
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : batches.length === 0 ? (
        <div className="text-center py-20 bg-[#18181B] border border-white/5 rounded-2xl">
          <p className="text-muted-foreground">No batches found. Add your first batch to begin.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => {
            const isExpanded = expandedBatches[batch.batch_id]
            const totalWeight = batch.metal_items.reduce((acc: number, item: any) => acc + Number(item.weight), 0)
            const totalFine = batch.metal_items.reduce((acc: number, item: any) => acc + Number(item.fine), 0)
            const isAllUsed = batch.metal_items.every((item: any) => item.is_used)

            return (
              <Card key={batch.batch_id} className={cn(
                "overflow-hidden transition-all bg-[#18181B] border-white/5 rounded-2xl",
                isAllUsed ? 'opacity-60' : 'hover:border-white/10'
              )}>
                <div 
                  className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => toggleBatch(batch.batch_id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-bold text-white text-lg">{batch.batch_title}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                        {batch.parties?.name}
                      </span>
                      {isAllUsed && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#09090B] text-muted-foreground border border-white/5 flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> All Used
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">
                      {new Date(batch.date_time).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  
                  <div className="mt-4 sm:mt-0 flex items-center space-x-6">
                    <div className="text-right">
                      <div className="text-sm font-bold text-white font-mono">{formatDecimal(totalWeight)} g</div>
                      <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Fine: {formatDecimal(totalFine)} g</div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={(e) => handleOpenDeleteModal(e, batch)} 
                        className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                        title="Delete Batch"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <div className={cn("p-1.5 rounded-full bg-secondary transition-all", isExpanded && "rotate-180")}>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expandable Content */}
                {isExpanded && (
                  <div className="p-6 border-t border-white/5 bg-[#09090B]/50 animate-in slide-in-from-top-2 duration-300">
                    <div className="overflow-hidden rounded-xl border border-white/5 bg-[#09090B]">
                      <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-muted-foreground uppercase bg-white/[0.02] border-b border-white/5">
                          <tr>
                            <th className="px-6 py-4 font-bold tracking-wider">Type</th>
                            <th className="px-6 py-4 text-right font-bold tracking-wider">Weight</th>
                            <th className="px-6 py-4 text-right font-bold tracking-wider">Purity</th>
                            <th className="px-6 py-4 text-right font-bold tracking-wider text-primary">Fine</th>
                            <th className="px-6 py-4 text-center font-bold tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {batch.metal_items.map((metal: any) => (
                            <tr key={metal.metal_id} className={cn(
                              "group transition-colors",
                              metal.is_used ? "opacity-40" : "hover:bg-white/[0.01]"
                            )}>
                              <td className="px-6 py-4 font-bold text-white">
                                {metal.metal_type === "Others" ? metal.custom_type : metal.metal_type}
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-muted-foreground">{formatDecimal(metal.weight)}</td>
                              <td className="px-6 py-4 text-right font-mono text-muted-foreground">{formatDecimal(metal.purity)}</td>
                              <td className="px-6 py-4 text-right font-mono font-bold text-primary">{formatDecimal(metal.fine)}</td>
                              <td className="px-6 py-4 text-center">
                                {metal.is_used ? (
                                  <span className="inline-flex items-center text-[10px] font-bold text-muted-foreground uppercase">
                                    <CheckCircle2 className="w-3 h-3 mr-1.5 text-primary/50" /> Used
                                  </span>
                                ) : (
                                  <div 
                                    onClick={() => handleOpenUseModal(metal)}
                                    className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20 cursor-pointer hover:bg-primary hover:text-white transition-all active:scale-95"
                                  >
                                    Mark as Used
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenAddMetalModal(batch)} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-white">
                        <Plus className="mr-1.5 h-3 w-3" /> Add Late Metal
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Use Metal Modal */}
      {useModalOpen && selectedMetal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl border-white/10 bg-[#18181B] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-lg font-bold text-white">Item Verification</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="bg-[#09090B] p-5 rounded-2xl border border-white/5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Metal Type</span>
                  <span className="text-sm font-bold text-white">{selectedMetal.metal_type === "Others" ? selectedMetal.custom_type : selectedMetal.metal_type}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Weight / Purity</span>
                  <span className="text-sm font-mono text-muted-foreground">{formatDecimal(selectedMetal.weight)}g @ {formatDecimal(selectedMetal.purity)}%</span>
                </div>
                <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Calculated Fine</span>
                  <span className="text-xl font-bold text-primary font-mono">{formatDecimal(selectedMetal.fine)} g</span>
                </div>
              </div>

              <form onSubmit={handleMarkAsUsed} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="melId" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Melting ID (mel_id)</Label>
                  <Input
                    id="melId"
                    value={melId}
                    onChange={(e) => setMelId(e.target.value)}
                    placeholder="e.g. SgkU-110226"
                    required
                    autoFocus
                    className="bg-[#09090B] border-white/5 focus:border-primary/50 transition-all rounded-xl h-11"
                  />
                  <p className="text-[10px] text-muted-foreground/60 leading-relaxed italic">Identifier for future traceability in Out-Stock records.</p>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setUseModalOpen(false)} className="text-muted-foreground hover:text-white rounded-xl">Cancel</Button>
                  <Button type="submit" className="orange-gradient border-0 text-white font-bold px-8 rounded-xl shadow-lg shadow-orange-500/20">
                    Confirm Usage
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Batch Modal */}
      {deleteModalOpen && batchToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl border-rose-500/20 bg-[#18181B] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-rose-500 flex items-center text-lg font-bold">
                <Trash2 className="mr-3 h-5 w-5" /> Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <p className="text-sm text-white/80 leading-relaxed">
                Delete <span className="font-bold text-white">{batchToDelete.batch_title}</span>? This action is irreversible and will remove all associated item and history records.
              </p>
              
              <div className="bg-rose-500/5 border border-rose-500/20 p-4 rounded-2xl text-[11px] text-rose-200/80 leading-relaxed">
                <p className="font-bold uppercase tracking-widest mb-2 text-rose-400">Affected Records:</p>
                <ul className="list-disc pl-5 space-y-1 opacity-80">
                  <li>Master Batch Entry</li>
                  <li>{batchToDelete.metal_items.length} Individual Metal Items</li>
                  <li>History for all used items in this batch</li>
                </ul>
              </div>
              
              <div className="flex justify-end space-x-3 pt-2">
                <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} disabled={isDeleting} className="text-muted-foreground hover:text-white rounded-xl">Cancel</Button>
                <Button variant="destructive" onClick={confirmDeleteBatch} disabled={isDeleting} className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-8 rounded-xl shadow-lg shadow-rose-500/20 border-0">
                  {isDeleting ? "Deleting..." : "Confirm Delete"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Late Metal Modal */}
      {addMetalModalOpen && batchForNewMetal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl border-white/10 bg-[#18181B] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-lg font-bold text-white">Append Stock: {batchForNewMetal.batch_title}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleAddLateMetal} className="space-y-5">
                <div className="grid gap-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Metal Type</Label>
                    <select 
                      value={newMetal.metal_type}
                      onChange={(e) => setNewMetal({...newMetal, metal_type: e.target.value})}
                      className="flex h-11 w-full rounded-xl border border-white/5 bg-[#09090B] px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all appearance-none cursor-pointer"
                      required
                    >
                      <option value="Chorsa">Chorsa</option>
                      <option value="Patla">Patla</option>
                      <option value="Peti">Peti</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>

                  {newMetal.metal_type === "Others" && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Custom Type</Label>
                      <Input 
                        value={newMetal.custom_type}
                        onChange={(e) => setNewMetal({...newMetal, custom_type: e.target.value})}
                        placeholder="Specify metal type" 
                        required 
                        className="bg-[#09090B] border-white/5 rounded-xl h-11"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Weight (g)</Label>
                      <Input 
                        type="number" step="0.0001" min="0.0001"
                        value={newMetal.weight}
                        onChange={(e) => setNewMetal({...newMetal, weight: e.target.value})}
                        placeholder="0.0000" 
                        required 
                        className="bg-[#09090B] border-white/5 rounded-xl h-11 font-mono"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Purity (%)</Label>
                      <Input 
                        type="number" step="0.0001" min="0.0001" max="100"
                        value={newMetal.purity}
                        onChange={(e) => setNewMetal({...newMetal, purity: e.target.value})}
                        placeholder="99.99" 
                        required 
                        className="bg-[#09090B] border-white/5 rounded-xl h-11 font-mono"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 flex justify-between items-center mt-2">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Calculated Fine</span>
                  <span className="font-mono font-bold text-primary text-lg">
                    {newMetal.weight && newMetal.purity 
                      ? formatDecimal((parseFloat(newMetal.weight) * parseFloat(newMetal.purity)) / 100, 4) 
                      : "0.0000"} g
                  </span>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setAddMetalModalOpen(false)} disabled={isAddingMetal} className="text-muted-foreground hover:text-white rounded-xl">Cancel</Button>
                  <Button type="submit" disabled={isAddingMetal} className="orange-gradient border-0 text-white font-bold px-8 rounded-xl shadow-lg shadow-orange-500/20">
                    {isAddingMetal ? "Adding..." : "Append Metal"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

