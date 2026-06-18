import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { projects, clients, advances, invoice_allocations, work_cuts, project_extras } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/auth"
import { Header } from "@/components/layout/Header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { eq, sql, desc } from "drizzle-orm"
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
} from "lucide-react"
import { ProjectStatusSelect } from "@/components/proyectos/ProjectStatusSelect"
import { ExtrasSection } from "@/components/proyectos/ExtrasSection"

export const revalidate = 0

const STATUS_MAP = {
  active: { label: "Activo", className: "bg-green-100 text-green-700 border-green-200" },
  paused: { label: "En pausa", className: "bg-amber-100 text-amber-700 border-amber-200" },
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
      client_name: clients.name,
      client_nit: clients.nit,
    })
    .from(projects)
    .leftJoin(clients, eq(projects.client_id, clients.id))
    .where(eq(projects.id, params.id))

  if (!project) notFound()

  const [advancesResult, invoiceCostResult, cutsResult, extrasRows] = await Promise.all([
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
  ])

  const quoted = parseFloat(project.quoted_amount)
  const contingencyPct = parseFloat(project.contingency_percentage)
  const advancePct = parseFloat(project.advance_percentage)
  const totalAdvances = parseFloat(advancesResult[0]?.total ?? "0")
  const totalInvoiceCost = parseFloat(invoiceCostResult[0]?.total ?? "0")
  const contingencyAmount = (quoted * contingencyPct) / 100
  const pendingBalance = quoted - totalAdvances
  const availableMargin = quoted - contingencyAmount - totalInvoiceCost
  const margin = calculateProjectMargin(quoted, totalInvoiceCost)
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
              <ProjectStatusSelect projectId={project.id} currentStatus={project.status} />
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
            <Button asChild className="h-auto py-3 flex-col gap-1.5 col-span-2 bg-amber-500 hover:bg-amber-600 text-white">
              <Link href={`/dashboard/proyectos/${project.id}/cortes/nuevo`}>
                <Plus className="w-4 h-4" />
                <span className="text-xs font-semibold">Registrar corte de obra</span>
              </Link>
            </Button>
          </div>
        </div>

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
    amber: "bg-amber-50 text-amber-600",
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
