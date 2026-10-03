import Link from "next/link";

// Placeholder: la landing y el catálogo público son la siguiente fase.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-serif text-4xl font-bold">El Mate</h1>
      <p className="text-muted">Pronto, nuestra tienda online.</p>
      <Link href="/admin" className="text-sm font-medium text-primary underline underline-offset-4">
        Ingresar al panel
      </Link>
    </main>
  );
}
