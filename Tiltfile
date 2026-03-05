# Tiltfile for Portable local development
#
# Usage:
#   mise start               (create cluster, install ingress, tilt up)
#   mise stop                (tear down cluster)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REGISTRY = "k3d-portable-registry.localhost:5002"
APP_IMAGE = REGISTRY + "/portable-app"
POD_SERVER_IMAGE = REGISTRY + "/portable-pod-server"

# Pod server image is referenced only via env var (NUXT_POD_SERVER_IMAGE),
# not in any static K8s manifest, since pods are created dynamically at runtime.
update_settings(suppress_unused_image_warnings=[POD_SERVER_IMAGE])

# ---------------------------------------------------------------------------
# Docker builds
# ---------------------------------------------------------------------------

# Main app (Nuxt) — Dockerfile.dev with Nuxt HMR
docker_build(
    APP_IMAGE,
    context=".",
    dockerfile="packages/app/Dockerfile.dev",
    live_update=[
        fall_back_on(["packages/app/package.json", "pnpm-lock.yaml"]),
        sync("packages/app/", "/app/packages/app/"),
    ],
)

# Pod server (Hono + editor SPA) — Dockerfile.dev with tsx watch
docker_build(
    POD_SERVER_IMAGE,
    context=".",
    dockerfile="packages/pod-server/Dockerfile.dev",
    live_update=[
        fall_back_on([
            "packages/pod-server/package.json",
            "packages/editor/package.json",
            "pnpm-lock.yaml",
        ]),
        sync("packages/pod-server/", "/build/packages/pod-server/"),
        sync("packages/editor/", "/build/packages/editor/"),
        run(
            "cd /build && pnpm --filter @portable/editor build",
            trigger=["packages/editor/"],
        ),
    ],
)

# ---------------------------------------------------------------------------
# Helm deployment
# ---------------------------------------------------------------------------

k8s_yaml(
    helm(
        "deploy/helm/portable",
        name="portable",
        namespace="default",
        values=["deploy/dev-values.yaml"],
        set=[
            "image.repository=" + APP_IMAGE,
            "image.tag=dev",
            "podServer.image.repository=" + POD_SERVER_IMAGE,
            "podServer.image.tag=dev",
        ],
    )
)

# ---------------------------------------------------------------------------
# Resource configuration
# ---------------------------------------------------------------------------

# Main app resource — include RBAC objects so they deploy together
k8s_resource(
    "portable",
    objects=[
        "portable:serviceaccount",
        "portable:role",
        "portable:rolebinding",
        "portable-project-isolation:networkpolicy",
    ],
    port_forwards=[
        port_forward(3000, 3000, name="app-http"),
    ],
    labels=["app"],
)

# Postgres resource
k8s_resource(
    "portable-postgres",
    port_forwards=[
        port_forward(5432, 5432, name="postgres"),
    ],
    labels=["infra"],
)
