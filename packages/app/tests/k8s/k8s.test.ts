import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock @kubernetes/client-node before importing k8s utils
const mockCreateNamespacedPod = vi.fn();
const mockDeleteNamespacedPod = vi.fn();
const mockReadNamespacedPod = vi.fn();
const mockListNamespacedPod = vi.fn();
const mockCreateNamespacedService = vi.fn();
const mockDeleteNamespacedService = vi.fn();
const mockCreateNamespacedPersistentVolumeClaim = vi.fn();
const mockDeleteNamespacedPersistentVolumeClaim = vi.fn();

const mockWatch = vi.fn();

vi.mock("@kubernetes/client-node", () => {
  class FakeKubeConfig {
    loadFromCluster() {}
    makeApiClient(apiClass: unknown) {
      if (apiClass === FakeCoreV1Api) {
        return {
          createNamespacedPod: mockCreateNamespacedPod,
          deleteNamespacedPod: mockDeleteNamespacedPod,
          readNamespacedPod: mockReadNamespacedPod,
          listNamespacedPod: mockListNamespacedPod,
          createNamespacedService: mockCreateNamespacedService,
          deleteNamespacedService: mockDeleteNamespacedService,
          createNamespacedPersistentVolumeClaim: mockCreateNamespacedPersistentVolumeClaim,
          deleteNamespacedPersistentVolumeClaim: mockDeleteNamespacedPersistentVolumeClaim,
        };
      }
      return {};
    }
  }

  class FakeCoreV1Api {}

  class FakeWatch {
    constructor(_kubeConfig: unknown) {}
    watch = mockWatch;
  }

  return {
    KubeConfig: FakeKubeConfig,
    CoreV1Api: FakeCoreV1Api,
    Watch: FakeWatch,
  };
});

// Set environment variables for K8s config (read by getK8sConfig())
process.env.POD_SERVER_IMAGE = "portable/pod-server:0.1.0";
process.env.POD_NAMESPACE = "test-ns";
process.env.POD_RESOURCE_CPU_REQUEST = "500m";
process.env.POD_RESOURCE_CPU_LIMIT = "2000m";
process.env.POD_RESOURCE_MEMORY_REQUEST = "512Mi";
process.env.POD_RESOURCE_MEMORY_LIMIT = "4Gi";
process.env.POD_STORAGE_SIZE = "5Gi";

// Dynamic import after mocks are set up
const {
  createProjectPod,
  createProjectPVC,
  createProjectService,
  deleteProjectPod,
  deleteProjectPVC,
  deleteProjectService,
  waitForPodReady,
} = await import("../../server/utils/k8s");

