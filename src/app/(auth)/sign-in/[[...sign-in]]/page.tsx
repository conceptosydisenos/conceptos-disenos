"use client"

import Image from "next/image"
import { useState } from "react"
import { useSignIn, SignIn } from "@clerk/nextjs"

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

function GoogleSignInButton() {
  const { signIn, isLoaded } = useSignIn()
  const [loading, setLoading] = useState(false)

  const handleGoogle = async () => {
    if (!signIn || !isLoaded) return
    setLoading(true)
    await signIn.authenticateWithRedirect({
      strategy: "oauth_google",
      redirectUrl: "/sign-in/sso-callback",
      redirectUrlComplete: "/dashboard",
    })
  }

  return (
    <button
      onClick={handleGoogle}
      disabled={!isLoaded || loading}
      className="flex items-center justify-center gap-3 w-full h-12 px-6 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors text-gray-700 font-medium text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
      ) : (
        <GoogleIcon />
      )}
      Continuar con Google
    </button>
  )
}

// ─── Architectural SVG background ─────────────────────────────────────────────
// Inline SVG — zero external dependencies.
// Left tower: tall glass curtain wall tower (x 0–210)
// Right building: contemporary office block (x 1225–1440)
// Center (x 210–1225) stays clear for the login card.
// On narrow viewports (<1200px) xMidYMid slice naturally clips the side
// buildings, so they recede without code — mobile is clean by default.
// ──────────────────────────────────────────────────────────────────────────────
function ArchitecturalBackground() {
  const C_OUTLINE = "#D8D8D8"
  const C_INNER   = "#E2E2E2"
  const C_FLOOR   = "#E4E4E4"
  const C_WINDOW  = "#EBEBEB"

  // Left tower metrics
  const LT_FLOOR_H = 34     // px per floor
  const LT_FLOORS  = 25     // total floor lines
  const LT_WIN_X   = [34, 92, 150]   // 3 window columns, each 42 px wide
  const LT_MECH    = 5      // row index to skip (mechanical floor)

  // Right building metrics
  const RB_FLOOR_H = 36
  const RB_FLOORS  = 17
  const RB_WIN_X   = [1240, 1290, 1340, 1390]   // 4 columns, 36 px wide

  return (
    <svg
      className="fixed inset-0 w-full h-full pointer-events-none select-none"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Page base */}
      <rect width="1440" height="900" fill="#FAFAFA" />

      {/* ═══════════════════════════════════════════════
          LEFT — tall modern glass tower
          Shaft: x 20–206 | full height
      ═══════════════════════════════════════════════ */}
      <g opacity="0.50" fill="none">

        {/* Spire / antenna */}
        <line x1="113" y1="0"  x2="113" y2="22"
              stroke={C_OUTLINE} strokeWidth="0.75" />

        {/* Penthouse crown */}
        <rect x="52" y="20" width="122" height="40"
              stroke={C_OUTLINE} strokeWidth="1" />
        {/* Crown bisect line */}
        <line x1="52" y1="40" x2="174" y2="40"
              stroke={C_INNER} strokeWidth="0.5" />

        {/* Main shaft outline */}
        <rect x="20" y="60" width="186" height="850"
              stroke={C_OUTLINE} strokeWidth="1" />

        {/* Curtain wall — vertical column divisions */}
        <line x1="82" y1="60" x2="82" y2="910"
              stroke={C_INNER} strokeWidth="0.5" />
        <line x1="144" y1="60" x2="144" y2="910"
              stroke={C_INNER} strokeWidth="0.5" />

        {/* Horizontal floor plates */}
        {Array.from({ length: LT_FLOORS }, (_, i) => (
          <line
            key={`lt-fl-${i}`}
            x1="20"  y1={94 + i * LT_FLOOR_H}
            x2="206" y2={94 + i * LT_FLOOR_H}
            stroke={C_FLOOR} strokeWidth="0.5"
          />
        ))}

        {/* Mechanical floor accent — thicker line, no windows */}
        <line
          x1="20"  y1={94 + (LT_MECH - 1) * LT_FLOOR_H + LT_FLOOR_H / 2}
          x2="206" y2={94 + (LT_MECH - 1) * LT_FLOOR_H + LT_FLOOR_H / 2}
          stroke={C_INNER} strokeWidth="1.5"
        />

        {/* Window grid — 3 cols × 24 rows (mechanical floor skipped) */}
        {Array.from({ length: LT_FLOORS - 1 }, (_, row) => {
          if (row === LT_MECH) return null
          return LT_WIN_X.map((wx) => (
            <rect
              key={`lt-w-${row}-${wx}`}
              x={wx} y={64 + row * LT_FLOOR_H}
              width="42" height="21"
              stroke={C_WINDOW} strokeWidth="0.5"
            />
          ))
        })}

        {/* Lobby base — double-height windows at bottom 2 rows */}
        {LT_WIN_X.map((wx) => (
          <rect
            key={`lt-lobby-${wx}`}
            x={wx}
            y={64 + (LT_FLOORS - 2) * LT_FLOOR_H}
            width="42"
            height={LT_FLOOR_H * 2 - 3}
            stroke={C_INNER} strokeWidth="0.5"
          />
        ))}
      </g>

      {/* ═══════════════════════════════════════════════
          RIGHT — contemporary 15-storey office block
          Wing: x 1385–1440 | starts y 170
          Main: x 1225–1440 | starts y 290
      ═══════════════════════════════════════════════ */}
      <g opacity="0.44" fill="none">

        {/* Side wing / annex (taller portion on far right) */}
        <rect x="1385" y="170" width="55" height="122"
              stroke={C_OUTLINE} strokeWidth="1" />
        <line x1="1385" y1="206" x2="1440" y2="206"
              stroke={C_FLOOR} strokeWidth="0.5" />
        <line x1="1385" y1="242" x2="1440" y2="242"
              stroke={C_FLOOR} strokeWidth="0.5" />
        <rect x="1394" y="178" width="38" height="22"
              stroke={C_WINDOW} strokeWidth="0.5" />
        <rect x="1394" y="214" width="38" height="22"
              stroke={C_WINDOW} strokeWidth="0.5" />

        {/* Main building outline */}
        <rect x="1225" y="290" width="215" height="620"
              stroke={C_OUTLINE} strokeWidth="1" />

        {/* Facade — vertical column divisions */}
        <line x1="1280" y1="290" x2="1280" y2="910"
              stroke={C_INNER} strokeWidth="0.5" />
        <line x1="1332" y1="290" x2="1332" y2="910"
              stroke={C_INNER} strokeWidth="0.5" />
        <line x1="1384" y1="290" x2="1384" y2="910"
              stroke={C_INNER} strokeWidth="0.5" />

        {/* Horizontal floor plates */}
        {Array.from({ length: RB_FLOORS }, (_, i) => (
          <line
            key={`rb-fl-${i}`}
            x1="1225" y1={326 + i * RB_FLOOR_H}
            x2="1440" y2={326 + i * RB_FLOOR_H}
            stroke={C_FLOOR} strokeWidth="0.5"
          />
        ))}

        {/* Window grid — 4 cols × 16 rows */}
        {Array.from({ length: RB_FLOORS - 1 }, (_, row) =>
          RB_WIN_X.map((wx) => (
            <rect
              key={`rb-w-${row}-${wx}`}
              x={wx} y={294 + row * RB_FLOOR_H}
              width="34" height="22"
              stroke={C_WINDOW} strokeWidth="0.5"
            />
          ))
        )}

        {/* Curtain wall spandrel top detail */}
        <line x1="1225" y1="308" x2="1440" y2="308"
              stroke={C_INNER} strokeWidth="0.75" />
      </g>

      {/* ═══════════════════════════════════════════════
          Ground perspective — converging lines
          suggest a ground plane between the buildings
      ═══════════════════════════════════════════════ */}
      <g opacity="0.22" stroke={C_FLOOR} fill="none" strokeWidth="0.5">
        {/* From left tower base toward center */}
        <line x1="206" y1="910" x2="520" y2="875" />
        <line x1="206" y1="910" x2="680" y2="855" />
        {/* From right building base toward center */}
        <line x1="1225" y1="910" x2="920" y2="875" />
        <line x1="1225" y1="910" x2="760" y2="855" />
      </g>
    </svg>
  )
}

