export default function PrivacyPolicyPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6">
      <article className="premium-card border border-slate-200 bg-white p-6">
        <h1 className="luxury-title text-3xl font-semibold text-slate-900">
          Politique de confidentialite AMAZER
        </h1>
        <p className="mt-3 text-sm text-slate-600">Derniere mise a jour: 20/03/2026</p>

        <div className="mt-6 space-y-4 text-sm text-slate-700">
          <p>
            AMAZER collecte uniquement les donnees necessaires au service: creation de compte,
            commandes, paiements, livraison, support et prevention de fraude.
          </p>
          <p>
            Donnees traitees: nom, email ou numero WhatsApp, adresses de livraison, historique de
            commande, informations vendeur, et donnees techniques de securite (logs).
          </p>
          <p>
            La camera est demandee seulement pour les fonctions de scan QR/code-barres. Sans scan,
            la permission n est pas necessaire pour utiliser les autres fonctions.
          </p>
          <p>
            Les donnees ne sont pas revendues. Elles sont utilisees pour executer le service,
            respecter les obligations legales et assurer la securite de la plateforme.
          </p>
          <p>
            Vous pouvez demander la suppression de votre compte depuis votre espace utilisateur, ou
            contacter le support a amazer.niger@gmail.com.
          </p>
        </div>
      </article>
    </section>
  );
}
