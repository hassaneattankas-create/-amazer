import Link from "next/link";

export default function AccountDeletionPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-gutter pb-16 pt-4">
      <article className="rounded-card border border-border bg-card p-6">
        <h1 className="text-3xl font-semibold text-ink-900">Supprimer votre compte</h1>
        <p className="mt-3 text-sm text-ink-600">Dernière mise à jour : 14/10/2026</p>

        <div className="mt-6 space-y-4 text-sm text-ink-700">
          <h2 className="text-base font-semibold text-ink-900">Depuis l&apos;application</h2>
          <p>
            Connectez-vous, ouvrez{" "}
            <Link href="/dashboard" className="font-medium text-brand-700 hover:underline">
              Mon compte
            </Link>
            , puis « Supprimer mon compte ». Votre mot de passe vous est demandé pour confirmer.
          </p>
          <h2 className="pt-2 text-base font-semibold text-ink-900">Sans accès à votre compte</h2>
          <p>
            Écrivez à{" "}
            <a className="font-medium text-brand-700 hover:underline" href="mailto:amazer.niger2@gmail.com">
              amazer.niger2@gmail.com
            </a>{" "}
            depuis l&apos;e-mail ou le numéro WhatsApp du compte, en indiquant :
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>votre identifiant (e-mail ou numéro WhatsApp) ;</li>
            <li>que vous demandez la suppression de votre compte AMAZER ;</li>
            <li>toute information utile pour vérifier votre identité.</li>
          </ul>
          <h2 className="pt-2 text-base font-semibold text-ink-900">Ce qui se passe</h2>
          <p>
            Le compte est désactivé, les sessions sont fermées, les données d&apos;identification sont effacées ou
            anonymisées et les offres vendeur sont retirées. Certaines données peuvent être conservées si la sécurité, la
            prévention de la fraude, la loi ou un litige l&apos;exigent.
          </p>
          <p>
            Plus d&apos;informations :{" "}
            <Link className="font-medium text-brand-700 hover:underline" href="/legal/privacy">
              politique de confidentialité
            </Link>
            .
          </p>
        </div>
      </article>
    </section>
  );
}
