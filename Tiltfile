# Tiltfile for Portable local development
#
# Prerequisites:
#   ctlptl apply -f ctlptl-config.yaml   (creates k3d cluster + registry)
#
# Usage:
#   tilt up                  (build, deploy, watch)
#   tilt down                (tear down)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REGISTRY = "k3d-portable-registry.localhost:5000"
APP_IMAGE = REGISTRY + "/portable-app"
POD_SERVER_IMAGE = REGISTRY + "/portable-pod-server"

# ---------------------------------------------------------------------------
# Docker builds
# ---------------------------------------------------------------------------

# Main app (Nuxt) — targets the dev stage for live_update with HMR
docker_build(
    APP_IMAGE,
    context=".",
    dockerfile="packages/app/Dockerfile",
    target="dev",
    live_update=[
        fall_back_on(["packages/app/package.json", "pnpm-lock.yaml"]),
        sync("packages/app/", "/app/packages/app/"),
    ],
)

# Pod server (Hono + editor SPA) — targets the dev stage for live_update with tsx watch
docker_build(
    POD_SERVER_IMAGE,
    context=".",
    dockerfile="packages/pod-server/Dockerfile",
    target="dev",
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

# Main app resource
k8s_resource(
    "portable",
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
