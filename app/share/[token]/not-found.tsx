export default function ShareNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Link not available</h1>
        <p className="mt-2 text-sm text-slate-600">
          This share link is invalid, expired, or has been revoked.
        </p>
      </div>
    </main>
  );
}
