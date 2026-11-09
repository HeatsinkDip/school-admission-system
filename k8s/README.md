# Production Kubernetes (K8s) Deployment for Onnorokom Projukti School Admission System

This directory contains production-grade Kubernetes manifests and horizontal autoscaling configurations designed to effortlessly handle massive admission traffic spikes (e.g. hundreds or thousands of parents applying for limited seats at the exact same second).

---

## 1. High-Concurrency Burst Architecture (100+ Users for 50 Seats)

### The Challenge
When online admission opens (e.g. 10:00 AM), thousands of parents load the portal and click **"Apply / Reserve Seat"** concurrently. If a class has 50 seats and 100+ requests hit the servers simultaneously:
1. Under traditional naive architectures, race conditions cause phantom reads and overselling (e.g. 52 or 60 seats sold for a 50-seat room).
2. Pods exhaust CPU or memory, causing slow response times and gateway timeouts (504s).

### How This System Guarantees 100% First-Come, First-Served Correctness
Our dual-layer concurrency protection combines **Database Row-Level Locking** with **Kubernetes Horizontal Pod Autoscaling**:

1. **PostgreSQL Row-Level Locking (`SELECT ... FOR UPDATE` / Serializable Transactions):**
   - In `backend/SchoolAdmission.Api/Services/HoldService.cs`, hold requests execute inside a raw SQL transaction acquiring a pessimistic row lock:
     ```sql
     SELECT id, total_seats FROM classes WHERE id = @classId FOR UPDATE;
     ```
   - All 100 concurrent requests line up deterministically at the database level.
   - Exactly the first 50 transactions see `availableSeats > 0`, insert their hold records, and return HTTP `201 Created`.
   - The 51st and subsequent requests immediately see `availableSeats == 0`, rollback, and return HTTP `409 Conflict` with a human-readable notification: *"Class has reached maximum seat capacity."*
   - **Result: Zero overselling, mathematically guaranteed.**

2. **Kubernetes Multi-Replica Scaling & HPA (`k8s/hpa.yaml`):**
   - The backend deployment maintains **3 replicas baseline** and scales up to **15 pods** via Horizontal Pod Autoscaler.
   - Rapid scale-up policy (`100% pod increase or +4 pods every 15s`) ensures the cluster reacts instantaneously to admission opening surges.
   - Npgsql connection pooling (`Minimum Pool Size=10; Maximum Pool Size=100`) ensures high database throughput without connection exhaustion.

---

## 2. Directory Structure

| File | Purpose |
|------|---------|
| `namespace.yaml` | Creates isolated `school-admission` namespace |
| `configmap.yaml` | Configuration (hold duration, ports, URLs, environment) |
| `secret.yaml` | Database connection strings, passwords, and admin credentials |
| `postgres.yaml` | PersistentVolumeClaim (10Gi), StatefulSet, and ClusterIP Service |
| `backend.yaml` | ASP.NET Core 8 Web API Deployment (3+ replicas, health probes) |
| `frontend.yaml` | React 18 / Nginx Deployment (2 replicas, runtime env injection) |
| `hpa.yaml` | Horizontal Pod Autoscaler (scales backend 3 → 15 pods on CPU/RAM load) |
| `ingress.yaml` | Nginx Ingress routing API paths and frontend SPA |
| `kustomization.yaml` | Bundles all resources for single-command deployment |

---

## 3. Quick Deployment

### Option A: One-Command Kustomize Deploy
```bash
# Apply entire stack to your Kubernetes cluster
kubectl apply -k k8s/
```

### Option B: Step-by-Step Manual Deploy
```bash
# 1. Namespace
kubectl apply -f k8s/namespace.yaml

# 2. Config & Secrets
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# 3. Persistent Storage & PostgreSQL
kubectl apply -f k8s/postgres.yaml

# Wait for PostgreSQL to be ready
kubectl rollout status statefulset/postgres -n school-admission

# 4. Backend & Frontend
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml

# 5. Horizontal Pod Autoscaler & Ingress
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml
```

---

## 4. Verification & Status Checks

```bash
# Check all pods, services, and HPA
kubectl get all -n school-admission

# Monitor HPA real-time autoscaling metrics
kubectl get hpa backend-hpa -n school-admission --watch

# View backend logs across all pods
kubectl logs -n school-admission -l app=school-admission-backend --tail=100 -f
```

---

## 5. Simulating Admission Rush Load

You can simulate 100+ concurrent parents competing for 50 seats using tools like `k6`, `hey`, or `wrk`:

```bash
# Example with hey (100 concurrent workers sending 500 requests to seat hold endpoint):
hey -n 500 -c 100 -m POST \
  -H "X-Student-Id: 20152691234567890" \
  http://school.local/classes/c_101/holds
```
Expected result:
- First requests up to seat limit return HTTP `201 Created`.
- Subsequent requests return HTTP `409 Conflict`.
- HPA automatically scales backend pods up to handle CPU load.
- No class ever has more confirmed/held seats than `totalSeats`.

