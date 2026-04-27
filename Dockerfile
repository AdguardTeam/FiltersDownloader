FROM adguard/node-ssh:22.17--0 AS base
WORKDIR /workdir
ENV npm_config_store_dir=/pnpm-store

# Install dependencies (--ignore-scripts skips husky install which requires .git)
FROM base AS deps
RUN --mount=type=cache,target=/pnpm-store,id=filters-downloader-pnpm \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=pnpm-lock.yaml,target=pnpm-lock.yaml \
    pnpm install --frozen-lockfile --ignore-scripts

FROM base AS source-deps
COPY --from=deps /workdir/node_modules ./node_modules
COPY . .

# =============================================================================
# Test plan
# =============================================================================

FROM source-deps AS test
RUN pnpm build && pnpm lint && pnpm test

FROM scratch AS test-output
COPY --from=test /workdir/build ./build

# =============================================================================
# Build plan
# =============================================================================

FROM source-deps AS build
RUN pnpm build && pnpm pack --out filters-downloader.tgz

FROM scratch AS build-output
COPY --from=build /workdir/filters-downloader.tgz /artifacts/filters-downloader.tgz
COPY --from=build /workdir/build/build.txt /artifacts/build.txt
