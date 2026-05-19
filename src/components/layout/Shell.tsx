"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { 
  LayoutDashboard, Users, Package, ArrowRightLeft, LogOut, 
  Search, Bell, Settings, Wallet, CreditCard, Repeat, ArrowUpRight, 
  HelpCircle, Sparkles, MessageSquare, Menu
} from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase/client"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"

const sidebarGroups = [
  {
    title: "MAIN",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Parties", href: "/dashboard/parties", icon: Users },
      { name: "In-Stock", href: "/dashboard/in-stock", icon: Package },
      { name: "Out-Stock", href: "/dashboard/out-stock", icon: ArrowRightLeft },
    ]
  },
  {
    title: "MEL",
    items: [
      { name: "MEL System", href: "/dashboard/mel", icon: Repeat },
      { name: "MELs", href: "/dashboard/mels", icon: Sparkles },
    ]
  }
]

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [profile, setProfile] = React.useState<any>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<any[]>([])

  React.useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) throw error;
        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single()
          if (data) setProfile(data)
        }
      } catch (err) {
        console.error("Profile fetch error (auth lock):", err)
      }
    }
    fetchProfile()
  }, [])

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length > 0) {
      const q = query.toLowerCase()
      // Search pages
      const pageResults = [
        { id: 'dashboard', name: 'Dashboard', href: '/dashboard', type: 'page' },
        { id: 'parties', name: 'Parties', href: '/dashboard/parties', type: 'page' },
        { id: 'in-stock', name: 'In-Stock', href: '/dashboard/in-stock', type: 'page' },
        { id: 'out-stock', name: 'Out-Stock', href: '/dashboard/out-stock', type: 'page' },
        { id: 'mel-system', name: 'MEL System', href: '/dashboard/mel', type: 'page' },
        { id: 'mels', name: 'MELs', href: '/dashboard/mels', type: 'page' },
      ].filter(p => p.name.toLowerCase().includes(q))

      // Search parties from DB
      let partyResults: any[] = []
      let melResults: any[] = []
      let inStockResults: any[] = []
      let outStockResults: any[] = []
      
      if (query.length > 1) {
        const { data: pData } = await supabase
          .from("parties")
          .select("id, name")
          .ilike("name", `%${query}%`)
          .limit(3)
        partyResults = (pData || []).map(p => ({ ...p, href: `/dashboard/parties/${p.id}`, type: 'party' }))

        const { data: mData } = await supabase
          .from("mels")
          .select("mel_id, mel_name")
          .or(`mel_name.ilike.%${query}%,mel_id.ilike.%${query}%`)
          .limit(3)
        melResults = (mData || []).map(m => ({ id: m.mel_id, name: m.mel_name || m.mel_id, href: `/dashboard/mels/${m.mel_id}/receipt`, type: 'mel' }))

        const { data: inData } = await supabase
          .from("metal_items")
          .select("metal_id, metal_type, custom_type, parties(id, name)")
          .or(`custom_type.ilike.%${query}%,metal_type.ilike.%${query}%`)
          .limit(3)
        inStockResults = (inData || []).map((m: any) => {
          const partyInfo: any = m.parties;
          const partyName = Array.isArray(partyInfo) ? partyInfo[0]?.name : partyInfo?.name;
          const partyId = Array.isArray(partyInfo) ? partyInfo[0]?.id : partyInfo?.id;
          return { id: m.metal_id, name: `${m.custom_type || m.metal_type} (${partyName || 'In-Stock'})`, href: partyId ? `/dashboard/parties/${partyId}` : `/dashboard/in-stock`, type: 'in-stock' }
        })

        const { data: outData } = await supabase
          .from("out_stock")
          .select("out_id, metal_type, parties(id, name)")
          .ilike("metal_type", `%${query}%`)
          .limit(3)
        outStockResults = (outData || []).map((m: any) => {
          const partyInfo: any = m.parties;
          const partyName = Array.isArray(partyInfo) ? partyInfo[0]?.name : partyInfo?.name;
          const partyId = Array.isArray(partyInfo) ? partyInfo[0]?.id : partyInfo?.id;
          return { id: m.out_id, name: `${m.metal_type} (${partyName || 'Out-Stock'})`, href: partyId ? `/dashboard/parties/${partyId}` : `/dashboard/out-stock`, type: 'out-stock' }
        })
      }

      setSearchResults([...pageResults, ...partyResults, ...melResults, ...inStockResults, ...outStockResults])
    } else {
      setSearchResults([])
    }
  }

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error("Error logging out")
    } else {
      router.push("/login")
    }
  }

  const NavItem = ({ item, isActive }: { item: any, isActive: boolean }) => (
    <Link
      href={item.href}
      onClick={() => setMobileMenuOpen(false)}
      className={cn(
        "flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all group",
        isActive
          ? "sidebar-active"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
      )}
    >
      <item.icon className={cn("h-5 w-5 transition-colors", isActive ? "text-primary" : "group-hover:text-foreground")} />
      <span className="font-medium text-sm">{item.name}</span>
      {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
    </Link>
  )

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 flex-col border-r border-white/5 bg-[#09090B] p-6">
        <div className="flex items-center space-x-3 mb-10 px-2">
          <div className="w-10 h-10 rounded-xl orange-gradient flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">SilverTrack</h1>
        </div>

        <div className="flex-1 overflow-y-auto space-y-8 scrollbar-hide">
          {sidebarGroups.map((group) => (
            <div key={group.title} className="space-y-3">
              <h3 className="px-4 text-[11px] font-bold tracking-[0.1em] text-muted-foreground/60">
                {group.title}
              </h3>
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || (pathname.startsWith(item.href + '/') && item.href !== "/dashboard")
                  return <NavItem key={item.name} item={item} isActive={isActive} />
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-6">
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 px-4 py-2.5 w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all group"
          >
            <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform" />
            <span className="font-medium text-sm">Logout Session</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#000000]">
        {/* Header Navigation */}
        <header className="h-20 flex items-center justify-between px-6 md:px-10 border-b border-white/5 bg-background/50 backdrop-blur-md z-20">
          <div className="flex items-center flex-1 max-w-2xl">
            <button 
              className="md:hidden mr-4 text-muted-foreground p-2"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="relative w-full max-w-md hidden sm:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search parties, MELs, inventory..." 
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full bg-[#18181B] border border-white/5 rounded-full py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#18181B] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                  {searchResults.map((party) => (
                    <button
                      key={party.id}
                      onClick={() => {
                        router.push(party.href)
                        setSearchQuery("")
                        setSearchResults([])
                      }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                    >
                      <div className="flex items-center space-x-3">
                        {party.type === 'page' ? (
                          <LayoutDashboard className="h-4 w-4 text-primary/60" />
                        ) : party.type === 'mel' ? (
                          <Sparkles className="h-4 w-4 text-emerald-400" />
                        ) : party.type === 'in-stock' ? (
                          <Package className="h-4 w-4 text-primary" />
                        ) : party.type === 'out-stock' ? (
                          <ArrowRightLeft className="h-4 w-4 text-rose-500" />
                        ) : (
                          <Users className="h-4 w-4 text-primary" />
                        )}
                        <span className="text-white font-medium">{party.name}</span>
                        {party.type === 'page' && <span className="text-[10px] text-muted-foreground uppercase tracking-widest ml-auto">Menu</span>}
                        {party.type === 'mel' && <span className="text-[10px] text-emerald-400/50 uppercase tracking-widest ml-auto">MEL</span>}
                        {party.type === 'in-stock' && <span className="text-[10px] text-primary/50 uppercase tracking-widest ml-auto">IN</span>}
                        {party.type === 'out-stock' && <span className="text-[10px] text-rose-500/50 uppercase tracking-widest ml-auto">OUT</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3 md:space-x-5">
            <div className="h-10 w-[1px] bg-white/10 hidden md:block" />
            <div className="flex items-center space-x-3 pl-2">
              <div className="text-right hidden lg:block">
                <p className="text-sm font-bold text-white">{profile?.full_name || "User"}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Account Settings</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center p-0.5 overflow-hidden">
                <span className="text-primary font-bold text-lg">
                  {(profile?.full_name || "U").charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 scrollbar-hide">
          {children}
        </div>
      </main>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="w-72 h-full bg-[#09090B] p-6 shadow-2xl animate-in slide-in-from-left duration-300 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Same sidebar content for mobile */}
            <div className="flex items-center justify-between mb-10 px-2 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl orange-gradient flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">SilverTrack</h1>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-8 scrollbar-hide">
              {sidebarGroups.map((group) => (
                <div key={group.title} className="space-y-3">
                  <h3 className="px-4 text-[11px] font-bold tracking-[0.1em] text-muted-foreground/60">
                    {group.title}
                  </h3>
                  <nav className="space-y-1">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href || (pathname.startsWith(item.href + '/') && item.href !== "/dashboard")
                      return <NavItem key={item.name} item={item} isActive={isActive} />
                    })}
                  </nav>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-6 shrink-0">
              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 px-4 py-2.5 w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all group"
              >
                <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform" />
                <span className="font-medium text-sm">Logout Session</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

