import { proxyRequest } from "h3";
import { getK8sConfig } from "../utils/k8s";
import { getDomainFromBaseUrl, resolveProxyTarget } from "../utils/proxy";

export default defineEventHandler(async (event) => {
  const host = getRequestHeader(event, "host");
  if (!host) return;

  const config = useRuntimeConfig();
  const domain = getDomainFromBaseUrl(config.appBaseUrl);
  const { podNamespace } = getK8sConfig();

  const resolution = await resolveProxyTarget(host, domain, podNamespace, event.context.user);

  // Not a subdomain request -- let Nuxt handle it normally
  if (!resolution) return;

  // Build the full proxy URL preserving the original path and query string
  const path = event.path || "/";
  const proxyUrl = resolution.target + path;

  // Proxy the request to the pod
  return proxyRequest(event, proxyUrl, {
    fetchOptions: {
      headers: {
        "x-forwarded-host": host,
      },
    },
  });
});
