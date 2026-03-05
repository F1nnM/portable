import { CoreV1Api, KubeConfig, Watch } from "@kubernetes/client-node";

export interface CreateProjectPodOptions {
  slug: string;
  namespace?: string;
  databaseUrl: string;
  anthropicApiKey?: string;
  claudeOAuthToken?: string;
  githubToken: string;
  repoUrl?: string;
}

export interface K8sConfig {
  podNamespace: string;
  podServerImage: string;
  podResourceCpuRequest: string;
  podResourceCpuLimit: string;
  podResourceMemoryRequest: string;
  podResourceMemoryLimit: string;
  podStorageSize: string;
}

let _kubeConfig: KubeConfig | undefined;
let _coreApi: InstanceType<typeof CoreV1Api> | undefined;

function getKubeConfig(): KubeConfig {
  if (!_kubeConfig) {
    _kubeConfig = new KubeConfig();
    _kubeConfig.loadFromCluster();
  }
  return _kubeConfig;
}

function getCoreApi(): InstanceType<typeof CoreV1Api> {
  if (!_coreApi) {
    _coreApi = getKubeConfig().makeApiClient(CoreV1Api);
  }
  return _coreApi;
}

/**
 * Reads K8s-related configuration from environment variables.
 * These are set via Helm ConfigMap and Deployment env vars with NUXT_ prefix
 * (which Nuxt strips when populating runtimeConfig).
 * We read from process.env directly so this utility works without a Nuxt context.
 */
export function getK8sConfig(): K8sConfig {
  return {
    podNamespace: process.env.NUXT_POD_NAMESPACE || process.env.POD_NAMESPACE || "default",
    podServerImage:
      process.env.NUXT_POD_SERVER_IMAGE ||
      process.env.POD_SERVER_IMAGE ||
      "portable/pod-server:latest",
    podResourceCpuRequest:
      process.env.NUXT_POD_RESOURCE_CPU_REQUEST || process.env.POD_RESOURCE_CPU_REQUEST || "500m",
    podResourceCpuLimit:
      process.env.NUXT_POD_RESOURCE_CPU_LIMIT || process.env.POD_RESOURCE_CPU_LIMIT || "2000m",
    podResourceMemoryRequest:
      process.env.NUXT_POD_RESOURCE_MEMORY_REQUEST ||
      process.env.POD_RESOURCE_MEMORY_REQUEST ||
      "512Mi",
    podResourceMemoryLimit:
      process.env.NUXT_POD_RESOURCE_MEMORY_LIMIT || process.env.POD_RESOURCE_MEMORY_LIMIT || "4Gi",
    podStorageSize: process.env.NUXT_POD_STORAGE_SIZE || process.env.POD_STORAGE_SIZE || "5Gi",
  };
}

function projectResourceName(slug: string): string {
  return `project-${slug}`;
}

function projectLabels(slug: string): Record<string, string> {
  return {
    "app.kubernetes.io/managed-by": "portable",
    "portable.dev/project": slug,
  };
}

/**
 * Creates a Kubernetes pod for a project.
 */
export async function createProjectPod(options: CreateProjectPodOptions): Promise<void> {
  const config = getK8sConfig();
  const api = getCoreApi();
  const namespace = options.namespace || config.podNamespace;
  const name = projectResourceName(options.slug);
  const labels = projectLabels(options.slug);

  const env: Array<{ name: string; value: string }> = [
    { name: "DATABASE_URL", value: options.databaseUrl },
    { name: "GITHUB_TOKEN", value: options.githubToken },
  ];

  if (options.repoUrl) {
    env.push({ name: "GITHUB_REPO_URL", value: options.repoUrl });
  }

  if (options.claudeOAuthToken) {
    env.push({ name: "CLAUDE_CODE_OAUTH_TOKEN", value: options.claudeOAuthToken });
  } else if (options.anthropicApiKey) {
    env.push({ name: "ANTHROPIC_API_KEY", value: options.anthropicApiKey });
  }

  await api.createNamespacedPod({
    namespace,
    body: {
      metadata: {
        name,
        labels,
      },
      spec: {
        restartPolicy: "Always",
        containers: [
          {
            name: "pod-server",
            image: config.podServerImage,
            ports: [
              { containerPort: 3000, name: "editor" },
              { containerPort: 3001, name: "preview" },
            ],
            env,
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 1000,
              allowPrivilegeEscalation: false,
              capabilities: {
                drop: ["ALL"],
              },
            },
            resources: {
              requests: {
                cpu: config.podResourceCpuRequest,
                memory: config.podResourceMemoryRequest,
              },
              limits: {
                cpu: config.podResourceCpuLimit,
                memory: config.podResourceMemoryLimit,
              },
            },
            volumeMounts: [
              {
                name: "workspace",
                mountPath: "/workspace",
              },
            ],
          },
        ],
        volumes: [
          {
            name: "workspace",
            persistentVolumeClaim: {
              claimName: name,
            },
          },
        ],
      },
    },
  });
}

