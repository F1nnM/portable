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

  // Proxy the request to the pod
  return proxyRequest(event, resolution.target, {
    fetchOptions: {
      headers: {
        "x-forwarded-host": host,
      },
    },
  });
});
