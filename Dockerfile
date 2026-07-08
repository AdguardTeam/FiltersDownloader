FROM adguard/node-ssh:22.22--0 AS base
WORKDIR /workdir
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

# Install dependencies (--ignore-scripts skips husky install which requires .git)
FROM base AS deps
RUN --mount=type=cache,target=/pnpm-store,id=filters-downloader-pnpm \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=pnpm-lock.yaml,target=pnpm-lock.yaml \
    pnpm install --frozen-lockfile --store-dir /pnpm-store --ignore-scripts

FROM base AS source-deps
COPY --from=deps /workdir/node_modules ./node_modules
COPY . .

# =============================================================================
# Test plan
# =============================================================================

FROM source-deps AS test
RUN pnpm build && pnpm lint && pnpm test && \
    mkdir -p /out && touch /out/test-passed.txt

FROM scratch AS test-output
COPY --from=test /out/ /

# =============================================================================
# Build plan
# =============================================================================

FROM source-deps AS build
RUN pnpm build && pnpm pack --out filters-downloader.tgz && \
    mkdir -p /out/artifacts && \
    cp filters-downloader.tgz /out/artifacts/

FROM scratch AS build-output
COPY --from=build /out/artifacts/ /