export default function SignInPage() {
  return (
    <div className="relative min-h-screen">
      {/* Architectural background — z-0, covers entire screen */}
      <ArchitecturalBackground />

      {/* Content — z-10, perfectly legible above SVG */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center gap-0 px-6">
        {/* Hidden SignIn — handles OAuth callback on /sign-in/sso-callback */}
        <div className="hidden" aria-hidden="true">
          <SignIn />
        </div>

        {/* Card */}
        <div className="flex flex-col items-center w-full">
          <div className="mb-2 w-[90vw] sm:w-[520px]">
            <Image
              src="/logo.jpg"
              alt="Conceptos y Diseños"
              width={520}
              height={260}
              className="object-contain w-full h-auto"
              priority
            />
          </div>

          <div className="mt-16 text-center">
            <h1 className="text-2xl font-semibold text-gray-900">Bienvenido</h1>
            <p className="mt-1 text-sm text-gray-400">Sistema Integral de Gestión de Obras</p>
          </div>

          <div className="mt-10 w-[90vw] sm:w-full max-w-[400px]">
            <GoogleSignInButton />
          </div>
        </div>

        <footer className="fixed bottom-8 w-full text-center">
          <p className="text-xs text-gray-400">
            © 2026 Conceptos y Diseños · Medellín, Colombia
          </p>
        </footer>
      </div>
    </div>
  )
}
