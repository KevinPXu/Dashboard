'use client';

export default function ShellError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">Something broke.</h1>
          <p className="mt-2 text-sm text-slate-600">{error.message}</p>
          <button
            onClick={reset}
            className="mt-4 rounded bg-slate-900 px-3 py-2 text-sm text-white"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
