# Distributed Rate Limiting: A Technical Design Review

> **Status:** Draft v2.3 · **Owner:** Platform Infrastructure · **Reviewers:** API Gateway, SRE
> Last updated: *March 2026*

This document evaluates three candidate approaches for **distributed rate limiting** across our edge fleet. It is intended as a reference for the architecture review board and assumes familiarity with our existing `gateway-core` service.

---

## 1. Executive Summary

We currently enforce limits **per-node**, which means a client hitting 12 edge nodes receives ~12× its intended quota. This is a correctness bug, not a performance one. The recommendation is to adopt a **sliding-window counter** backed by Redis, with local token buckets as a degradation path.

Three options were considered:

1. Centralized counter in Redis
2. Gossip-based approximate counting
3. ~~Sticky routing by client ID~~ (rejected — see §5.3)

### 1.1 Key Findings

- Option 1 adds **~1.8 ms p50** latency but is exact.
- Option 2 is *eventually* consistent, with observed overshoot of up to 22%.
- Sticky routing conflicts with our zero-downtime deploy strategy.

## 2. Background

### 2.1 Current Behavior

Each node maintains an in-process `LRUCache<clientId, TokenBucket>`. On request:

```javascript
function allow(clientId, cost = 1) {
  const bucket = buckets.get(clientId) ?? new TokenBucket({
    capacity: 100,
    refillPerSecond: 10,
  });

  bucket.refill(Date.now());

  if (bucket.tokens < cost) {
    return { allowed: false, retryAfter: bucket.timeUntil(cost) };
  }

  bucket.tokens -= cost;
  buckets.set(clientId, bucket);
  return { allowed: true, remaining: Math.floor(bucket.tokens) };
}
```

The `retryAfter` value is surfaced via the `Retry-After` header, and remaining quota via `X-RateLimit-Remaining`.

### 2.2 Why This Breaks

Because state is node-local, the *effective* limit scales with fleet size:

$$\text{effective\_limit} = \text{configured\_limit} \times N_{\text{nodes}}$$

During the February incident this meant a single misbehaving client sustained **~4,300 rps** against a configured ceiling of 350 rps.

---

## 3. Comparison of Approaches

| Approach | Accuracy | p50 Latency | p99 Latency | Ops Burden | Fails Open? |
|:---------|:--------:|------------:|------------:|:-----------|:-----------:|
| Centralized Redis | Exact | 1.8 ms | 14 ms | Medium | Configurable |
| Gossip counting | ±22% | 0.1 ms | 0.4 ms | High | Yes |
| Sticky routing | Exact | 0.1 ms | 0.3 ms | Low | No |
| *Current (per-node)* | **Broken** | 0.05 ms | 0.2 ms | None | N/A |

<!-- Note: latency figures measured on c6i.2xlarge, us-east-1, 2026-02-18 -->

### 3.1 Notes on the Table

- Latency is **added** latency, not total request time.
- "Fails open" describes behavior when the coordination layer is unreachable.
- The gossip row assumes a 200 ms broadcast interval; tightening this to 50 ms reduced error to ±9% but tripled intra-AZ traffic.

---

## 4. Recommended Design

### 4.1 Algorithm

We use a **sliding-window counter**, which approximates a true sliding log at a fraction of the memory cost.

For a request at time `t` with window size `W`:

1. Compute the current window key: `floor(t / W)`
2. Compute the previous window key: `floor(t / W) - 1`
3. Weight the previous window by its remaining overlap:
   - `weight = 1 - ((t mod W) / W)`
   - `estimate = current + (previous × weight)`
4. Allow if `estimate < limit`, else reject.

#### 4.1.1 Worked Example

Given `W = 60s`, `limit = 100`, and:

- previous window count = `84`
- current window count = `31`
- elapsed in current window = `18s`

Then:

- `weight = 1 - (18 / 60) = 0.7`
- `estimate = 31 + (84 × 0.7) = 31 + 58.8 = 89.8`
- Since `89.8 < 100`, the request is **allowed**.

### 4.2 Redis Implementation

The whole operation must be atomic, so it runs as a Lua script:

```lua
-- KEYS[1] = current window key
-- KEYS[2] = previous window key
-- ARGV[1] = limit, ARGV[2] = weight, ARGV[3] = ttl

local current  = tonumber(redis.call('GET', KEYS[1]) or "0")
local previous = tonumber(redis.call('GET', KEYS[2]) or "0")
local estimate = current + (previous * tonumber(ARGV[2]))

if estimate >= tonumber(ARGV[1]) then
  return {0, current, previous}
end

redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
return {1, current + 1, previous}
```

