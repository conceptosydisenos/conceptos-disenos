import { SignUp } from "@clerk/nextjs"
import Image from "next/image"

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#1e2d4e]">
      <div className="mb-8">
        <Image
          src="/logo.jpg"
          alt="Conceptos y Diseños"
          width={160}
          height={64}
          className="object-contain"
          priority
        />
      </div>

      <SignUp
        appearance={{
          elements: {
            rootBox: "w-full max-w-sm",
            card: "shadow-xl rounded-2xl border-0",
          },
        }}
      />
    </div>
  )
}
