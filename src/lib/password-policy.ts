import { z } from "zod";

export const strongPasswordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(72, "Senha muito longa")
  .regex(/[A-Z]/, "Inclua ao menos 1 letra maiúscula")
  .regex(/[0-9]/, "Inclua ao menos 1 número");

export function isStrongPassword(password: string) {
  return strongPasswordSchema.safeParse(password).success;
}
