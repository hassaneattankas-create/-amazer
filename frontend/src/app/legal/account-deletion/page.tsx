import Link from "next/link";

export default function AccountDeletionPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6">
      <article className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold text-slate-900">
          Suppression De Compte AMAZER
        </h1>
        <p className="mt-3 text-sm text-slate-600">Derniere mise a jour: 25/03/2026</p>

        <div className="mt-6 space-y-4 text-sm text-slate-700">
          <p>
            Cette page permet aux utilisateurs AMAZER de comprendre comment demander la suppression
            de leur compte et des donnees associees.
          </p>
          <p>
            Methode recommandee: connectez-vous a votre compte, ouvrez le dashboard, puis utilisez
            la section <span className="font-medium text-slate-900">Suppression Du Compte</span>.
            La suppression demande votre mot de passe actuel pour confirmer l operation.
          </p>
          <p>
            Si vous ne pouvez plus acceder a l application, envoyez une demande depuis l adresse
            email ou le numero WhatsApp associe au compte a{" "}
            <a className="font-medium text-[#FF4D00] hover:underline" href="mailto:amazer.niger@gmail.com">
              amazer.niger@gmail.com
            </a>{" "}
            en indiquant:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>votre identifiant de compte (email ou numero WhatsApp),</li>
            <li>la mention explicite que vous demandez la suppression du compte AMAZER,</li>
            <li>toute information utile pour verifier votre identite.</li>
          </ul>
          <p>
            Effet de la suppression: le compte est desactive, les sessions sont revoquees, les
            donnees d identification directe sont supprimees ou anonymisees, et les offres vendeur
            associees sont desactivees.
          </p>
          <p>
            Certaines donnees peuvent etre conservees si cela est necessaire pour la securite, la
            prevention de fraude, le respect d obligations legales ou la resolution de litiges.
          </p>
          <p>
            Pour plus d informations, consultez la{" "}
            <Link className="font-medium text-[#FF4D00] hover:underline" href="/legal/privacy">
              politique de confidentialite
            </Link>
            .
          </p>
        </div>
      </article>
    </section>
  );
}
