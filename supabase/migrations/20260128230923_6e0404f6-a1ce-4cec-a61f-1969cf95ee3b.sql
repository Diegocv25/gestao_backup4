-- 1) Cleanup: if there are duplicated emails within the same salao,
-- keep the oldest row's email and null-out the others (to allow unique index creation).
-- We only touch rows where email is not null.
WITH ranked AS (
  SELECT
    id,
    salao_id,
    email,
    row_number() OVER (
      PARTITION BY salao_id, lower(trim(email))
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.clientes
  WHERE email IS NOT NULL
)
UPDATE public.clientes c
SET email = NULL
FROM ranked r
WHERE c.id = r.id
  AND r.rn > 1;

-- 2) Enforce: email unique per salao (case-insensitive), when email is present
CREATE UNIQUE INDEX IF NOT EXISTS clientes_salao_email_uniq
  ON public.clientes (salao_id, lower(trim(email)))
  WHERE email IS NOT NULL;
