"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDecimal } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from "recharts"
import { ArrowUpRight, TrendingUp, Shield, Activity, Scale, ArrowDownCircle, ArrowUpCircle, PieChart as PieChartIcon } from "lucide-react"

const METAL_COLORS: Record<string, string> = {
  'Chorsa': '#FF6B00', // Primary Orange
  'Patla': '#00C2FF',  // Sky Blue
  'Peti': '#9D50BB',   // Purple
  'Copper': '#B87333', // Distinct Copper
  'Others': '#FFB000', // Amber
};

const FALLBACK_COLORS = [
  '#FF6B00', '#00C2FF', '#9D50BB', '#FFB000', 
  '#00FF94', '#FF4B2B', '#6A11CB', '#F09819'
];

const getMetalColor = (name: string, index: number) => {
  if (METAL_COLORS[name]) return METAL_COLORS[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[colorIndex];
};

export default function DashboardPage() {
  const [stats, setStats] = useState({
    remainingWeight: 0,
    remainingFine: 0,
    totalInWeight: 0,
    totalInFine: 0,
    totalUsedWeight: 0,
    totalUsedFine: 0,
  })
  const [pieData, setPieData] = useState<any[]>([])
  const [barData, setBarData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: metals, error: metalsError } = await supabase
          .from("metal_items")
          .select("weight, fine, is_used, metal_type, custom_type, batches(date_time)")
          .eq("user_id", user.id)
        
        if (metalsError) throw metalsError

        let remainingWeight = 0
        let remainingFine = 0
        const typeTotals: Record<string, number> = {}
        metals?.forEach(item => {
          const fine = Number(item.fine)
          if (!item.is_used) {
            remainingWeight += Number(item.weight)
            remainingFine += fine
            const type = item.metal_type === "Others" ? (item.custom_type || "Others") : item.metal_type
            typeTotals[type] = (typeTotals[type] || 0) + fine
          }
        })

        const { data: outStock, error: outError } = await supabase
          .from("out_stock")
          .select("weight, fine, used_date")

        let inWeight = 0
        let inFine = 0
        let usedWeight = 0
        let usedFine = 0

        const typeMap: Record<string, number> = {}
        const dateMap: Record<string, { in: number, out: number }> = {}

        // Last 7 days initialization
        for (let i = 6; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          dateMap[dateStr] = { in: 0, out: 0 }
        }

        metals?.forEach((item) => {
          const w = Number(item.weight)
          const f = Number(item.fine)
          
          if (!item.is_used) {
            remainingWeight += w
            // Only count remaining for pie chart
            const typeName = item.metal_type === "Others" && item.custom_type ? item.custom_type : item.metal_type
            typeMap[typeName] = (typeMap[typeName] || 0) + f
          }

          // Date mapping for IN (uses actual inserted time for accurate graphing)
          const batchInfo: any = item.batches;
          const dateTime = Array.isArray(batchInfo) ? batchInfo[0]?.date_time : batchInfo?.date_time;
          if (dateTime) {
            const dateStr = new Date(dateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            if (dateMap[dateStr]) {
              dateMap[dateStr].in += f
            }
          }
        })

        // Date mapping for OUT
        outStock?.forEach((item) => {
          if (item.used_date) {
            const dateStr = new Date(item.used_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            if (dateMap[dateStr]) {
              dateMap[dateStr].out += Number(item.fine)
            }
          }
        })

        // Robust totals calculation
        const safeTotalInWeight = remainingWeight + usedWeight;
        const safeTotalInFine = remainingFine + usedFine;

        setStats({
          totalInWeight: safeTotalInWeight,
          totalInFine: safeTotalInFine,
          totalUsedWeight: usedWeight,
          totalUsedFine: usedFine,
          remainingWeight: remainingWeight,
          remainingFine: remainingFine,
        })

        const formattedPieData = Object.keys(typeMap).map(key => ({
          name: key,
          value: parseFloat(typeMap[key].toFixed(2))
        }))
        setPieData(formattedPieData)

        const formattedBarData = Object.keys(dateMap).map(key => ({
          name: key,
          In: parseFloat(dateMap[key].in.toFixed(2)),
          Out: parseFloat(dateMap[key].out.toFixed(2))
        }))
        setBarData(formattedBarData)

      } catch (error) {
        console.error("Error fetching stats", error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3 rounded-lg border border-border">
          <p className="font-semibold text-sm mb-1">{label || payload[0].name}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} className="text-xs" style={{ color: p.color || p.fill }}>
              {p.name}: {p.value} g (Fine)
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your silver inventory</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-full lg:col-span-1 bg-gradient-to-br from-primary/20 to-transparent border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary">Current Balance</CardTitle>
            <Scale className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary text-glow">{formatDecimal(stats.remainingWeight)} g</div>
            <p className="text-xs text-primary/80 mt-1">
              Fine: {formatDecimal(stats.remainingFine)} g
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total In-Stock</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDecimal(stats.totalInWeight)} g</div>
            <p className="text-xs text-muted-foreground mt-1">
              Fine: {formatDecimal(stats.totalInFine)} g
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Out-Stock</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDecimal(stats.totalUsedWeight)} g</div>
            <p className="text-xs text-muted-foreground mt-1">
              Fine: {formatDecimal(stats.totalUsedFine)} g
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <PieChartIcon className="mr-2 h-4 w-4 text-primary" />
              Remaining Inventory by Type (Fine)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] w-full flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getMetalColor(entry.name, index)} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#9CA3AF' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No active inventory.</p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Activity className="mr-2 h-4 w-4 text-primary" />
              Recent Activity (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="In" fill="#00FFB2" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Out" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
