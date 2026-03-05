# Deployment Guide

## Prerequisites

- **Kubernetes cluster** -- Any K8s cluster (managed cloud, bare metal, etc.)
- **Helm 3** -- For installing the chart
- **Wildcard DNS** -- `*.portable.yourdomain.com` must resolve to the cluster's ingress
- **Ingress controller** -- nginx-ingress or similar, handling the wildcard domain
- **cert-manager** (optional) -- For automatic wildcard TLS certificates via DNS-01 challenge

## Building Container Images

Before deploying, you need to build and push both container images to your registry. Both Dockerfiles use a multi-stage build and require the **repository root** as the Docker build context, since they reference workspace-level files (`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`) and multiple packages.

```bash
# Build the main app image
docker build -t ghcr.io/YOUR_ORG/portable-app:0.1.0 -f packages/app/Dockerfile .

# Build the pod server image (includes the editor SPA)
docker build -t ghcr.io/YOUR_ORG/portable-pod-server:0.1.0 -f packages/pod-server/Dockerfile .

# Push to your registry
docker push ghcr.io/YOUR_ORG/portable-app:0.1.0
docker push ghcr.io/YOUR_ORG/portable-pod-server:0.1.0
```

Then reference your images in Helm values:

```yaml
image:
  repository: ghcr.io/YOUR_ORG/portable-app
  tag: "0.1.0"

podServer:
  image:
    repository: ghcr.io/YOUR_ORG/portable-pod-server
    tag: "0.1.0"
```

If your registry is private, create a Kubernetes pull secret and reference it in your pod specs:

```bash
kubectl create secret docker-registry regcred \
  --namespace portable \
  --docker-server=ghcr.io \
  --docker-username=YOUR_USERNAME \
  --docker-password=YOUR_TOKEN
```

Then add `imagePullSecrets` to any pods that need to pull from the private registry. The main app deployment and each project pod will both need access. For the main app, you can patch the deployment after install or extend the Helm chart. For project pods, the main app creates them programmatically, so you would need to update the pod creation logic in `server/utils/k8s.ts` to include the pull secret.

## Installation

```bash
helm install portable deploy/helm/portable \
  --namespace portable --create-namespace \
  --set domain=portable.yourdomain.com \
  --set github.clientId=YOUR_CLIENT_ID \
  --set github.clientSecret=YOUR_CLIENT_SECRET \
  --set postgres.password=YOUR_SECURE_PASSWORD \
  --set encryptionKey=YOUR_32_BYTE_HEX_KEY
```

Or use a values file:

```bash
helm install portable deploy/helm/portable \
  --namespace portable --create-namespace \
  -f my-values.yaml
```

## Required Values

| Value                 | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `domain`              | Base domain (e.g., `portable.example.com`)               |
| `github.clientId`     | GitHub OAuth App client ID                               |
| `github.clientSecret` | GitHub OAuth App client secret                           |
| `postgres.password`   | Password for the Postgres instance                       |
| `encryptionKey`       | 32-byte hex string for AES-256-GCM credential encryption |

These Helm values are translated into environment variables for the main app container:

| Helm Value            | Environment Variable        | Nuxt Runtime Config Key |
| --------------------- | --------------------------- | ----------------------- |
| `github.clientId`     | `NUXT_GITHUB_CLIENT_ID`     | `githubClientId`        |
| `github.clientSecret` | `NUXT_GITHUB_CLIENT_SECRET` | `githubClientSecret`    |
| `encryptionKey`       | `NUXT_ENCRYPTION_KEY`       | `encryptionKey`         |
| (from postgres)       | `DATABASE_URL`              | (direct env access)     |
| `domain`              | `NUXT_APP_BASE_URL`         | `appBaseUrl`            |

### Generating an encryption key

```bash
openssl rand -hex 32
```

### Creating a GitHub OAuth App

1. Go to GitHub Settings > Developer Settings > OAuth Apps > New OAuth App
2. Set the homepage URL to `https://portable.yourdomain.com`
3. Set the callback URL to `https://portable.yourdomain.com/auth/github/callback`
4. Note the client ID and client secret

## Optional Values

### TLS via cert-manager

```yaml
certManager:
  enabled: true
  issuer: letsencrypt-prod # Name of your ClusterIssuer or Issuer
  issuerKind: ClusterIssuer # ClusterIssuer or Issuer
```

This creates a Certificate resource requesting a wildcard cert for `*.domain` and `domain`. The cert-manager issuer must support DNS-01 challenges for wildcard certificates.

### Main app resources

```yaml
image:
  repository: portable/app # Container image repository
  tag: 0.1.0 # Container image tag
  pullPolicy: IfNotPresent

replicaCount: 1 # Main app replicas

resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 512Mi
```

### Ingress

```yaml
ingress:
  className: nginx # Ingress class name
  annotations: {} # Additional ingress annotations
```

### Postgres

```yaml
postgres:
  password: "" # Required
  storage: 10Gi # PVC size
  image:
    repository: postgres
    tag: 16-alpine
  resources:
    requests:
      cpu: 250m
      memory: 256Mi
    limits:
      cpu: 1000m
      memory: 1Gi
```

### Project pod defaults

These values are stored in a ConfigMap and used by the main app when creating project pods:

```yaml
pod:
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 2000m
      memory: 4Gi
  storage: 5Gi # PVC size per project

podServer:
  image:
    repository: portable/pod-server
    tag: 0.1.0
```

## Deployed Resources

The Helm chart creates the following Kubernetes resources:

| Resource              | Name                     | Purpose                                                    |
| --------------------- | ------------------------ | ---------------------------------------------------------- |
| Deployment            | `portable`               | Main app (Nuxt)                                            |
| Service               | `portable`               | Exposes main app on port 3000                              |
| Ingress               | `portable`               | Wildcard `*.domain` + bare `domain`                        |
| StatefulSet           | `portable-postgres`      | Postgres 16 database                                       |
| Service               | `portable-postgres`      | Exposes Postgres on port 5432                              |
| PersistentVolumeClaim | (managed by StatefulSet) | Postgres data storage                                      |
| ServiceAccount        | `portable`               | Identity for the main app                                  |
| Role                  | `portable`               | RBAC: pods, PVCs, services (create/get/list/watch/delete)  |
| RoleBinding           | `portable`               | Binds Role to ServiceAccount                               |
| Secret                | `portable`               | GitHub OAuth, Postgres password, encryption key            |
| ConfigMap             | `portable-config`        | Pod resource defaults                                      |
| Certificate           | `portable-tls`           | Wildcard + bare domain TLS cert (if `certManager.enabled`) |

## Upgrading

```bash
helm upgrade portable deploy/helm/portable \
  --namespace portable \
  -f my-values.yaml
```

## Uninstalling

```bash
helm uninstall portable --namespace portable
```

Note: PersistentVolumeClaims for Postgres and project pods are not automatically deleted. Remove them manually if you want to delete all data:

```bash
kubectl delete pvc -n portable --all
```
