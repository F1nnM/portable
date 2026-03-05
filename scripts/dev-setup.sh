#!/usr/bin/env bash
# dev-setup.sh - Create k3d cluster with local registry for Portable development
#
# Idempotent: safe to run multiple times. Checks for existing cluster/registry
# before creating new ones.
#
# Usage: ./scripts/dev-setup.sh

set -euo pipefail

CLUSTER_NAME="portable"
REGISTRY_NAME="k3d-portable-registry.localhost"
REGISTRY_PORT="5000"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# --- Prerequisite checks ---

check_command() {
  local cmd="$1"
  local install_hint="${2:-}"
  if ! command -v "$cmd" &>/dev/null; then
    error "'$cmd' is not installed."
    if [[ -n "$install_hint" ]]; then
      echo "       Install: $install_hint"
    fi
    return 1
  fi
}

info "Checking prerequisites..."

MISSING=0
check_command docker   "https://docs.docker.com/get-docker/"             || MISSING=1
check_command kubectl  "mise install kubectl"                             || MISSING=1
check_command helm     "mise install helm"                                || MISSING=1
check_command k3d      "mise install k3d"                                 || MISSING=1
check_command tilt     "mise install tilt"                                || MISSING=1

if [[ "$MISSING" -ne 0 ]]; then
  echo ""
  error "Missing prerequisites. Install them and re-run this script."
  echo "  Tip: run 'mise install' in the repo root to install kubectl, helm, k3d, and tilt."
  exit 1
fi

# Verify Docker is running
if ! docker info &>/dev/null; then
  error "Docker daemon is not running. Start Docker and try again."
  exit 1
fi

info "All prerequisites met."

# --- Registry ---

if k3d registry list 2>/dev/null | grep -q "$REGISTRY_NAME"; then
  info "Registry '$REGISTRY_NAME' already exists, skipping creation."
else
  info "Creating k3d registry '$REGISTRY_NAME:$REGISTRY_PORT'..."
  k3d registry create portable-registry.localhost --port "$REGISTRY_PORT"
fi

# --- Cluster ---

if k3d cluster list 2>/dev/null | grep -q "$CLUSTER_NAME"; then
  info "Cluster '$CLUSTER_NAME' already exists, skipping creation."
else
  info "Creating k3d cluster '$CLUSTER_NAME'..."
  k3d cluster create "$CLUSTER_NAME" \
    --registry-use "$REGISTRY_NAME:$REGISTRY_PORT" \
    --port "80:80@loadbalancer" \
    --port "443:443@loadbalancer" \
    --k3s-arg "--disable=traefik@server:0" \
    --wait
fi

# --- Install ingress-nginx ---

info "Setting up kubectl context..."
kubectl config use-context "k3d-$CLUSTER_NAME"

# Install ingress-nginx if not already present
if kubectl get namespace ingress-nginx &>/dev/null 2>&1; then
  info "ingress-nginx namespace exists, checking deployment..."
  if kubectl get deployment -n ingress-nginx ingress-nginx-controller &>/dev/null 2>&1; then
    info "ingress-nginx already installed, skipping."
  else
    info "Installing ingress-nginx..."
    helm upgrade --install ingress-nginx ingress-nginx \
      --repo https://kubernetes.github.io/ingress-nginx \
      --namespace ingress-nginx --create-namespace \
      --set controller.hostPort.enabled=true \
      --set controller.service.type=ClusterIP \
      --set controller.watchIngressWithoutClass=true \
      --wait --timeout 120s
  fi
else
  info "Installing ingress-nginx..."
  helm upgrade --install ingress-nginx ingress-nginx \
    --repo https://kubernetes.github.io/ingress-nginx \
    --namespace ingress-nginx --create-namespace \
    --set controller.hostPort.enabled=true \
    --set controller.service.type=ClusterIP \
    --set controller.watchIngressWithoutClass=true \
    --wait --timeout 120s
fi

# --- Done ---

echo ""
info "=========================================="
info "  Dev environment ready!"
info "=========================================="
echo ""
echo "  Cluster:   k3d-$CLUSTER_NAME"
echo "  Registry:  $REGISTRY_NAME:$REGISTRY_PORT"
echo "  Context:   k3d-$CLUSTER_NAME"
echo ""
echo "  Next steps:"
echo "    1. Run 'tilt up' to build and deploy"
echo "    2. Open http://portable.127.0.0.1.nip.io"
echo ""
echo "  Useful commands:"
echo "    tilt up              # Start dev environment"
echo "    tilt down            # Tear down dev resources"
echo "    k3d cluster delete $CLUSTER_NAME  # Delete cluster entirely"
echo ""
