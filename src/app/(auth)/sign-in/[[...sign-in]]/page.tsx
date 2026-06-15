import { SignIn } from "@clerk/nextjs"
import { Building2 } from "lucide-react"

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 sidebar-bg flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-accent-foreground" />
          </div>
          <span className="text-white font-bold text-lg leading-tight">
            Conceptos y Diseños
          </span>
        </div>

        <div className="space-y-6">
          <blockquote className="space-y-3">
            <p className="text-2xl font-semibold text-white leading-snug">
              &ldquo;El control financiero de cada obra, en la palma de tu mano.&rdquo;
            </p>
            <footer className="text-sm text-white/60">
              Sistema Integral de Gestión de Obras
            </footer>
          </blockquote>

          <ul className="space-y-2">
            {[
              "Captura facturas con el celular en segundos",
              "Dashboard de rentabilidad en tiempo real",
              "Cortes de obra y anticipos sin papel",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-white/80 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-white/30 text-xs">
          © {new Date().getFullYear()} Conceptos y Diseños · Bogotá, Colombia
        </p>
      </div>

      {/* Right panel — sign in form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-8 lg:hidden">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground">Conceptos y Diseños</span>
        </div>

        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full max-w-sm",
              card: "shadow-none border-0 p-0",
              headerTitle: "text-xl font-bold",
              headerSubtitle: "text-muted-foreground text-sm",
            },
          }}
        />
      </div>
    </div>
  )
}
