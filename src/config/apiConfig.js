const getEnvValue = (key, fallback = "") => {
  const value = import.meta.env[key];
  if (typeof value !== "string") return fallback;

  const trimmedValue = value.trim();
  return trimmedValue || fallback;
};

const removeTrailingSlash = (url) => url.replace(/\/+$/, "");

const mainApiBaseUrl = removeTrailingSlash(
  getEnvValue("VITE_MAIN_API_BASE_URL", "https://oydinplaza.medme.uz"),
);

const defaultMainApiUrl = `${mainApiBaseUrl}/api`;
const mainApiUrl = removeTrailingSlash(
  getEnvValue("VITE_MAIN_API_URL", defaultMainApiUrl),
);

const API_CONFIG = {
  MAIN_API: {
    baseUrl: mainApiBaseUrl,
    apiUrl: mainApiUrl,
  },
};

export default API_CONFIG;
