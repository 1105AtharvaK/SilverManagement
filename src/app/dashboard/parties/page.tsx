"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Edit2, Trash2, ChevronRight, X, User, Briefcase, Building2, CircleUser, SquareUser, Hexagon, Star, BadgeCheck } from "lucide-react"
import toast from "react-hot-toast"

const PARTY_ICONS = [User, Briefcase, Building2, CircleUser, SquareUser, Hexagon, Star, BadgeCheck];

const getPartyIcon = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const Icon = PARTY_ICONS[Math.abs(hash) % PARTY_ICONS.length];
  return <Icon className="h-6 w-6 text-primary/70 shrink-0" />;
}

export default function PartiesPage() {
  const [parties, setParties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingParty, setEditingParty] = useState<any>(null)
  
  const [name, setName] = useState("")
  const [contact, setContact] = useState("")

  const fetchParties = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("parties")
      .select("*")
      .order("created_at", { ascending: false })
    
    if (error) {
      toast.error("Error fetching parties")
    } else {
      setParties(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchParties()
  }, [])

  const handleOpenModal = (party?: any) => {
    if (party) {
      setEditingParty(party)
      setName(party.name)
      setContact(party.contact || "")
    } else {
      setEditingParty(null)
      setName("")
      setContact("")
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingParty(null)
    setName("")
    setContact("")
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (editingParty) {
      const { error } = await supabase
        .from("parties")
        .update({ name, contact })
        .eq("id", editingParty.id)
      
      if (error) {
        toast.error("Error updating party")
      } else {
        toast.success("Party updated")
        fetchParties()
        handleCloseModal()
      }
    } else {
      const { error } = await supabase
        .from("parties")
        .insert([{ user_id: user.id, name, contact }])
      
      if (error) {
        toast.error("Error adding party")
      } else {
        toast.success("Party added")
        fetchParties()
        handleCloseModal()
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this party? All related data might be affected if not properly handled.")) return
    
    const { error } = await supabase.from("parties").delete().eq("id", id)
    if (error) {
      if (error.code === '23503') { // Foreign key violation
        toast.error("Cannot delete party. Please delete their associated batches in the In-Stock page first.", { duration: 5000 })
      } else {
        toast.error(error.message || "Error deleting party.")
      }
    } else {
      toast.success("Party deleted")
      fetchParties()
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Parties</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage your contacts and parties</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="orange-gradient border-0 text-white font-bold shadow-lg shadow-orange-500/20">
          <Plus className="mr-2 h-4 w-4" /> Add Party
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : parties.length === 0 ? (
        <div className="text-center py-20 bg-[#18181B] border border-white/5 rounded-2xl">
          <p className="text-muted-foreground">No parties found. Add one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {parties.map((party) => (
            <Card key={party.id} className="relative group overflow-hidden transition-all hover:translate-y-[-4px] bg-[#18181B] border-white/5 rounded-2xl">
              <CardContent className="p-0">
                <Link href={`/dashboard/parties/${party.id}`} className="block p-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-primary/10 rounded-xl">
                        {getPartyIcon(party.name)}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg">{party.name}</h3>
                        {party.contact && <p className="text-xs text-muted-foreground mt-1 tracking-tight">{party.contact}</p>}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
                  </div>
                </Link>
                <div className="absolute top-4 right-12 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenModal(party); }} className="p-2 bg-[#27272A] rounded-lg text-muted-foreground hover:text-primary hover:bg-[#27272A]/80 transition-colors">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(party.id); }} className="p-2 bg-[#27272A] rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-[#27272A]/80 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl border-white/10 bg-[#18181B] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-white/5">
              <h3 className="text-lg font-bold text-white">{editingParty ? "Edit Party" : "Add New Party"}</h3>
              <button onClick={handleCloseModal} className="text-muted-foreground hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleSave} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Party Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                    className="bg-[#09090B] border-white/5 focus:border-primary/50 transition-all rounded-xl h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Contact Information</Label>
                  <Input
                    id="contact"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="Email or Phone"
                    className="bg-[#09090B] border-white/5 focus:border-primary/50 transition-all rounded-xl h-11"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <Button type="button" variant="ghost" onClick={handleCloseModal} className="text-muted-foreground hover:text-white rounded-xl">Cancel</Button>
                  <Button type="submit" className="orange-gradient border-0 text-white font-bold px-8 rounded-xl shadow-lg shadow-orange-500/20">
                    {editingParty ? "Save Changes" : "Create Party"}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

