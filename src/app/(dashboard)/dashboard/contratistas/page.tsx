import { db } from "@/lib/db"
import {
  contractors,
  project_contractors,
  contractor_payments,
  projects,
} from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { count, sum, eq, and, gte, lte } from "drizzle-orm"
import Link from "next/link"
import { Plus, Phone, AlertCircle, HardHat, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"

export const revalidate = 0

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
})

function getQuinceRange(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDate()
  const year = now.getFullYear()
  const month = now.getMonth()

  if (day <= 15) {
    return {
      start: new Date(year, month, 1).toISOString().slice(0, 10),
      end: new Date(year, month, 15).toISOString().slice(0, 10),
    }
  }
  return {
    start: new Date(year, month, 16).toISOString().slice(0, 10),
    end: new Date(year, month + 1, 0).toISOString().slice(0, 10),
  }
}

export default async function ContratistasPage() {
  await requireAuth()

  const allContractors = await db
    .select({
      id: contractors.id,
      name: contractors.name,
      specialty: contractors.specialty,
      phone: contractors.phone,
      contractor_type: contractors.contractor_type,
    })
    .from(contractors)
    .orderBy(contractors.name)

  const enriched = await Promise.all(
    allContractors.map(async (c) => {
      const [projectStats] = await db
        .select({ count: count() })
        .from(project_contractors)
        .where(and(eq(project_contractors.contractor_id, c.id), eq(project_contractors.status, "active")))

      const [pendingStats] = await db
        .select({ total: sum(contractor_payments.amount) })
        .from(contractor_payments)
        .where(and(eq(contractor_payments.contractor_id, c.id), eq(contractor_payments.status, "pending")))

      return {
        ...c,
        active_projects: projectStats.count,
        pending_amount: parseFloat(pendingStats.total ?? "0"),
      }
    })
  )

  const quinceRange = getQuinceRange()

  const quincenal = await db
    .select({
      contractor_id: project_contractors.contractor_id,
      contractor_name: contractors.name,
      contractor_phone: contractors.phone,
      project_id: project_contractors.project_id,
      project_name: projects.name,
      contract_amount: project_contractors.contract_amount,
    })
    .from(project_contractors)
    .leftJoin(contractors, eq(project_contractors.contractor_id, contractors.id))
    .leftJoin(projects, eq(project_contractors.project_id, projects.id))
    .where(
      and(
        eq(project_contractors.payment_modality, "quincenal"),
        eq(project_contractors.status, "active")
      )
    )

  const paidThisFortnight = await db
    .select({ contractor_id: contractor_payments.contractor_id })
    .from(contractor_payments)
    .where(
      and(
        eq(contractor_payments.status, "paid"),
        gte(contractor_payments.payment_date, quinceRange.start),
        lte(contractor_payments.payment_date, quinceRange.end)
      )
    )
  const paidIds = new Set(paidThisFortnight.map((p) => p.contractor_id))
  const pendingQuincenales = quincenal.filter((q) => q.contractor_id && !paidIds.has(q.contractor_id))

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Contratistas</h1>
          <p className="text-sm text-muted-foreground">{enriched.length} registrados</p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/contratistas/nuevo">
            <Plus className="w-4 h-4 mr-1" /> Nuevo
          </Link>
        </Button>
      </div>

      {pendingQuincenales.length > 0 && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-emerald-700 shrink-0" />
            <p className="text-sm font-semibold text-emerald-800">
              Pagos pendientes esta quincena ({quinceRange.start.slice(8)} – {quinceRange.end.slice(8)})
            </p>
          </div>
          <ul className="space-y-2">
            {pendingQuincenales.map((q) => (
              <li key={`${q.contractor_id}-${q.project_id}`}>
                <Link
                  href={`/dashboard/contratistas/${q.contractor_id}/nuevo-pago`}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-emerald-200 hover:border-emerald-400 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{q.contractor_name}</p>
                    <p className="text-xs text-muted-foreground">{q.project_name}</p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Registrar pago
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        {enriched.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <HardHat className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Sin contratistas registrados.</p>
          </div>
        )}
        {enriched.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/contratistas/${c.id}`}
            className="flex items-center justify-between p-4 rounded-2xl border bg-card hover:bg-muted/30 transition-colors"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-semibold leading-none">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.specialty}</p>
              {c.phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />{c.phone}
                </p>
              )}
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-xs text-muted-foreground">{c.active_projects} proy. activos</p>
              {c.pending_amount > 0 && (
                <div className="flex items-center gap-1 text-emerald-700">
                  <CreditCard className="w-3 h-3" />
                  <p className="text-xs font-semibold">{COP.format(c.pending_amount)}</p>
                </div>
              )}
            </div>
          </Link>
        ))}
      </section>
    </main>
  )
}
