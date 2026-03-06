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
# Project pods are created dynamically at runtime (not by Tilt), so there is
# no static K8s manifest that references this image directly. The Helm set[]
# above injects the image ref into NUXT_POD_SERVER_IMAGE statically, so we
# do NOT use match_in_env_vars (which would cause Tilt to re-apply the app
# Deployment on every pod-server rebuild, triggering a rollout). New project
# pods pick up the latest image via imagePullPolicy: Always on the :dev tag.
custom_build(
    POD_SERVER_IMAGE,
    "docker build -t $EXPECTED_REF -f packages/pod-server/Dockerfile.dev .",
    deps=[
        "package.json",
        "bun.lock",
        "packages/pod-server/",
        "packages/editor/",
        "packages/app/package.json",
    ],
    ignore=IGNORE_PATTERNS,
    tag="dev",
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
