/** Shared centered status for page and workspace startup. */
export function PageLoading({ children }: { children: string }) {
  return <main className="flex min-h-dvh items-center justify-center bg-app-canvas px-6 text-center">
    <p role="status" className="text-sm text-app-muted">{children}</p>
  </main>;
}
