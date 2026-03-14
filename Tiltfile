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
        "packages/design-tokens/",
        "packages/pod-server/package.json",
        "scaffolds/",
    ],
    ignore=IGNORE_PATTERNS,
    live_update=[
        fall_back_on(["packages/app/package.json", "bun.lock"]),
        sync("packages/app/", "/app/packages/app/"),
        sync("scaffolds/", "/app/scaffolds/"),
    ],
)

# Pod server (Hono API server) — Dockerfile.dev.
#
# Project pods are created dynamically at runtime, not in static K8s manifests.
# A dummy Job (tilt-pod-server-anchor) anchors the image so Tilt builds it.
# match_in_env_vars lets Tilt inject the content-hash tag into the deployment's
# NUXT_POD_SERVER_IMAGE env var, so dynamically created project pods pull the
# correct image. This causes a main app rollout on pod-server rebuilds, which
# is needed for the app to pick up the new image reference.
docker_build(
    POD_SERVER_IMAGE,
    context=".",
    dockerfile="packages/pod-server/Dockerfile.dev",
    only=[
        "package.json",
        "bun.lock",
        "packages/pod-server/",
        "packages/app/package.json",
        "packages/design-tokens/package.json",
    ],
    ignore=IGNORE_PATTERNS,
    match_in_env_vars=True,
)

# ---------------------------------------------------------------------------
# Helm deployment
# ---------------------------------------------------------------------------

# Anchor Job that references the pod-server image so Tilt builds it.
k8s_yaml("deploy/tilt-pod-server-anchor.yaml")

SCAFFOLD_VERSION = str(local("git rev-parse HEAD", quiet=True)).strip()

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
            "scaffold.version=" + SCAFFOLD_VERSION,
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
