/** RFC-style UUID (any version) — matches Sequelize `DataTypes.UUID` / Node `randomUUID()`. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | undefined | null): boolean {
  if (value == null) return false;
  return UUID_RE.test(String(value).trim());
}

/** Client-only note/file id (never call `GET /courses/.../files/:id` or Django promote with this). */
export function isLocalOnlyFileId(value: string | undefined | null): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  return s.startsWith('local-') || s.startsWith('JOT_');
}
