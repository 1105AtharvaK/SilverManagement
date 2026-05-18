import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ partyId: string }> }
) {
  const { partyId } = await params
  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get("start")
  const endDate = searchParams.get("end")

  // Get the JWT token from Authorization header (sent by the client)
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.replace("Bearer ", "") || ""

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  )

  // Fetch party name
  const { data: party, error: partyError } = await supabase
    .from("parties")
    .select("name")
    .eq("id", partyId)
    .single()

  if (partyError) {
    return new NextResponse(`Party fetch error: ${partyError.message}`, { status: 500 })
  }

  // Fetch all metal items with batch info
  const { data: metals, error } = await supabase
    .from("metal_items")
    .select("*, batches(batch_title, date_time, received_from)")
    .eq("party_id", partyId)
    .order("created_at", { ascending: true })

  if (error) {
    return new NextResponse(`Data fetch error: ${error.message}`, { status: 500 })
  }

  let items = metals || []

  // Apply date filter if provided
  if (startDate && endDate) {
    const start = new Date(startDate).getTime()
    const end = new Date(endDate).getTime() + 86400000
    items = items.filter((item) => {
      if (!item.batches?.date_time) return false
      const d = new Date(item.batches.date_time).getTime()
      return d >= start && d <= end
    })
  }

  // Build CSV
  const header = ["Date", "Metal Type", "Provided By", "Weight (g)", "Purity (%)", "Fine (g)", "Status"]

  const rows = items.map((item) => {
    let dateStr = "N/A"
    if (item.batches?.date_time) {
      const d = new Date(item.batches.date_time)
      dateStr = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
        .toString()
        .padStart(2, "0")}/${d.getFullYear()}`
    }
    return [
      dateStr,
      item.metal_type === "Others" ? item.custom_type || "Others" : item.metal_type,
      item.batches?.received_from || party?.name || "N/A",
      item.weight,
      item.purity,
      item.fine,
      item.is_used ? "Used" : "In-Stock",
    ]
  })

  const allRows = [header, ...rows]
  const BOM = "\uFEFF"
  const csvBody = allRows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n")
  const csvContent = BOM + csvBody

  const safePartyName = (party?.name || "Party").replace(/[^a-z0-9]/gi, "_")
  const fileName = `${safePartyName}_Inventory.csv`

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  })
}
