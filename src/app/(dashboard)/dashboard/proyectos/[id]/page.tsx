import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { projects, clients, advances, invoice_allocations, work_cuts, project_extras, budget_items, project_rubros, contractor_payments } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/auth"
import { Header } from "@/components/layout/Header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { eq, sql, desc, and } from "drizzle-orm"
import { formatCOP } from "@/lib/utils"
import { calculateProjectMargin } from "@/lib/calculations"
import {
  Receipt,
  Scissors,
  Plus,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  BarChart3,
  FileText,
  Pencil,
} from "lucide-react"
import { ProjectStatusSelect } from "@/components/proyectos/ProjectStatusSelect"
import { ExtrasSection } from "@/components/proyectos/ExtrasSection"
import { BudgetSection } from "@/components/proyectos/BudgetSection"
import { RubrosSection } from "@/components/proyectos/RubrosSection"
import { ArchiveProjectButton } from "@/components/proyectos/ArchiveProjectButton"
import { DeleteProjectButton } from "@/components/proyectos/DeleteProjectButton"

export const revalidate = 0

const STATUS_MAP = {
  active: { label: "Activo", className: "bg-green-100 text-green-700 border-green-200" },
  paused: { label: "En pausa", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  completed: { label: "Terminado", className: "bg-blue-100 text-blue-700 border-blue-200" },
  in_warranty: { label: "En garantía", className: "bg-purple-100 text-purple-700 border-purple-200" },
  cancelled: { label: "Cancelado", className: "bg-red-100 text-red-700 border-red-200" },
} as const

interface PageProps {
  params: { id: string }
}

export default async function ProyectoDetailPage({ params }: PageProps) {
  const user = await getCurrentUser()
  const isAdmin = user?.role === "admin"

  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      status: projects.status,
      start_date: projects.start_date,
      estimated_end_date: projects.estimated_end_date,
      actual_end_date: projects.actual_end_date,
      quoted_amount: projects.quoted_amount,
      advance_percentage: projects.advance_percentage,
      contingency_percentage: projects.contingency_percentage,
      created_at: projects.created_at,
      archived: projects.archived,
      client_name: clients.name,
      client_nit: clients.nit,
    })
    .from(projects)
    .leftJoin(clients, eq(projects.client_id, clients.id))
    .where(eq(projects.id, params.id))

  if (!project) notFound()

  const [advancesResult, invoiceCostResult, cutsResult, extrasRows, budgetRows, rubrosRows, contractorCostResult] = await Promise.all([
    db
      .select({ total: sql<string>`coalesce(sum(amount)::numeric, 0)` })
      .from(advances)
      .where(eq(advances.project_id, params.id)),

    db
      .select({ total: sql<string>`coalesce(sum(amount)::numeric, 0)` })
      .from(invoice_allocations)
      .where(eq(invoice_allocations.project_id, params.id)),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(work_cuts)
      .where(eq(work_cuts.project_id, params.id)),

    db
      .select({
        id: project_extras.id,
        description: project_extras.description,
        value: project_extras.value,
        reason: project_extras.reason,
        status: project_extras.status,
        approved_at: project_extras.approved_at,
        work_cut_id: project_extras.work_cut_id,
        created_at: project_extras.created_at,
      })
      .from(project_extras)
      .where(eq(project_extras.project_id, params.id))
      .orderBy(desc(project_extras.created_at)),

    db
      .select()
      .from(budget_items)
      .where(eq(budget_items.project_id, params.id))
      .orderBy(budget_items.category, budget_items.name),

    db
      .select({
        id:            project_rubros.id,
        rubro_type:    project_rubros.rubro_type,
        name:          project_rubros.name,
        budget_amount: project_rubros.budget_amount,
        sort_order:    project_rubros.sort_order,
        spent: sql<string>`coalesce(sum(${invoice_allocations.amount})::numeric, '0')`,
      })
      .from(project_rubros)
      .leftJoin(
        invoice_allocations,
        eq(invoice_allocations.project_rubro_id, project_rubros.id)
      )
      .where(
        and(
          eq(project_rubros.project_id, params.id),
          eq(project_rubros.active, true)
        )
      )
      .groupBy(
        project_rubros.id,
        project_rubros.rubro_type,
        project_rubros.name,
        project_rubros.budget_amount,
        project_rubros.sort_order
      )
      .orderBy(project_rubros.sort_order),

    db
      .select({ total: sql<string>`coalesce(sum(${contractor_payments.amount})::numeric, '0')` })
      .from(contractor_payments)
      .where(eq(contractor_payments.project_id, params.id)),
  ])

  const quoted = parseFloat(project.quoted_amount)
  const contingencyPct = parseFloat(project.contingency_percentage)
  const advancePct = parseFloat(project.advance_percentage)
  const totalAdvances = parseFloat(advancesResult[0]?.total ?? "0")
  const totalInvoiceCost = parseFloat(invoiceCostResult[0]?.total ?? "0")
  const totalContractorCost = parseFloat(contractorCostResult[0]?.total ?? "0")
  const totalRealEgresos = totalInvoiceCost + totalContractorCost
  const contingencyAmount = (quoted * contingencyPct) / 100
  const pendingBalance = quoted - totalAdvances
  const availableMargin = quoted - contingencyAmount - totalInvoiceCost
  const margin = calculateProjectMargin(quoted, totalInvoiceCost)
  const realMargin = calculateProjectMargin(quoted, totalRealEgresos)
  const rentaSemaphore: "green" | "amber" | "red" =
    realMargin.percentage > 15 ? "green" : realMargin.percentage >= 0 ? "amber" : "red"
  const cutCount = cutsResult[0]?.count ?? 0
  const initialExtras = extrasRows.map((e) => ({
    ...e,
    status: e.status as "pending" | "approved",
    approved_at: e.approved_at ? e.approved_at.toISOString() : null,
    work_cut_id: e.work_cut_id ?? null,
    created_at: e.created_at.toISOString(),
  }))

  const statusInfo = STATUS_MAP[project.status as keyof typeof STATUS_MAP] ?? STATUS_MAP.active

  return (
    <div>
      <Header title={project.name} subtitle={project.client_name ?? "Sin cliente"} />

      <div className="px-4 md:px-6 py-6 space-y-5 max-w-2xl">
        {/* Header card */}
        <div className="section-card">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">{project.client_name ?? "—"}</p>
              <h2 className="text-base font-semibold text-foreground">{project.name}</h2>
              {project.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {project.description}
                </p>
              )}
            </div>
            {isAdmin ? (
              <div className="flex items-center gap-2 shrink-0">
                <ProjectStatusSelect projectId={project.id} currentStatus={project.status} />
                <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <Link href={`/dashboard/proyectos/${project.id}/editar`} title="Editar proyecto">
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>
                </Button>
                <ArchiveProjectButton projectId={project.id} archived={project.archived} />
                {project.archived && (
                  <DeleteProjectButton projectId={project.id} />
                )}
              </div>
            ) : (
              <Badge variant="outline" className={`shrink-0 ${statusInfo.className}`}>
                {statusInfo.label}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground border-t pt-3">
            <span>Inicio {formatDate(project.start_date)}</span>
            {project.estimated_end_date && (
              <span>Entrega est. {formatDate(project.estimated_end_date)}</span>
            )}
            <span>Anticipo pactado {advancePct}%</span>
            <span>Imprevistos {contingencyPct}%</span>
          </div>
        </div>

        {/* Financial summary */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Resumen financiero
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <FinCard
              icon={<FileText className="w-4 h-4" />}
              label="Valor cotizado"
              value={formatCOP(quoted)}
              color="blue"
            />
            <FinCard
              icon={<Wallet className="w-4 h-4" />}
              label="Anticipo recibido"
              value={formatCOP(totalAdvances)}
              sub={totalAdvances === 0 ? "Sin anticipos" : `${((totalAdvances / quoted) * 100).toFixed(1)}% del total`}
              color="green"
            />
            <FinCard
              icon={<CreditCard className="w-4 h-4" />}
              label="Saldo pendiente cliente"
              value={formatCOP(pendingBalance)}
              sub={pendingBalance < 0 ? "Anticipo supera cotizado" : undefined}
              color={pendingBalance > 0 ? "amber" : "neutral"}
            />
            <FinCard
              icon={<Receipt className="w-4 h-4" />}
              label="Costo en facturas"
              value={formatCOP(totalInvoiceCost)}
              sub={`${totalInvoiceCost > 0 ? ((totalInvoiceCost / quoted) * 100).toFixed(1) + "% del cotizado" : "Sin facturas asignadas"}`}
              color="neutral"
            />
            <FinCard
              icon={<BarChart3 className="w-4 h-4" />}
              label="Margen disponible"
              value={formatCOP(availableMargin)}
              sub={`Imprevistos: ${formatCOP(contingencyAmount)}`}
              color={availableMargin >= 0 ? "green" : "red"}
            />
            <FinCard
              icon={margin.percentage >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              label="Rentabilidad proyectada"
              value={`${margin.percentage.toFixed(1)}%`}
              sub={formatCOP(margin.amount)}
              color={margin.percentage >= 15 ? "green" : margin.percentage >= 0 ? "amber" : "red"}
            />
          </div>
        </div>

        {/* Rentabilidad real */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Rentabilidad
          </h3>
          <div className="section-card">
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-xs text-muted-foreground">Valor del contrato</span>
                <span className="text-sm font-medium tabular-nums">{formatCOP(quoted)}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-xs text-muted-foreground">Anticipos recibidos</span>
                <span className={`text-sm tabular-nums ${totalAdvances === 0 ? "text-muted-foreground" : "font-medium"}`}>
                  {totalAdvances === 0 ? "Sin anticipos" : formatCOP(totalAdvances)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-xs text-muted-foreground">Facturas pagadas</span>
                <span className="text-sm tabular-nums text-red-600">
                  {totalInvoiceCost > 0 ? `−${formatCOP(totalInvoiceCost)}` : formatCOP(0)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-xs text-muted-foreground">Pagos a contratistas</span>
                <span className="text-sm tabular-nums text-red-600">
                  {totalContractorCost > 0 ? `−${formatCOP(totalContractorCost)}` : formatCOP(0)}
                </span>
              </div>
            </div>

            {/* Result block — separate rounded card inside */}
            <div className={`mt-3 rounded-xl border p-4 flex items-center justify-between ${
              rentaSemaphore === "green"
                ? "bg-green-50 border-green-200"
                : rentaSemaphore === "amber"
                ? "bg-amber-50 border-amber-200"
                : "bg-red-50 border-red-200"
            }`}>
              <div>
                <p className={`text-[11px] font-semibold uppercase tracking-wide ${
                  rentaSemaphore === "green" ? "text-green-700"
                  : rentaSemaphore === "amber" ? "text-amber-700"
                  : "text-red-700"
                }`}>
                  {rentaSemaphore === "green" ? "Saludable" : rentaSemaphore === "amber" ? "En riesgo" : "En pérdida"}
                </p>
                <p className={`text-base font-bold tabular-nums mt-0.5 ${
                  rentaSemaphore === "green" ? "text-green-800"
                  : rentaSemaphore === "amber" ? "text-amber-800"
                  : "text-red-800"
                }`}>
                  {formatCOP(realMargin.amount)}
                </p>
                <p className={`text-[10px] mt-0.5 ${
                  rentaSemaphore === "green" ? "text-green-600"
                  : rentaSemaphore === "amber" ? "text-amber-600"
                  : "text-red-600"
                }`}>
                  Utilidad proyectada
                </p>
              </div>
              <p className={`text-3xl font-bold tabular-nums ${
                rentaSemaphore === "green" ? "text-green-700"
                : rentaSemaphore === "amber" ? "text-amber-700"
                : "text-red-700"
              }`}>
                {realMargin.percentage.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Acciones
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Button asChild variant="outline" className="h-auto py-3 flex-col gap-1.5">
              <Link href={`/dashboard/facturas?proyecto=${project.id}`}>
                <Receipt className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs">Ver facturas</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-3 flex-col gap-1.5">
              <Link href={`/dashboard/cortes?proyecto=${project.id}`}>
                <Scissors className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs">
                  {cutCount > 0 ? `${cutCount} corte${cutCount > 1 ? "s" : ""}` : "Cortes de obra"}
                </span>
              </Link>
            </Button>
            <Button asChild className="h-auto py-3 flex-col gap-1.5 col-span-2 bg-emerald-500 hover:bg-emerald-700 text-white">
              <Link href={`/dashboard/proyectos/${project.id}/cortes/nuevo`}>
                <Plus className="w-4 h-4" />
                <span className="text-xs font-semibold">Registrar corte de obra</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Presupuesto por rubros */}
        {rubrosRows.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Presupuesto por rubros
            </h3>
            <RubrosSection rubros={rubrosRows} />
          </div>
        )}

        {/* Presupuesto de actividades */}
        <BudgetSection
          projectId={project.id}
          isAdmin={isAdmin}
          initialItems={budgetRows.map((b) => ({
            id: b.id,
            name: b.name,
            category: b.category,
            unit: b.unit,
            quantity: b.quantity,
            unit_price: b.unit_price,
            total_price: b.total_price,
          }))}
        />

        {/* Extras de obra */}
        <ExtrasSection projectId={project.id} isAdmin={isAdmin} initialExtras={initialExtras} />

        {/* Back link — mobile */}
        <Link
          href="/dashboard/proyectos"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors md:hidden"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Todos los proyectos
        </Link>
      </div>
    </div>
  )
}

function FinCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color: "blue" | "green" | "amber" | "red" | "neutral"
}) {
  const iconColors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-600",
    neutral: "bg-muted text-muted-foreground",
  }
  return (
    <div className="section-card p-4">
      <div className={`inline-flex items-center justify-center w-7 h-7 rounded-md mb-2 ${iconColors[color]}`}>
        {icon}
      </div>
      <p className="text-sm font-bold amount text-foreground leading-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
    </div>
  )
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-")
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
  return `${day} ${months[parseInt(month) - 1]} ${year}`
}
