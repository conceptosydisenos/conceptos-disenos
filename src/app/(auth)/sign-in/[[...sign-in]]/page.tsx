import { SignIn } from "@clerk/nextjs"
import Image from "next/image"

export const dynamic = "force-dynamic"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — white, logo + copy (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-white flex-col p-12">
        {/* Upper half: logo centered */}
        <div className="flex-1 flex items-center justify-center">
          <Image
            src="/logo.jpg"
            alt="Conceptos y Diseños"
            width={280}
            height={112}
            className="object-contain"
            priority
          />
        </div>

        {/* Lower half: copy + footer */}
        <div className="flex-1 flex flex-col justify-between">
          <div className="space-y-6">
            <blockquote className="space-y-3">
              <p className="text-2xl font-semibold font-sans text-[#1e2d4e] leading-snug">
                &ldquo;El control financiero de cada obra, en la palma de tu mano.&rdquo;
              </p>
              <footer className="text-sm font-sans text-gray-500">
                Sistema Integral de Gestión de Obras
              </footer>
            </blockquote>

            <ul className="space-y-2">
              {[
                "Captura facturas con el celular en segundos",
                "Dashboard de rentabilidad en tiempo real",
                "Cortes de obra y anticipos sin papel",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-gray-600 text-sm font-sans">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-gray-400 text-xs font-sans">
            © {new Date().getFullYear()} Conceptos y Diseños · Medellín, Colombia
          </p>
        </div>
      </div>

      {/* Right panel — white on mobile, navy on desktop */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 bg-white lg:bg-[#1e2d4e]">
        {/* Mobile logo — centered above form */}
        <div className="mb-8 lg:hidden">
          <Image
            src="/logo.jpg"
            alt="Conceptos y Diseños"
            width={160}
            height={64}
            className="object-contain"
            priority
          />
        </div>

        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full max-w-sm",
              card: "shadow-xl rounded-2xl border-0",
              headerTitle: "text-xl font-bold",
              headerSubtitle: "text-muted-foreground text-sm",
            },
          }}
        />
      </div>
    </div>
  )
}
