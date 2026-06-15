import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/clerk(.*)",
])

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    const { userId, redirectToSignIn } = auth()
    if (!userId) {
      return redirectToSignIn()
    }
  }
})

export const config = {
  matcher: [
    "/((?!.+\\.[\\w]+$|_next).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
}
