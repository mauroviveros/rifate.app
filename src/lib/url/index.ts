export const DASHBOARD_PATH = "/dashboard";
export const LOGIN_PATH = "/login";
export const HOME_PATH = "/";

export const toSafeInternalPath = (value: string | null) => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return DASHBOARD_PATH;
  return value;
};

export const buildLoginRedirect = (url: URL, searchPArams: Record<string, string | null | undefined>) => {
  const loginUrl = new URL(LOGIN_PATH, url);
  for (const [key, value] of Object.entries(searchPArams)) {
    if (value) loginUrl.searchParams.set(key, value);
  }
  return loginUrl.toString();
}
