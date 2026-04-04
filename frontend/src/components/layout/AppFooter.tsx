import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white/95 px-4 py-6 text-sm text-slate-600">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>AMAZER - Support: amazer.niger@gmail.com</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/legal/privacy" className="hover:text-[#FF4D00] hover:underline">
            Politique de confidentialite
          </Link>
          <Link href="/legal/account-deletion" className="hover:text-[#FF4D00] hover:underline">
            Suppression de compte
          </Link>
          <Link href="/legal/terms" className="hover:text-[#FF4D00] hover:underline">
            Conditions d utilisation
          </Link>
        </div>
      </div>
    </footer>
  );
}
