import { db } from "@/lib/db"
import { contractors, project_contractors, contractor_payments, projects } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq, and, desc, sum } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Phone,
  Mail,
  HardHat,
  Plus,
  Link2,
  CheckCircle2,
  Clock,
  Building2,
  CreditCard,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ContratistaActions } from "@/components/contratistas/ContratistaActions"

export const revalidate = 0

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
})

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" /> Pagado
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
      <Clock className="w-3 h-3" /> Pendiente
    </span>
  )
}

export default async function ContratistaDetailPage({ params }: { params: { id: string } }) {
  await requireAuth()

  const [contractor] = await db
    .select()
    .from(contractors)
    .where(eq(contractors.id, params.id))

  if (!contractor) notFound()

  const projectLinks = await db
    .select({
      pc_id: project_contractors.id,
      project_id: project_contractors.project_id,
      project_name: projects.name,
      contract_amount: project_contractors.contract_amount,
      payment_modality: project_contractors.payment_modality,
      status: project_contractors.status,
    })
    .from(project_contractors)
    .leftJoin(projects, eq(project_contractors.project_id, projects.id))
    .where(eq(project_contractors.contractor_id, params.id))

  const enrichedProjects = await Promise.all(
    projectLinks.map(async (pl) => {
      const [paidRow] = await db
        .select({ total: sum(contractor_payments.amount) })
        .from(contractor_payments)
        .where(
          and(
            eq(contractor_payments.contractor_id, params.id),
            eq(contractor_payments.project_id, pl.project_id!),
            eq(contractor_payments.status, "paid")
          )
        )
      const [pendingRow] = await db
        .select({ total: sum(contractor_payments.amount) })
        .from(contractor_payments)
        .where(
          and(
            eq(contractor_payments.contractor_id, params.id),
            eq(contractor_payments.project_id, pl.project_id!),
            eq(contractor_payments.status, "pending")
          )
        )
      const contracted = parseFloat(pl.contract_amount)
      const paid = parseFloat(paidRow.total ?? "0")
      const pending = parseFloat(pendingRow.total ?? "0")
      return { ...pl, contracted, paid, pending, balance: contracted - paid - pending }
    })
  )

  const recentPayments = await db
    .select({
      id: contractor_payments.id,
      amount: contractor_payments.amount,
      payment_date: contractor_payments.payment_date,
      payment_method: contractor_payments.payment_method,
      status: contractor_payments.status,
      notes: contractor_payments.notes,
      project_name: projects.name,
    })
    .from(contractor_payments)
    .leftJoin(projects, eq(contractor_payments.project_id, projects.id))
    .where(eq(contractor_payments.contractor_id, params.id))
    .orderBy(desc(contractor_payments.payment_date))
    .limit(20)

  const totalPaid = enrichedProjects.reduce((s, p) => s + p.paid, 0)
  const totalOwed = enrichedProjects.reduce((s, p) => s + p.balance, 0)
  const totalContracted = enrichedProjects.reduce((s, p) => s + p.contracted, 0)

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/dashboard/contratistas" className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <h1 className="text-lg font-bold truncate">{contractor.name}</h1>
            <p className="text-sm text-muted-foreground">{contractor.specialty}</p>
          </div>
          <ContratistaActions contractorId={contractor.id} isArchived={contractor.archived} />
        </div>
      </div>

      {contractor.archived && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Este contratista está archivado. Desarchivar para volver a asignar pagos o proyectos.
        </div>
      )}

      {/* Contact */}
      <section className="rounded-2xl border bg-card p-4 space-y-3">
        {contractor.phone && (
          <a
            href={`tel:${contractor.phone}`}
            className="flex items-center gap-3 p-3 rounded-xl border bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Phone className="w-5 h-5" />
            <div>
              <p className="text-xs opacity-80">Llamar</p>
              <p className="text-sm font-bold">{contractor.phone}</p>
            </div>
          </a>
        )}
        {contractor.email && (
          <a href={`mailto:${contractor.email}`} className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground">
            <Mail className="w-4 h-4" />
            {contractor.email}
          </a>
        )}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <HardHat className="w-4 h-4" />
          {contractor.contractor_type === "persona_natural" ? "Persona natural" : "Empresa"}
          {contractor.nit && <span className="text-xs">· {contractor.nit}</span>}
        </div>
        {contractor.bank_name && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <CreditCard className="w-4 h-4" />
            {contractor.bank_name}
            {contractor.bank_account && <span className="text-xs">· {contractor.bank_account}</span>}
          </div>
        )}
      </section>

      {/* Financial summary */}
      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-3 space-y-0.5">
          <p className="text-xs text-muted-foreground">Contratado</p>
          <p className="text-sm font-bold tabular-nums">{COP.format(totalContracted)}</p>
        </div>
        <div className="rounded-xl border bg-green-50 border-green-200 p-3 space-y-0.5">
          <p className="text-xs text-green-700">Pagado</p>
          <p className="text-sm font-bold tabular-nums text-green-700">{COP.format(totalPaid)}</p>
        </div>
        <div className={`rounded-xl border p-3 space-y-0.5 ${totalOwed > 0 ? "bg-emerald-50 border-emerald-200" : "bg-card"}`}>
          <p className={`text-xs ${totalOwed > 0 ? "text-emerald-700" : "text-muted-foreground"}`}>Por pagar</p>
          <p className={`text-sm font-bold tabular-nums ${totalOwed > 0 ? "text-emerald-700" : ""}`}>
            {COP.format(Math.max(0, totalOwed))}
          </p>
        </div>
      </section>

      {/* Actions */}
      {!contractor.archived && (
        <div className="flex gap-2">
          <Button asChild size="sm" className="flex-1">
            <Link href={`/dashboard/contratistas/${params.id}/nuevo-pago`}>
              <Plus className="w-4 h-4 mr-1" /> Registrar pago
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/contratistas/${params.id}/vincular`}>
              <Link2 className="w-4 h-4 mr-1" /> Vincular proyecto
            </Link>
          </Button>
        </div>
      )}

      {/* Projects */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Proyectos
        </h2>
        {enrichedProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin proyectos vinculados.</p>
        ) : (
          enrichedProjects.map((p) => (
            <div key={p.pc_id} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{p.project_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.payment_modality === "quincenal" ? "Pago quincenal" : "Por actividad"}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  p.status === "active" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                }`}>
                  {p.status === "active" ? "Activo" : p.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Contrato</p>
                  <p className="text-xs font-bold tabular-nums">{COP.format(p.contracted)}</p>
                </div>
                <div>
                  <p className="text-xs text-green-700">Pagado</p>
                  <p className="text-xs font-bold tabular-nums text-green-700">{COP.format(p.paid)}</p>
                </div>
                <div>
                  <p className={`text-xs ${p.balance > 0 ? "text-emerald-700" : "text-muted-foreground"}`}>Saldo</p>
                  <p className={`text-xs font-bold tabular-nums ${p.balance > 0 ? "text-emerald-700" : ""}`}>
                    {COP.format(Math.max(0, p.balance))}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      {/* Payment history */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Historial de pagos</h2>
        {recentPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
        ) : (
          <div className="rounded-2xl border divide-y overflow-hidden">
            {recentPayments.map((pay) => (
              <div key={pay.id} className="flex items-center justify-between p-3 bg-card">
                <div>
                  <p className="text-sm font-semibold tabular-nums">{COP.format(parseFloat(pay.amount))}</p>
                  <p className="text-xs text-muted-foreground">
                    {pay.project_name} · {pay.payment_date} · {pay.payment_method}
                  </p>
                  {pay.notes && <p className="text-xs text-muted-foreground italic">{pay.notes}</p>}
                </div>
                <div className="ml-3 shrink-0">
                  <StatusBadge status={pay.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
