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

# Pod server (Hono + editor SPA) — Dockerfile.dev.
#
# Project pods are created dynamically at runtime (not by Tilt), so there is
# no static K8s manifest that references this image directly. match_in_env_vars
# tells Tilt to treat env vars containing this image name as image references:
# it will build the image, push it, and rewrite the NUXT_POD_SERVER_IMAGE env
# var in the main app Deployment to the actual pushed image reference. Project
# pods created at runtime inherit the correct image from that env var.
docker_build(
    POD_SERVER_IMAGE,
    context=".",
    dockerfile="packages/pod-server/Dockerfile.dev",
    match_in_env_vars=True,
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