Deploy with:

```bash
redis-cli --eval sliding_window.lua \
  "rl:{acme-corp}:9284" "rl:{acme-corp}:9283" , 100 0.7 120
```

> [!NOTE]
> The `{acme-corp}` hash tag is **required** — it guarantees both keys land on the same Redis Cluster slot. Omitting it produces a `CROSSSLOT` error at runtime, not at deploy time.

### 4.3 Configuration Schema

```yaml
rate_limiting:
  enabled: true
  backend: redis
  fail_mode: open          # open | closed
  redis:
    endpoints:
      - rl-001.internal:6379
      - rl-002.internal:6379
    timeout_ms: 5
    max_retries: 1
  tiers:
    free:
      requests_per_minute: 60
      burst: 10
    pro:
      requests_per_minute: 6000
      burst: 500
    enterprise:
      requests_per_minute: null   # unlimited
```

---

## 5. Rejected Alternatives

### 5.1 Gossip-Based Counting

Nodes broadcast local deltas on a fixed interval and sum received deltas locally.

**Pros**

- No external dependency
- Sub-millisecond decisions
- Naturally partition-tolerant

**Cons**

- Overshoot during traffic spikes is unbounded in theory
- Debugging is genuinely unpleasant — there is no single source of truth to query
- Requires a new membership protocol (we currently have none)

### 5.2 Centralized Service

A dedicated `ratelimitd` service with its own storage. Rejected as strictly worse than talking to Redis directly: same network hop, more code to own, additional failure domain.

### 5.3 Sticky Routing

Route all requests for a given client to one node via consistent hashing at the load balancer.

This was rejected for three reasons:

1. **Deploys break it.** Every rolling restart reshuffles ownership, and in-flight counters are lost.
2. **Hot clients become hot nodes.** Our top 20 clients account for 61% of traffic; pinning them creates deterministic hotspots.
3. **It requires L7 LB features** we do not have on the Anycast tier.

---

## 6. Rollout Plan

| Phase | Scope | Duration | Exit Criteria |
|-------|-------|----------|---------------|
| 0 | Shadow mode, log-only | 1 week | < 0.1% decision divergence |
| 1 | 5% of `free` tier | 3 days | No p99 regression > 5 ms |
| 2 | 100% of `free` tier | 1 week | Zero Redis-attributed 5xx |
| 3 | All tiers | 2 weeks | — |

### 6.1 Checklist

- [x] Lua script reviewed by Redis SME
- [x] Dashboards created (`grafana/rate-limiting-v2`)
- [ ] Runbook written
- [ ] Load test at 3× peak
- [ ] Alerting thresholds tuned

### 6.2 Rollback

Rollback is a config flip: set `rate_limiting.backend: local`. No data migration is involved, and no schema changes are required. Expected rollback time is **under 90 seconds** (one config propagation cycle).

---

## 7. Open Questions

1. Should `fail_mode` default to `open` or `closed`?
   - Arguments for `open`: availability is our top-line SLO; a Redis outage should not become an API outage.
   - Arguments for `closed`: rate limiting is partly an abuse-mitigation control, and failing open removes it precisely when the system is stressed.
   - **Current lean:** `open` for read paths, `closed` for write and auth paths.
2. Do we need per-endpoint limits, or is per-client sufficient for v1?
3. How should limits compose with the existing [WAF rules](https://internal.example.com/waf/rules) and the [abuse scoring pipeline](https://internal.example.com/abuse)?

---

## Appendix A — Glossary

**Burst**
: The number of requests permitted above the steady-state rate, consumed from a reserve.

**Sliding window**
: A rate-limiting scheme where the evaluation period moves continuously with time rather than resetting at fixed boundaries.

**Fail open / fail closed**
: Whether a control permits or denies traffic when its enforcement mechanism is unavailable.

## Appendix B — References

- Cloudflare, *How we built rate limiting capable of scaling to millions of domains* — <https://blog.cloudflare.com/counting-things-a-lot-of-different-things/>
- Stripe engineering, "Scaling your API with rate limiters"
- Redis documentation on [Lua scripting](https://redis.io/docs/latest/develop/interact/programmability/eval-intro/) and [cluster hash tags](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/)

---

*Questions, corrections, and strong opinions welcome in `#platform-infra`. This document supersedes the 2025 proposal, which assumed a single-region deployment.*
