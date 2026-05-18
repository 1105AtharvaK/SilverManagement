"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import toast from "react-hot-toast"
import { calculateFine, formatDecimal } from "@/lib/utils"

export default function AddBatchPage() {
  const router = useRouter()
  const [parties, setParties] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  
  const { register, control, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      party_id: "",
      batch_title: "",
      date_time: new Date().toISOString().slice(0, 16),
      received_from: "",
      order_receipt_type: "Yes",
      order_receipt_image: "",
      metal_receipt_image: "",
      metals: [
        { metal_type: "Chorsa", custom_type: "", weight: "", purity: "", fine: "0.00" }
      ]
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "metals"
  })

  const watchMetals = watch("metals")

  useEffect(() => {
    const fetchParties = async () => {
      const { data } = await supabase.from("parties").select("id, name").order("name")
      if (data) setParties(data)
    }
    fetchParties()
  }, [])

  // Auto-calculate fine when weight or purity changes
  useEffect(() => {
    const subscription = watch((value, { name, type }) => {
      if (name?.startsWith("metals.") && (name.endsWith("weight") || name.endsWith("purity"))) {
        const index = parseInt(name.split(".")[1])
        const weight = parseFloat(value.metals?.[index]?.weight || "0")
        const purity = parseFloat(value.metals?.[index]?.purity || "0")
        if (!isNaN(weight) && !isNaN(purity)) {
          setValue(`metals.${index}.fine`, formatDecimal(calculateFine(weight, purity), 4))
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, setValue])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: "order_receipt_image" | "metal_receipt_image") => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setUploadingReceipt(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Math.random()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('receipts').getPublicUrl(fileName)
      setValue(fieldName, data.publicUrl)
      toast.success("Image uploaded")
    } catch (error: any) {
      toast.error(error.message || "Failed to upload image")
    } finally {
      setUploadingReceipt(false)
    }
  }

  const onSubmit = async (data: any) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // 1. Insert Batch
      const { data: batchData, error: batchError } = await supabase
        .from("batches")
        .insert([{
          user_id: user.id,
          party_id: data.party_id,
          batch_title: data.batch_title,
          date_time: new Date(data.date_time).toISOString(),
          received_from: data.received_from,
          order_receipt_type: data.order_receipt_type,
          order_receipt_image: data.order_receipt_image,
          metal_receipt_image: data.metal_receipt_image
        }])
        .select()
        .single()

      if (batchError) throw batchError

      // 2. Insert Metals
      const metalsToInsert = data.metals.map((m: any) => ({
        user_id: user.id,
        batch_id: batchData.batch_id,
        party_id: data.party_id,
        metal_type: m.metal_type,
        custom_type: m.metal_type === "Others" ? m.custom_type : null,
        weight: parseFloat(m.weight),
        purity: parseFloat(m.purity),
        fine: parseFloat(m.fine),
        is_used: false
      }))

      const { error: metalsError } = await supabase
        .from("metal_items")
        .insert(metalsToInsert)

      if (metalsError) throw metalsError

      toast.success("Batch and metals added successfully!")
      router.push("/dashboard/in-stock")
    } catch (error: any) {
      toast.error(error.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Add In-Stock Batch</h2>
          <p className="text-muted-foreground">Record a new batch of received silver</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Batch Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Batch Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 col-span-full md:col-span-1">
              <Label>Party</Label>
              <select 
                {...register("party_id", { required: true })}
                className="flex h-11 w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select a party</option>
                {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            
            <div className="space-y-2">
              <Label>Batch Title</Label>
              <Input {...register("batch_title", { required: true })} placeholder="e.g. June Delivery 1" />
            </div>

            <div className="space-y-2">
              <Label>Date & Time</Label>
              <Input type="datetime-local" {...register("date_time", { required: true })} />
            </div>

            <div className="space-y-2">
              <Label>Received From</Label>
              <Input {...register("received_from")} placeholder="Name of person deliverying" />
            </div>

            <div className="space-y-2">
              <Label>Order Receipt Type</Label>
              <select 
                {...register("order_receipt_type")}
                className="flex h-11 w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Order Receipt Image</Label>
              <Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, "order_receipt_image")} disabled={uploadingReceipt} />
            </div>

            <div className="space-y-2 col-span-full md:col-span-1">
              <Label>Metal Receipt Image</Label>
              <Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, "metal_receipt_image")} disabled={uploadingReceipt} />
            </div>
          </CardContent>
        </Card>

        {/* Metals Card */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Metals Received</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ metal_type: "Chorsa", custom_type: "", weight: "", purity: "", fine: "0.00" })}>
              <Plus className="mr-2 h-4 w-4" /> Add Metal
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 rounded-xl glass-card relative group">
                <div className="absolute -top-3 -right-3">
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(index)} className="p-2 bg-destructive text-destructive-foreground rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                
                <div className="grid gap-4 md:grid-cols-5">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Metal Type</Label>
                    <select 
                      {...register(`metals.${index}.metal_type` as const, { required: true })}
                      className="flex h-11 w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="Chorsa">Chorsa</option>
                      <option value="Patla">Patla</option>
                      <option value="Peti">Peti</option>
                      <option value="Copper">Copper</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>

                  {watchMetals[index]?.metal_type === "Others" && (
                    <div className="space-y-2 md:col-span-3">
                      <Label>Custom Type</Label>
                      <Input {...register(`metals.${index}.custom_type` as const, { required: true })} placeholder="Specify metal type" />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Weight (g)</Label>
                    <Input type="number" step="0.0001" {...register(`metals.${index}.weight` as const, { required: true, min: 0.0001 })} placeholder="0.00" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Purity (%)</Label>
                    <Input type="number" step="0.0001" max="100" {...register(`metals.${index}.purity` as const, { required: true, min: 0, max: 100 })} placeholder="99.99" />
                  </div>

                  <div className="space-y-2">
                    <Label>Fine (g)</Label>
                    <Input {...register(`metals.${index}.fine` as const)} readOnly className="bg-primary/10 border-primary/20 text-primary font-bold font-mono" />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={loading || uploadingReceipt} className="w-full md:w-auto px-12">
            {loading ? "Saving..." : "Save Batch"}
          </Button>
        </div>
      </form>
    </div>
  )
}
