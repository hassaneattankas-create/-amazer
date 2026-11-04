/** Moyen de paiement visible par le client. `kind` : "amana" (validation automatique) ou "manual" (vérifié par AMAZER). */
export type PaymentMethod = {
  code: string;
  name: string;
  kind: string;
  account_number: string | null;
  account_name: string | null;
  instructions: string | null;
};

export type AdminPaymentMethod = PaymentMethod & {
  is_active: boolean;
  sort_order: number;
  /** Nita et Amana : modifiables, mais jamais supprimés. */
  built_in: boolean;
};

export type PaymentMethodInput = {
  name: string;
  account_number: string | null;
  account_name: string | null;
  instructions: string | null;
  is_active: boolean;
  sort_order: number;
};
