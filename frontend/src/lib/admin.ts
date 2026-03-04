const configuredAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase();

export const ADMIN_EMAIL = configuredAdminEmail || "amazer.niger@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}
