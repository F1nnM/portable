# Tiltfile for Portable local development
#
# Prerequisites:
#   ./scripts/dev-setup.sh   (creates k3d cluster + registry + ingress-nginx)
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

# Main app (Nuxt)
docker_build(
    APP_IMAGE,
    context=".",
    dockerfile="packages/app/Dockerfile",
    live_update=[
        # Sync app source files into the build stage working directory.
        # For the production Nuxt image, the built output lives at /app/.output.
        # During dev, we sync source changes and trigger a rebuild via restart.
        fall_back_on(["packages/app/package.json"]),
        sync("packages/app/", "/app/packages/app/"),
        run(
            "cd /app && pnpm --filter @portable/app build",
            trigger=["packages/app/server/", "packages/app/app.vue", "packages/app/nuxt.config.ts"],
        ),
    ],
)

# Pod server (Hono + editor SPA)
docker_build(
    POD_SERVER_IMAGE,
    context=".",
    dockerfile="packages/pod-server/Dockerfile",
    live_update=[
        fall_back_on(["packages/pod-server/package.json", "packages/editor/package.json"]),
        sync("packages/pod-server/", "/build/packages/pod-server/"),
        sync("packages/editor/", "/build/packages/editor/"),
        run(
            "cd /build && pnpm --filter @portable/pod-server build && pnpm --filter @portable/editor build",
            trigger=[
                "packages/pod-server/src/",
                "packages/editor/src/",
            ],
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