describe("k8s utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createProjectPod", () => {
    it("creates a pod with the correct name and labels", async () => {
      mockCreateNamespacedPod.mockResolvedValue({});

      await createProjectPod({
        slug: "my-project",
        databaseUrl: "postgres://localhost/mydb",
        anthropicApiKey: "sk-ant-test",
        githubToken: "ghp_test",
      });

      expect(mockCreateNamespacedPod).toHaveBeenCalledOnce();
      const [namespace, body] = mockCreateNamespacedPod.mock.calls[0];

      expect(namespace).toBe("test-ns");
      expect(body.metadata.name).toBe("project-my-project");
      expect(body.metadata.labels).toEqual(
        expect.objectContaining({
          "app.kubernetes.io/managed-by": "portable",
          "portable.dev/project": "my-project",
        }),
      );
    });

    it("sets the container image from runtime config", async () => {
      mockCreateNamespacedPod.mockResolvedValue({});

      await createProjectPod({
        slug: "my-project",
        databaseUrl: "postgres://localhost/mydb",
        anthropicApiKey: "sk-ant-test",
        githubToken: "ghp_test",
      });

      const [, body] = mockCreateNamespacedPod.mock.calls[0];
      expect(body.spec.containers[0].image).toBe("portable/pod-server:0.1.0");
    });

    it("injects all required environment variables", async () => {
      mockCreateNamespacedPod.mockResolvedValue({});

      await createProjectPod({
        slug: "my-project",
        databaseUrl: "postgres://localhost/mydb",
        anthropicApiKey: "sk-ant-api-key",
        githubToken: "ghp_mytoken",
      });

      const [, body] = mockCreateNamespacedPod.mock.calls[0];
      const envVars = body.spec.containers[0].env;

      const findEnv = (name: string) => envVars.find((e: { name: string }) => e.name === name);

      expect(findEnv("DATABASE_URL")).toEqual({
        name: "DATABASE_URL",
        value: "postgres://localhost/mydb",
      });
      expect(findEnv("ANTHROPIC_API_KEY")).toEqual({
        name: "ANTHROPIC_API_KEY",
        value: "sk-ant-api-key",
      });
      expect(findEnv("GITHUB_TOKEN")).toEqual({ name: "GITHUB_TOKEN", value: "ghp_mytoken" });
    });

    it("uses CLAUDE_CODE_OAUTH_TOKEN when claudeOAuthToken is provided instead of anthropicApiKey", async () => {
      mockCreateNamespacedPod.mockResolvedValue({});

      await createProjectPod({
        slug: "my-project",
        databaseUrl: "postgres://localhost/mydb",
        claudeOAuthToken: "oauth-token-123",
        githubToken: "ghp_mytoken",
      });

      const [, body] = mockCreateNamespacedPod.mock.calls[0];
      const envVars = body.spec.containers[0].env;

      const findEnv = (name: string) => envVars.find((e: { name: string }) => e.name === name);

      expect(findEnv("CLAUDE_CODE_OAUTH_TOKEN")).toEqual({
        name: "CLAUDE_CODE_OAUTH_TOKEN",
        value: "oauth-token-123",
      });
      expect(findEnv("ANTHROPIC_API_KEY")).toBeUndefined();
    });

    it("sets resource requests and limits", async () => {
      mockCreateNamespacedPod.mockResolvedValue({});

      await createProjectPod({
        slug: "my-project",
        databaseUrl: "postgres://localhost/mydb",
        anthropicApiKey: "sk-ant-test",
        githubToken: "ghp_test",
      });

      const [, body] = mockCreateNamespacedPod.mock.calls[0];
      const resources = body.spec.containers[0].resources;

      expect(resources.requests).toEqual({ cpu: "500m", memory: "512Mi" });
      expect(resources.limits).toEqual({ cpu: "2000m", memory: "4Gi" });
    });

    it("mounts the PVC at /workspace", async () => {
      mockCreateNamespacedPod.mockResolvedValue({});

      await createProjectPod({
        slug: "my-project",
        databaseUrl: "postgres://localhost/mydb",
        anthropicApiKey: "sk-ant-test",
        githubToken: "ghp_test",
      });

      const [, body] = mockCreateNamespacedPod.mock.calls[0];
      const volumeMounts = body.spec.containers[0].volumeMounts;
      const volumes = body.spec.volumes;

      expect(volumeMounts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "workspace",
            mountPath: "/workspace",
          }),
        ]),
      );
      expect(volumes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "workspace",
            persistentVolumeClaim: { claimName: "project-my-project" },
          }),
        ]),
      );
    });

    it("sets restart policy to Always", async () => {
      mockCreateNamespacedPod.mockResolvedValue({});

      await createProjectPod({
        slug: "my-project",
        databaseUrl: "postgres://localhost/mydb",
        anthropicApiKey: "sk-ant-test",
        githubToken: "ghp_test",
      });

      const [, body] = mockCreateNamespacedPod.mock.calls[0];
      expect(body.spec.restartPolicy).toBe("Always");
    });

    it("exposes ports 3000 and 3001", async () => {
      mockCreateNamespacedPod.mockResolvedValue({});

      await createProjectPod({
        slug: "my-project",
        databaseUrl: "postgres://localhost/mydb",
        anthropicApiKey: "sk-ant-test",
        githubToken: "ghp_test",
      });

      const [, body] = mockCreateNamespacedPod.mock.calls[0];
      const ports = body.spec.containers[0].ports;

      expect(ports).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ containerPort: 3000, name: "editor" }),
          expect.objectContaining({ containerPort: 3001, name: "preview" }),
        ]),
      );
    });

    it("allows overriding the namespace", async () => {
      mockCreateNamespacedPod.mockResolvedValue({});

      await createProjectPod({
        slug: "my-project",
        namespace: "custom-ns",
        databaseUrl: "postgres://localhost/mydb",
        anthropicApiKey: "sk-ant-test",
        githubToken: "ghp_test",
      });

      const [namespace] = mockCreateNamespacedPod.mock.calls[0];
      expect(namespace).toBe("custom-ns");
    });
  });

  describe("createProjectService", () => {
    it("creates a headless service with correct name and labels", async () => {
      mockCreateNamespacedService.mockResolvedValue({});

      await createProjectService("my-project");

      expect(mockCreateNamespacedService).toHaveBeenCalledOnce();
      const [namespace, body] = mockCreateNamespacedService.mock.calls[0];

      expect(namespace).toBe("test-ns");
      expect(body.metadata.name).toBe("project-my-project");
      expect(body.spec.clusterIP).toBe("None");
      expect(body.metadata.labels).toEqual(
        expect.objectContaining({
          "app.kubernetes.io/managed-by": "portable",
          "portable.dev/project": "my-project",
        }),
      );
    });

    it("has correct selector matching pod labels", async () => {
      mockCreateNamespacedService.mockResolvedValue({});

      await createProjectService("my-project");

      const [, body] = mockCreateNamespacedService.mock.calls[0];
      expect(body.spec.selector).toEqual(
        expect.objectContaining({
          "portable.dev/project": "my-project",
        }),
      );
    });

    it("exposes ports 3000 and 3001", async () => {
      mockCreateNamespacedService.mockResolvedValue({});

      await createProjectService("my-project");

      const [, body] = mockCreateNamespacedService.mock.calls[0];
      const ports = body.spec.ports;

      expect(ports).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ port: 3000, targetPort: 3000, name: "editor" }),
          expect.objectContaining({ port: 3001, targetPort: 3001, name: "preview" }),
        ]),
      );
    });

    it("allows overriding namespace", async () => {
      mockCreateNamespacedService.mockResolvedValue({});

      await createProjectService("my-project", "custom-ns");

      const [namespace] = mockCreateNamespacedService.mock.calls[0];
      expect(namespace).toBe("custom-ns");
    });
  });

  describe("createProjectPVC", () => {
    it("creates a PVC with correct name and labels", async () => {
      mockCreateNamespacedPersistentVolumeClaim.mockResolvedValue({});

      await createProjectPVC("my-project");

      expect(mockCreateNamespacedPersistentVolumeClaim).toHaveBeenCalledOnce();
      const [namespace, body] = mockCreateNamespacedPersistentVolumeClaim.mock.calls[0];

      expect(namespace).toBe("test-ns");
      expect(body.metadata.name).toBe("project-my-project");
      expect(body.metadata.labels).toEqual(
        expect.objectContaining({
          "app.kubernetes.io/managed-by": "portable",
          "portable.dev/project": "my-project",
        }),
      );
    });

    it("sets 5Gi storage size from runtime config", async () => {
      mockCreateNamespacedPersistentVolumeClaim.mockResolvedValue({});

      await createProjectPVC("my-project");

      const [, body] = mockCreateNamespacedPersistentVolumeClaim.mock.calls[0];
      expect(body.spec.resources.requests.storage).toBe("5Gi");
    });

    it("sets ReadWriteOnce access mode", async () => {
      mockCreateNamespacedPersistentVolumeClaim.mockResolvedValue({});

      await createProjectPVC("my-project");

      const [, body] = mockCreateNamespacedPersistentVolumeClaim.mock.calls[0];
      expect(body.spec.accessModes).toEqual(["ReadWriteOnce"]);
    });

    it("allows overriding namespace", async () => {
      mockCreateNamespacedPersistentVolumeClaim.mockResolvedValue({});

      await createProjectPVC("my-project", "custom-ns");

      const [namespace] = mockCreateNamespacedPersistentVolumeClaim.mock.calls[0];
      expect(namespace).toBe("custom-ns");
    });
  });

  describe("waitForPodReady", () => {
    it("resolves when pod has Ready condition true", async () => {
      // Simulate watch callback firing with ready pod
      mockWatch.mockImplementation(
        (
          _path: string,
          _queryParams: unknown,
          callback: (type: string, apiObj: unknown) => void,
          _done: (err: unknown) => void,
        ) => {
          // Simulate pod becoming ready
          callback("MODIFIED", {
            metadata: { name: "project-my-project" },
            status: {
              conditions: [{ type: "Ready", status: "True" }],
            },
          });
          return Promise.resolve(new AbortController());
        },
      );

      await expect(waitForPodReady("my-project")).resolves.toBeUndefined();
    });

    it("rejects on timeout when pod never becomes ready", async () => {
      // Watch never fires the callback with Ready condition
      mockWatch.mockImplementation(
        (
          _path: string,
          _queryParams: unknown,
          _callback: (type: string, apiObj: unknown) => void,
          _done: (err: unknown) => void,
        ) => {
          // Never call callback -- simulate timeout
          return Promise.resolve(new AbortController());
        },
      );

      await expect(waitForPodReady("my-project", undefined, 100)).rejects.toThrow(/timed out/i);
    });

    it("resolves even if initial events show not-ready then ready", async () => {
      mockWatch.mockImplementation(
        (
          _path: string,
          _queryParams: unknown,
          callback: (type: string, apiObj: unknown) => void,
          _done: (err: unknown) => void,
        ) => {
          // First event: not ready
          callback("MODIFIED", {
            metadata: { name: "project-my-project" },
            status: {
              conditions: [{ type: "Ready", status: "False" }],
            },
          });
          // Second event: ready
          callback("MODIFIED", {
            metadata: { name: "project-my-project" },
            status: {
              conditions: [{ type: "Ready", status: "True" }],
            },
          });
          return Promise.resolve(new AbortController());
        },
      );

      await expect(waitForPodReady("my-project")).resolves.toBeUndefined();
    });
  });

  describe("deleteProjectPod", () => {
    it("calls the K8s delete API for the pod", async () => {
      mockDeleteNamespacedPod.mockResolvedValue({});

      await deleteProjectPod("my-project");

      expect(mockDeleteNamespacedPod).toHaveBeenCalledOnce();
      const [name, namespace] = mockDeleteNamespacedPod.mock.calls[0];
      expect(name).toBe("project-my-project");
      expect(namespace).toBe("test-ns");
    });

    it("gracefully handles 404 (already deleted)", async () => {
      const error = new Error("Not Found") as Error & { statusCode: number };
      error.statusCode = 404;
      mockDeleteNamespacedPod.mockRejectedValue(error);

      await expect(deleteProjectPod("my-project")).resolves.toBeUndefined();
    });

    it("rethrows non-404 errors", async () => {
      const error = new Error("Internal Server Error") as Error & { statusCode: number };
      error.statusCode = 500;
      mockDeleteNamespacedPod.mockRejectedValue(error);

      await expect(deleteProjectPod("my-project")).rejects.toThrow("Internal Server Error");
    });

    it("allows overriding namespace", async () => {
      mockDeleteNamespacedPod.mockResolvedValue({});

      await deleteProjectPod("my-project", "custom-ns");

      const [, namespace] = mockDeleteNamespacedPod.mock.calls[0];
      expect(namespace).toBe("custom-ns");
    });
  });

  describe("deleteProjectService", () => {
    it("calls the K8s delete API for the service", async () => {
      mockDeleteNamespacedService.mockResolvedValue({});

      await deleteProjectService("my-project");

      expect(mockDeleteNamespacedService).toHaveBeenCalledOnce();
      const [name, namespace] = mockDeleteNamespacedService.mock.calls[0];
      expect(name).toBe("project-my-project");
      expect(namespace).toBe("test-ns");
    });

    it("gracefully handles 404 (already deleted)", async () => {
      const error = new Error("Not Found") as Error & { statusCode: number };
      error.statusCode = 404;
      mockDeleteNamespacedService.mockRejectedValue(error);

      await expect(deleteProjectService("my-project")).resolves.toBeUndefined();
    });

    it("rethrows non-404 errors", async () => {
      const error = new Error("Forbidden") as Error & { statusCode: number };
      error.statusCode = 403;
      mockDeleteNamespacedService.mockRejectedValue(error);

      await expect(deleteProjectService("my-project")).rejects.toThrow("Forbidden");
    });
  });

  describe("deleteProjectPVC", () => {
    it("calls the K8s delete API for the PVC", async () => {
      mockDeleteNamespacedPersistentVolumeClaim.mockResolvedValue({});

      await deleteProjectPVC("my-project");

      expect(mockDeleteNamespacedPersistentVolumeClaim).toHaveBeenCalledOnce();
      const [name, namespace] = mockDeleteNamespacedPersistentVolumeClaim.mock.calls[0];
      expect(name).toBe("project-my-project");
      expect(namespace).toBe("test-ns");
    });

    it("gracefully handles 404 (already deleted)", async () => {
      const error = new Error("Not Found") as Error & { statusCode: number };
      error.statusCode = 404;
      mockDeleteNamespacedPersistentVolumeClaim.mockRejectedValue(error);

      await expect(deleteProjectPVC("my-project")).resolves.toBeUndefined();
    });

    it("rethrows non-404 errors", async () => {
      const error = new Error("Forbidden") as Error & { statusCode: number };
      error.statusCode = 403;
      mockDeleteNamespacedPersistentVolumeClaim.mockRejectedValue(error);

      await expect(deleteProjectPVC("my-project")).rejects.toThrow("Forbidden");
    });
  });
});
