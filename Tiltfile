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

# ---------------------------------------------------------------------------
# Docker builds
# ---------------------------------------------------------------------------

# Directories that are generated or cached and should never trigger builds/syncs.
IGNORE_PATTERNS = [
    "**/node_modules",
    "**/.nuxt",
    "**/.output",
    "**/.nitro",
    "**/.cache",
    "**/.vite-temp",
    "**/dist",
    "**/*.tmp.*",
    "**/*.tsbuildinfo",
]

# Main app (Nuxt) — Dockerfile.dev with Nuxt HMR
docker_build(
    APP_IMAGE,
    context=".",
    dockerfile="packages/app/Dockerfile.dev",
    only=[
        "package.json",
        "bun.lock",
        "packages/app/",
        "packages/pod-server/package.json",
        "packages/editor/package.json",
        "scaffolds/",
    ],
    ignore=IGNORE_PATTERNS,
    live_update=[
        fall_back_on(["packages/app/package.json", "bun.lock"]),
        sync("packages/app/", "/app/packages/app/"),
        sync("scaffolds/", "/app/scaffolds/"),
    ],
)

# Pod server (Hono + editor SPA) — Dockerfile.dev.
#
# Project pods are created dynamically at runtime, not in static K8s manifests,
# so Tilt can't detect the image reference. A dummy Job (tilt-pod-server-anchor)
# anchors the image so Tilt builds and pushes it. This keeps the pod-server
# build fully decoupled from the app Deployment (no match_in_env_vars, no
# cascading rollouts).
docker_build(
    POD_SERVER_IMAGE,
    context=".",
    dockerfile="packages/pod-server/Dockerfile.dev",
    only=[
        "package.json",
        "bun.lock",
        "packages/pod-server/",
        "packages/editor/",
        "packages/app/package.json",
    ],
    ignore=IGNORE_PATTERNS,
)

# ---------------------------------------------------------------------------
# Helm deployment
# ---------------------------------------------------------------------------

# Anchor Job that references the pod-server image so Tilt builds it.
k8s_yaml("deploy/tilt-pod-server-anchor.yaml")

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

# Pod server image build (anchored by dummy Job)
k8s_resource(
    "pod-server-anchor",
    labels=["build"],
)

# Postgres resource
k8s_resource(
    "portable-postgres",
    port_forwards=[
        port_forward(5432, 5432, name="postgres"),
    ],
    labels=["infra"],
)