/**
 * Creates a headless Kubernetes service for a project pod.
 */
export async function createProjectService(slug: string, namespace?: string): Promise<void> {
  const config = getK8sConfig();
  const api = getCoreApi();
  const ns = namespace || config.podNamespace;
  const name = projectResourceName(slug);
  const labels = projectLabels(slug);

  await api.createNamespacedService({
    namespace: ns,
    body: {
      metadata: {
        name,
        labels,
      },
      spec: {
        clusterIP: "None",
        selector: {
          "portable.dev/project": slug,
        },
        ports: [
          { port: 3000, targetPort: 3000, name: "editor" },
          { port: 3001, targetPort: 3001, name: "preview" },
        ],
      },
    },
  });
}

/**
 * Creates a PersistentVolumeClaim for a project workspace.
 */
export async function createProjectPVC(slug: string, namespace?: string): Promise<void> {
  const config = getK8sConfig();
  const api = getCoreApi();
  const ns = namespace || config.podNamespace;
  const name = projectResourceName(slug);
  const labels = projectLabels(slug);

  await api.createNamespacedPersistentVolumeClaim({
    namespace: ns,
    body: {
      metadata: {
        name,
        labels,
      },
      spec: {
        accessModes: ["ReadWriteOnce"],
        resources: {
          requests: {
            storage: config.podStorageSize,
          },
        },
      },
    },
  });
}

/**
 * Watches a project pod until it reaches the Ready condition or times out.
 */
export async function waitForPodReady(
  slug: string,
  namespace?: string,
  timeoutMs: number = 120_000,
): Promise<void> {
  const config = getK8sConfig();
  const kc = getKubeConfig();
  const ns = namespace || config.podNamespace;
  const name = projectResourceName(slug);
  const watch = new Watch(kc);

  return new Promise<void>((resolve, reject) => {
    let abortController: AbortController | undefined;
    let settled = false;

    function settle() {
      if (settled) return;
      settled = true;
    }

    const timeout = setTimeout(() => {
      settle();
      if (abortController) {
        abortController.abort();
      }
      reject(new Error(`Pod ${name} timed out waiting to become ready after ${timeoutMs}ms`));
    }, timeoutMs);

    watch
      .watch(
        `/api/v1/namespaces/${ns}/pods`,
        { fieldSelector: `metadata.name=${name}` },
        (
          _type: string,
          apiObj: { status?: { conditions?: Array<{ type: string; status: string }> } },
        ) => {
          const conditions = apiObj?.status?.conditions;
          if (conditions) {
            const ready = conditions.find((c) => c.type === "Ready" && c.status === "True");
            if (ready && !settled) {
              settle();
              clearTimeout(timeout);
              if (abortController) {
                abortController.abort();
              }
              resolve();
            }
          }
        },
        (err: unknown) => {
          if (settled) return;
          settle();
          clearTimeout(timeout);
          reject(
            err instanceof Error
              ? err
              : new Error(err ? String(err) : "Watch ended without pod becoming ready"),
          );
        },
      )
      .then((ac) => {
        abortController = ac;
        // If already settled (e.g., callback fired synchronously or timeout hit),
        // abort the watch immediately.
        if (settled) {
          ac.abort();
        }
      })
      .catch((err) => {
        if (settled) return;
        settle();
        clearTimeout(timeout);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });
}

/**
 * Deletes a project pod. Ignores 404 (already deleted).
 */
export async function deleteProjectPod(slug: string, namespace?: string): Promise<void> {
  const config = getK8sConfig();
  const api = getCoreApi();
  const ns = namespace || config.podNamespace;
  const name = projectResourceName(slug);

  try {
    await api.deleteNamespacedPod({ name, namespace: ns });
  } catch (err: unknown) {
    if (isK8s404(err)) return;
    throw err;
  }
}

/**
 * Deletes a project service. Ignores 404 (already deleted).
 */
export async function deleteProjectService(slug: string, namespace?: string): Promise<void> {
  const config = getK8sConfig();
  const api = getCoreApi();
  const ns = namespace || config.podNamespace;
  const name = projectResourceName(slug);

  try {
    await api.deleteNamespacedService({ name, namespace: ns });
  } catch (err: unknown) {
    if (isK8s404(err)) return;
    throw err;
  }
}

/**
 * Deletes a project PVC. Ignores 404 (already deleted).
 */
export async function deleteProjectPVC(slug: string, namespace?: string): Promise<void> {
  const config = getK8sConfig();
  const api = getCoreApi();
  const ns = namespace || config.podNamespace;
  const name = projectResourceName(slug);

  try {
    await api.deleteNamespacedPersistentVolumeClaim({ name, namespace: ns });
  } catch (err: unknown) {
    if (isK8s404(err)) return;
    throw err;
  }
}

function isK8s404(err: unknown): boolean {
  if (err && typeof err === "object") {
    if ("code" in err && (err as { code: number }).code === 404) return true;
    if ("statusCode" in err && (err as { statusCode: number }).statusCode === 404) return true;
  }
  return false;
}
