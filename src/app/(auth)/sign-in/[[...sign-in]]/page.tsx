import { SignIn } from "@clerk/nextjs"
import Image from "next/image"

export const dynamic = "force-dynamic"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — white, logo + copy */}
      <div className="hidden lg:flex lg:w-1/2 bg-white flex-col justify-between p-12">
        <Image
          src="/logo.jpg"
          alt="Conceptos y Diseños"
          width={200}
          height={80}
          className="object-contain object-left"
          priority
        />

        <div className="space-y-6">
          <blockquote className="space-y-3">
            <p className="text-2xl font-semibold text-[#1e2d4e] leading-snug">
              &ldquo;El control financiero de cada obra, en la palma de tu mano.&rdquo;
            </p>
            <footer className="text-sm text-gray-500">
              Sistema Integral de Gestión de Obras
            </footer>
          </blockquote>

          <ul className="space-y-2">
            {[
              "Captura facturas con el celular en segundos",
              "Dashboard de rentabilidad en tiempo real",
              "Cortes de obra y anticipos sin papel",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-gray-600 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-gray-400 text-xs">
          © {new Date().getFullYear()} Conceptos y Diseños · Bogotá, Colombia
        </p>
      </div>

      {/* Right panel — navy, Clerk form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 bg-[#1e2d4e]">
        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          <Image
            src="/logo.jpg"
            alt="Conceptos y Diseños"
            width={140}
            height={56}
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
