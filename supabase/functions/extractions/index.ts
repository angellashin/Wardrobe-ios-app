import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import {
  ApiErrorResponse,
  ConfirmTagsRequest,
  ExtractionCreateRequest,
  ExtractionResponse,
  ExtractionRetryRequest,
  TargetKind,
} from "./contracts.ts";
import {
  buildMockConfirmTagsResponse,
  buildMockExtractionResponse,
} from "./mock.ts";

const ORIGINALS_BUCKET = "originals-private";
const CUTOUTS_BUCKET = "cutouts-private";
const PREVIEWS_BUCKET = "previews-private";
const SIGNED_URL_TTL_SECONDS = 3600;
const DEV_AUTH_BYPASS_EMAIL = "dev-local@wardrobe.local";
const DEV_AUTH_BYPASS_PASSWORD = "dev-local-password";
const FALLBACK_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z4x8AAAAASUVORK5CYII=";

type AuthorizedContext = {
  supabaseAdmin: ReturnType<typeof createClient>;
  userId: string;
  isDevBypass: boolean;
};

type ItemLookup = {
  tableName: "closet_items" | "purchase_candidate_items";
  targetKind: TargetKind;
  row: {
    id: string;
    original_image_path: string;
  };
};

type ClosetItemListRow = {
  id: string;
  status: string;
  preview_image_path: string | null;
  cutout_image_path: string | null;
  original_image_path: string;
  created_at: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}

function apiError(
  req: Request,
  status: number,
  code: string,
  message: string,
): Response {
  const body: ApiErrorResponse = {
    error: {
      code,
      message,
      request_id: getRequestId(req),
    },
  };
  return json(body, status);
}

async function withResponseTimeout(
  req: Request,
  label: string,
  task: () => Promise<Response>,
  timeoutMs = 25000,
): Promise<Response> {
  return await Promise.race([
    task(),
    new Promise<Response>((resolve) => {
      setTimeout(() => {
        resolve(apiError(req, 504, "timeout", `Timed out during ${label}`));
      }, timeoutMs);
    }),
  ]);
}

function normalizeFunctionRoute(pathname: string): string[] {
  const segments = pathname.split("/").filter(Boolean);
  const functionIndex = segments.indexOf("extractions");
  const route = functionIndex >= 0 ? segments.slice(functionIndex + 1) : segments;
  if (route[0] === "extractions") {
    return route.slice(1);
  }
  return route;
}

function isNumberInUnitRange(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function parseCreateBody(body: unknown): ExtractionCreateRequest | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const candidate = body as Record<string, unknown>;
  const targetKind = candidate.target_kind;
  const tapX = candidate.tap_x;
  const tapY = candidate.tap_y;
  if (targetKind !== "closet" && targetKind !== "candidate") {
    return null;
  }
  if (!isNumberInUnitRange(tapX) || !isNumberInUnitRange(tapY)) {
    return null;
  }

  return {
    target_kind: targetKind,
    tap_x: tapX,
    tap_y: tapY,
    image_base64: typeof candidate.image_base64 === "string" ? candidate.image_base64 : undefined,
    image_mime_type: typeof candidate.image_mime_type === "string"
      ? candidate.image_mime_type
      : undefined,
    image_file_name: typeof candidate.image_file_name === "string"
      ? candidate.image_file_name
      : undefined,
    image_path_hint: typeof candidate.image_path_hint === "string"
      ? candidate.image_path_hint
      : undefined,
    client_request_id: typeof candidate.client_request_id === "string"
      ? candidate.client_request_id
      : undefined,
  };
}

function parseRetryBody(body: unknown): ExtractionRetryRequest | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const candidate = body as Record<string, unknown>;
  if (!isNumberInUnitRange(candidate.tap_x) || !isNumberInUnitRange(candidate.tap_y)) {
    return null;
  }
  return {
    tap_x: candidate.tap_x,
    tap_y: candidate.tap_y,
  };
}

function parseConfirmBody(body: unknown): ConfirmTagsRequest | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const candidate = body as Record<string, unknown>;
  const category = candidate.category;
  const itemType = candidate.item_type;
  const seasonTags = candidate.season_tags;
  const warmth = candidate.warmth_level;
  const primaryColor = candidate.primary_color;

  const validCategory = category === "top" || category === "bottom" || category === "outer" ||
    category === "shoes" || category === "bag";
  if (!validCategory || typeof itemType !== "string" || !Array.isArray(seasonTags)) {
    return null;
  }
  if (!seasonTags.every((tag) => typeof tag === "string")) {
    return null;
  }
  if (
    warmth !== undefined &&
    warmth !== null &&
    (typeof warmth !== "number" || !Number.isInteger(warmth) || warmth < 1 || warmth > 5)
  ) {
    return null;
  }
  if (primaryColor !== undefined && primaryColor !== null && typeof primaryColor !== "string") {
    return null;
  }

  return {
    category,
    item_type: itemType,
    season_tags: seasonTags,
    warmth_level: warmth as number | null | undefined,
    primary_color: (primaryColor as string | null | undefined) ?? null,
  };
}

function getFileExtension(mimeType?: string): string {
  if (!mimeType) {
    return "jpg";
  }
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }
  return "jpg";
}

function decodeBase64Image(input?: string): Uint8Array {
  const raw = input ?? FALLBACK_IMAGE_BASE64;
  const clean = raw.includes(",") ? raw.split(",").at(-1) ?? raw : raw;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let idx = 0; idx < binary.length; idx += 1) {
    bytes[idx] = binary.charCodeAt(idx);
  }
  return bytes;
}

async function uploadBytes(
  supabaseAdmin: ReturnType<typeof createClient>,
  bucket: string,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, bytes, {
    upsert: true,
    contentType,
  });
  if (error) {
    throw new Error(`storage_upload_failed:${bucket}:${path}:${error.message}`);
  }
}

async function ensureBucketExists(
  supabaseAdmin: ReturnType<typeof createClient>,
  bucket: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin.storage.getBucket(bucket);
  if (data && !error) {
    return;
  }
  if (error && !error.message.toLowerCase().includes("not found")) {
    throw new Error(`storage_bucket_check_failed:${bucket}:${error.message}`);
  }
  const { error: createError } = await supabaseAdmin.storage.createBucket(bucket, {
    public: false,
  });
  if (createError && !createError.message.toLowerCase().includes("already")) {
    throw new Error(`storage_bucket_create_failed:${bucket}:${createError.message}`);
  }
}

async function ensureStorageBuckets(
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<void> {
  await ensureBucketExists(supabaseAdmin, ORIGINALS_BUCKET);
  await ensureBucketExists(supabaseAdmin, CUTOUTS_BUCKET);
  await ensureBucketExists(supabaseAdmin, PREVIEWS_BUCKET);
}

async function createSignedUrl(
  supabaseAdmin: ReturnType<typeof createClient>,
  bucket: string,
  path: string,
): Promise<string | undefined> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(
    path,
    SIGNED_URL_TTL_SECONDS,
  );
  if (error) {
    return undefined;
  }
  return data?.signedUrl;
}

function normalizeSignedUrl(
  rawUrl: string | undefined,
  origin: ResolvedOrigin,
): string | undefined {
  if (!rawUrl || rawUrl.trim().isEmpty) {
    return rawUrl;
  }

  const base = `${origin.proto}://${origin.host}${origin.port ? `:${origin.port}` : ""}`;

  // Some local runtimes return relative signed URLs.
  if (rawUrl.startsWith("/")) {
    return `${base}${rawUrl}`;
  }

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const runtimeInternal = host.startsWith("supabase_edge_runtime_") || host.startsWith("supabase-edge-runtime-");
    const nonRoutable =
      host === "0.0.0.0" ||
      host === "::" ||
      host === "host.docker.internal" ||
      host === "kong";

    if (runtimeInternal || nonRoutable) {
      parsed.protocol = `${origin.proto}:`;
      parsed.hostname = origin.host;
      parsed.port = origin.port;
      return parsed.toString();
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`missing_env:${name}`);
  }
  return value;
}

type DevBypassDecision = {
  enabled: boolean;
  reason: "env" | "local-forwarded" | "local-host" | "disabled";
  origin: ResolvedOrigin;
};

type ResolvedOrigin = {
  host: string;
  port: string;
  proto: string;
  runtimeHost: string;
};

function firstHeaderValue(value: string | null): string {
  if (!value) {
    return "";
  }
  return value.split(",")[0]?.trim() ?? "";
}

function parseHost(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  if (normalized.startsWith("[")) {
    const endIndex = normalized.indexOf("]");
    if (endIndex > 0) {
      return normalized.slice(1, endIndex);
    }
  }
  const colonCount = normalized.split(":").length - 1;
  if (colonCount === 1) {
    return normalized.split(":")[0] ?? normalized;
  }
  return normalized;
}

function parsePort(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  if (normalized.startsWith("[")) {
    const endIndex = normalized.indexOf("]");
    if (endIndex > 0 && normalized.length > endIndex + 2 && normalized[endIndex + 1] === ":") {
      return normalized.slice(endIndex + 2);
    }
    return "";
  }
  const parts = normalized.split(":");
  if (parts.length === 2) {
    return parts[1] ?? "";
  }
  return "";
}

function resolveRequestOrigin(req: Request): ResolvedOrigin {
  const requestURL = new URL(req.url);
  const forwardedHostRaw = firstHeaderValue(req.headers.get("x-forwarded-host"));
  const runtimeHostRaw = firstHeaderValue(req.headers.get("host"));
  const forwardedPortRaw = firstHeaderValue(req.headers.get("x-forwarded-port"));
  const forwardedProtoRaw = firstHeaderValue(req.headers.get("x-forwarded-proto"));

  const host = parseHost(forwardedHostRaw) || parseHost(runtimeHostRaw) || requestURL.hostname.toLowerCase();
  const port = forwardedPortRaw || parsePort(runtimeHostRaw) || requestURL.port ||
    (requestURL.protocol === "https:" ? "443" : "80");
  const proto = (forwardedProtoRaw || requestURL.protocol.replace(":", "") || "http").toLowerCase();
  const runtimeHost = parseHost(runtimeHostRaw) || requestURL.hostname.toLowerCase();

  return {
    host,
    port,
    proto,
    runtimeHost,
  };
}

function isPrivateLanIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return false;
  }
  const nums = parts.map((part) => Number(part));
  if (nums.some((num) => Number.isNaN(num) || num < 0 || num > 255)) {
    return false;
  }
  if (nums[0] === 10) {
    return true;
  }
  if (nums[0] === 192 && nums[1] === 168) {
    return true;
  }
  if (nums[0] === 172 && nums[1] >= 16 && nums[1] <= 31) {
    return true;
  }
  return false;
}

function isLocalHost(hostname: string): boolean {
  if (!hostname) {
    return false;
  }
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower === "::1" ||
    lower === "host.docker.internal"
  ) {
    return true;
  }
  return isPrivateLanIpv4(lower);
}

function shouldUseDevBypass(req: Request): DevBypassDecision {
  const configured = (Deno.env.get("DEV_AUTH_BYPASS") ?? "").toLowerCase() === "true";
  const origin = resolveRequestOrigin(req);
  if (configured) {
    return { enabled: true, reason: "env", origin };
  }
  const runtimeLooksLocal = origin.runtimeHost.startsWith("supabase_edge_runtime_");
  const forwardedLocalGateway = origin.proto === "http" && origin.port === "54321" &&
    (isLocalHost(origin.host) || runtimeLooksLocal);
  if (forwardedLocalGateway) {
    return { enabled: true, reason: "local-forwarded", origin };
  }
  if (isLocalHost(origin.host)) {
    return { enabled: true, reason: "local-host", origin };
  }
  return { enabled: false, reason: "disabled", origin };
}

let cachedDevUserId: string | null = null;

async function getOrCreateDevUserId(
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<string> {
  if (cachedDevUserId) {
    return cachedDevUserId;
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: Deno.env.get("DEV_AUTH_BYPASS_EMAIL") ?? DEV_AUTH_BYPASS_EMAIL,
    password: Deno.env.get("DEV_AUTH_BYPASS_PASSWORD") ?? DEV_AUTH_BYPASS_PASSWORD,
    email_confirm: true,
  });

  if (created.user?.id) {
    cachedDevUserId = created.user.id;
    return created.user.id;
  }

  if (createError && !createError.message.toLowerCase().includes("already")) {
    throw new Error(`dev_user_create_failed:${createError.message}`);
  }

  const devEmail = Deno.env.get("DEV_AUTH_BYPASS_EMAIL") ?? DEV_AUTH_BYPASS_EMAIL;
  const { data: listed, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    throw new Error(`dev_user_list_failed:${listError.message}`);
  }

  const existing = listed.users.find((user) => user.email === devEmail);
  if (!existing?.id) {
    throw new Error("dev_user_not_found");
  }

  cachedDevUserId = existing.id;
  return existing.id;
}

async function getAuthorizedContext(
  req: Request,
  bypass: DevBypassDecision,
): Promise<AuthorizedContext> {
  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  if (bypass.enabled) {
    const devUserId = await getOrCreateDevUserId(supabaseAdmin);
    return {
      supabaseAdmin,
      userId: devUserId,
      isDevBypass: true,
    };
  }

  const authorizationHeader = req.headers.get("authorization");
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new Error("unauthorized:missing_bearer");
  }

  const jwt = authorizationHeader.replace("Bearer ", "").trim();
  const { data, error } = await supabaseAdmin.auth.getUser(jwt);
  if (error || !data.user?.id) {
    throw new Error("unauthorized:invalid_token");
  }

  return {
    supabaseAdmin,
    userId: data.user.id,
    isDevBypass: false,
  };
}

async function resolveItemForUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  itemId: string,
): Promise<ItemLookup | null> {
  const closetResult = await supabaseAdmin
    .from("closet_items")
    .select("id,original_image_path")
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle();

  if (closetResult.data) {
    return {
      tableName: "closet_items",
      targetKind: "closet",
      row: closetResult.data,
    };
  }

  const candidateResult = await supabaseAdmin
    .from("purchase_candidate_items")
    .select("id,original_image_path")
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle();

  if (candidateResult.data) {
    return {
      tableName: "purchase_candidate_items",
      targetKind: "candidate",
      row: candidateResult.data,
    };
  }

  return null;
}

async function handleCreateExtraction(
  req: Request,
  bypass: DevBypassDecision,
): Promise<Response> {
  console.log("create_extraction: start");
  const parsed = parseCreateBody(await req.json().catch(() => null));
  if (!parsed) {
    console.log("create_extraction: invalid payload");
    return apiError(req, 400, "invalid_create_request", "Invalid extraction create payload.");
  }

  let context: AuthorizedContext;
  try {
    context = await getAuthorizedContext(req, bypass);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unauthorized";
    console.log("create_extraction: auth failed", message);
    return apiError(req, 401, "unauthorized", message);
  }

  const itemId = crypto.randomUUID();
  const extractionId = parsed.client_request_id ?? crypto.randomUUID();
  const supabaseAdmin = context.supabaseAdmin;
  const originalExtension = getFileExtension(parsed.image_mime_type);
  const originalPath = `${context.userId}/${parsed.target_kind}/${itemId}/v1/original.${originalExtension}`;
  const cutoutPath = `${context.userId}/${parsed.target_kind}/${itemId}/v1/cutout.png`;
  const previewPath = `${context.userId}/${parsed.target_kind}/${itemId}/v1/preview.png`;

  const originalBytes = decodeBase64Image(parsed.image_base64);
  const pngBytes = decodeBase64Image(FALLBACK_IMAGE_BASE64);
  const mockResponse = buildMockExtractionResponse(parsed, extractionId, itemId, "initial");

  console.log("create_extraction: before storage upload", {
    itemId,
    targetKind: parsed.target_kind,
    originalPath,
    cutoutPath,
    previewPath,
  });
  try {
    await ensureStorageBuckets(supabaseAdmin);
    await uploadBytes(
      supabaseAdmin,
      ORIGINALS_BUCKET,
      originalPath,
      originalBytes,
      parsed.image_mime_type ?? "image/jpeg",
    );
    await uploadBytes(supabaseAdmin, CUTOUTS_BUCKET, cutoutPath, pngBytes, "image/png");
    await uploadBytes(supabaseAdmin, PREVIEWS_BUCKET, previewPath, originalBytes, parsed.image_mime_type ?? "image/jpeg");
  } catch (error) {
    const message = error instanceof Error ? error.message : "storage_upload_failed";
    console.log("create_extraction: storage upload failed", message);
    return apiError(req, 500, "storage_upload_failed", message);
  }
  console.log("create_extraction: after storage upload");

  const targetTable = parsed.target_kind === "closet" ? "closet_items" : "purchase_candidate_items";
  console.log("create_extraction: before item insert", { targetTable, itemId });
  const { error: insertItemError } = await supabaseAdmin.from(targetTable).insert({
    id: itemId,
    user_id: context.userId,
    status: "draft",
    original_image_path: originalPath,
    cutout_image_path: cutoutPath,
    preview_image_path: previewPath,
    ai_category: mockResponse.suggestions.category,
    ai_item_type: mockResponse.suggestions.item_type,
    ai_season_tags: mockResponse.suggestions.season_tags,
    ai_warmth_level: mockResponse.suggestions.warmth_level,
    ai_primary_color: mockResponse.suggestions.primary_color,
    ai_confidence_category: mockResponse.confidence.category,
    ai_confidence_item_type: mockResponse.confidence.item_type,
    ai_confidence_season: mockResponse.confidence.season,
    ai_confidence_warmth: mockResponse.confidence.warmth,
    ai_confidence_color: mockResponse.confidence.color,
    segmentation_model_version: mockResponse.model_versions.segmentation,
    tagging_model_version: mockResponse.model_versions.tagging,
    last_processed_at: new Date().toISOString(),
  });

  if (insertItemError) {
    console.log("create_extraction: item insert failed", insertItemError.message);
    return apiError(req, 500, "db_insert_failed", insertItemError.message);
  }

  const runPayload: Record<string, unknown> = {
    user_id: context.userId,
    target_kind: parsed.target_kind,
    run_type: "segmentation",
    status: "succeeded",
    tap_x: parsed.tap_x,
    tap_y: parsed.tap_y,
    latency_ms: 0,
    segmentation_model_version: mockResponse.model_versions.segmentation,
    tagging_model_version: mockResponse.model_versions.tagging,
    request_idempotency_key: parsed.client_request_id ?? null,
  };
  if (parsed.target_kind === "closet") {
    runPayload.closet_item_id = itemId;
  } else {
    runPayload.candidate_item_id = itemId;
  }

  const { error: runInsertError } = await supabaseAdmin.from("item_processing_runs").insert(runPayload);
  if (runInsertError) {
    console.log("create_extraction: run insert failed", runInsertError.message);
    return apiError(req, 500, "db_insert_failed", runInsertError.message);
  }

  const originalSignedUrl = await createSignedUrl(supabaseAdmin, ORIGINALS_BUCKET, originalPath);
  const cutoutSignedUrl = await createSignedUrl(supabaseAdmin, CUTOUTS_BUCKET, cutoutPath);
  const previewSignedUrl = await createSignedUrl(supabaseAdmin, PREVIEWS_BUCKET, previewPath);
  const normalizedOriginalSignedUrl = normalizeSignedUrl(originalSignedUrl, bypass.origin);
  const normalizedCutoutSignedUrl = normalizeSignedUrl(cutoutSignedUrl, bypass.origin);
  const normalizedPreviewSignedUrl = normalizeSignedUrl(previewSignedUrl, bypass.origin);

  const response: ExtractionResponse = {
    ...mockResponse,
    extraction_id: extractionId,
    item_id: itemId,
    assets: {
      original_path: originalPath,
      cutout_path: cutoutPath,
      preview_path: previewPath,
      original_signed_url: normalizedOriginalSignedUrl,
      cutout_signed_url: normalizedCutoutSignedUrl,
      preview_signed_url: normalizedPreviewSignedUrl,
    },
  };
  console.log("create_extraction: returning success response", {
    extractionId: response.extraction_id,
    itemId: response.item_id,
  });
  return json(response);
}

async function handleRetryExtraction(
  req: Request,
  itemId: string,
  bypass: DevBypassDecision,
): Promise<Response> {
  console.log("retry_extraction: start", { itemId });
  const parsed = parseRetryBody(await req.json().catch(() => null));
  if (!parsed) {
    console.log("retry_extraction: invalid payload");
    return apiError(req, 400, "invalid_retry_request", "Invalid extraction retry payload.");
  }

  let context: AuthorizedContext;
  try {
    context = await getAuthorizedContext(req, bypass);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unauthorized";
    console.log("retry_extraction: auth failed", message);
    return apiError(req, 401, "unauthorized", message);
  }

  if (context.isDevBypass) {
    console.log("retry_extraction: dev bypass response");
    const mockInput: ExtractionCreateRequest = {
      target_kind: "closet",
      tap_x: parsed.tap_x,
      tap_y: parsed.tap_y,
    };
    return json(buildMockExtractionResponse(mockInput, crypto.randomUUID(), itemId, "retry"));
  }

  const supabaseAdmin = context.supabaseAdmin;
  if (!supabaseAdmin) {
    return apiError(req, 500, "internal_error", "Supabase client unavailable.");
  }

  const lookup = await resolveItemForUser(supabaseAdmin, context.userId, itemId);
  if (!lookup) {
    console.log("retry_extraction: item not found");
    return apiError(req, 404, "item_not_found", "Extraction item not found.");
  }

  const retryVersion = `v${Date.now()}`;
  const cutoutPath = `${context.userId}/${lookup.targetKind}/${itemId}/${retryVersion}/cutout.png`;
  const previewPath = `${context.userId}/${lookup.targetKind}/${itemId}/${retryVersion}/preview.png`;
  const mockInput: ExtractionCreateRequest = {
    target_kind: lookup.targetKind,
    tap_x: parsed.tap_x,
    tap_y: parsed.tap_y,
  };
  const mockResponse = buildMockExtractionResponse(mockInput, crypto.randomUUID(), itemId, "retry");
  const previewBytes = decodeBase64Image(FALLBACK_IMAGE_BASE64);

  console.log("retry_extraction: before storage upload", { cutoutPath, previewPath });
  try {
    await uploadBytes(supabaseAdmin, CUTOUTS_BUCKET, cutoutPath, previewBytes, "image/png");
    await uploadBytes(supabaseAdmin, PREVIEWS_BUCKET, previewPath, previewBytes, "image/png");
  } catch (error) {
    const message = error instanceof Error ? error.message : "storage_upload_failed";
    console.log("retry_extraction: storage upload failed", message);
    return apiError(req, 500, "storage_upload_failed", message);
  }
  console.log("retry_extraction: after storage upload");

  console.log("retry_extraction: before item update", { table: lookup.tableName, itemId });
  const { error: updateError } = await supabaseAdmin.from(lookup.tableName).update({
    cutout_image_path: cutoutPath,
    preview_image_path: previewPath,
    ai_category: mockResponse.suggestions.category,
    ai_item_type: mockResponse.suggestions.item_type,
    ai_season_tags: mockResponse.suggestions.season_tags,
    ai_warmth_level: mockResponse.suggestions.warmth_level,
    ai_primary_color: mockResponse.suggestions.primary_color,
    ai_confidence_category: mockResponse.confidence.category,
    ai_confidence_item_type: mockResponse.confidence.item_type,
    ai_confidence_season: mockResponse.confidence.season,
    ai_confidence_warmth: mockResponse.confidence.warmth,
    ai_confidence_color: mockResponse.confidence.color,
    segmentation_model_version: mockResponse.model_versions.segmentation,
    tagging_model_version: mockResponse.model_versions.tagging,
    last_processed_at: new Date().toISOString(),
  }).eq("id", itemId).eq("user_id", context.userId);

  if (updateError) {
    console.log("retry_extraction: item update failed", updateError.message);
    return apiError(req, 500, "db_update_failed", updateError.message);
  }

  const runPayload: Record<string, unknown> = {
    user_id: context.userId,
    target_kind: lookup.targetKind,
    run_type: "segmentation",
    status: "succeeded",
    tap_x: parsed.tap_x,
    tap_y: parsed.tap_y,
    latency_ms: 0,
    segmentation_model_version: mockResponse.model_versions.segmentation,
    tagging_model_version: mockResponse.model_versions.tagging,
    request_idempotency_key: null,
  };
  if (lookup.targetKind === "closet") {
    runPayload.closet_item_id = itemId;
  } else {
    runPayload.candidate_item_id = itemId;
  }

  const { error: runInsertError } = await supabaseAdmin.from("item_processing_runs").insert(runPayload);
  if (runInsertError) {
    console.log("retry_extraction: run insert failed", runInsertError.message);
    return apiError(req, 500, "db_insert_failed", runInsertError.message);
  }

  const cutoutSignedUrl = await createSignedUrl(supabaseAdmin, CUTOUTS_BUCKET, cutoutPath);
  const previewSignedUrl = await createSignedUrl(supabaseAdmin, PREVIEWS_BUCKET, previewPath);
  const originalSignedUrl = await createSignedUrl(
    supabaseAdmin,
    ORIGINALS_BUCKET,
    lookup.row.original_image_path,
  );
  const normalizedOriginalSignedUrl = normalizeSignedUrl(originalSignedUrl, bypass.origin);
  const normalizedCutoutSignedUrl = normalizeSignedUrl(cutoutSignedUrl, bypass.origin);
  const normalizedPreviewSignedUrl = normalizeSignedUrl(previewSignedUrl, bypass.origin);

  const response: ExtractionResponse = {
    ...mockResponse,
    item_id: itemId,
    assets: {
      original_path: lookup.row.original_image_path,
      cutout_path: cutoutPath,
      preview_path: previewPath,
      original_signed_url: normalizedOriginalSignedUrl,
      cutout_signed_url: normalizedCutoutSignedUrl,
      preview_signed_url: normalizedPreviewSignedUrl,
    },
  };
  console.log("retry_extraction: returning success response", {
    extractionId: response.extraction_id,
    itemId: response.item_id,
  });
  return json(response);
}

async function handleConfirmTags(
  req: Request,
  itemId: string,
  bypass: DevBypassDecision,
): Promise<Response> {
  console.log("confirm_tags: start", { itemId });
  const parsed = parseConfirmBody(await req.json().catch(() => null));
  if (!parsed) {
    console.log("confirm_tags: invalid payload");
    return apiError(req, 400, "invalid_confirm_request", "Invalid confirm tags payload.");
  }

  let context: AuthorizedContext;
  try {
    context = await getAuthorizedContext(req, bypass);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unauthorized";
    console.log("confirm_tags: auth failed", message);
    return apiError(req, 401, "unauthorized", message);
  }

  if (context.isDevBypass) {
    console.log("confirm_tags: dev bypass response");
    return json(buildMockConfirmTagsResponse(itemId, parsed));
  }

  const supabaseAdmin = context.supabaseAdmin;
  if (!supabaseAdmin) {
    return apiError(req, 500, "internal_error", "Supabase client unavailable.");
  }

  const lookup = await resolveItemForUser(supabaseAdmin, context.userId, itemId);
  if (!lookup) {
    console.log("confirm_tags: item not found");
    return apiError(req, 404, "item_not_found", "Item not found.");
  }

  console.log("confirm_tags: before item update", { table: lookup.tableName, itemId });
  const { error } = await supabaseAdmin.from(lookup.tableName).update({
    status: "active",
    category: parsed.category,
    item_type: parsed.item_type.trim(),
    season_tags: parsed.season_tags,
    warmth_level: parsed.warmth_level ?? null,
    primary_color: parsed.primary_color ?? null,
    category_source: "user",
    item_type_source: "user",
    season_source: "user",
    warmth_source: "user",
    color_source: "user",
  }).eq("id", itemId).eq("user_id", context.userId);

  if (error) {
    console.log("confirm_tags: item update failed", error.message);
    return apiError(req, 500, "db_update_failed", error.message);
  }

  console.log("confirm_tags: returning success response", { itemId });
  return json(buildMockConfirmTagsResponse(itemId, parsed));
}

async function handleListClosetItems(
  req: Request,
  bypass: DevBypassDecision,
): Promise<Response> {
  console.log("list_closet_items: start");

  let context: AuthorizedContext;
  try {
    context = await getAuthorizedContext(req, bypass);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unauthorized";
    console.log("list_closet_items: auth failed", message);
    return apiError(req, 401, "unauthorized", message);
  }

  const supabaseAdmin = context.supabaseAdmin;
  const { data, error } = await supabaseAdmin
    .from("closet_items")
    .select("id,status,preview_image_path,cutout_image_path,original_image_path,created_at")
    .eq("user_id", context.userId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.log("list_closet_items: query failed", error.message);
    return apiError(req, 500, "db_query_failed", error.message);
  }

  const items = await Promise.all(
    ((data ?? []) as ClosetItemListRow[]).map(async (row) => {
      const bestPath = row.preview_image_path ?? row.cutout_image_path ?? row.original_image_path;
      const bucket = row.preview_image_path
        ? PREVIEWS_BUCKET
        : row.cutout_image_path
        ? CUTOUTS_BUCKET
        : ORIGINALS_BUCKET;
      const signedUrl = await createSignedUrl(supabaseAdmin, bucket, bestPath);
      const normalizedSignedUrl = normalizeSignedUrl(signedUrl, bypass.origin);

      return {
        id: row.id,
        status: row.status,
        preview_path: bestPath,
        preview_signed_url: normalizedSignedUrl,
        created_at: row.created_at,
      };
    }),
  );

  console.log("list_closet_items: returning", { count: items.length });
  return json({ items });
}

Deno.serve(async (req) => {
  const bypass = shouldUseDevBypass(req);
  console.log("SUPABASE_ENV =", Deno.env.get("SUPABASE_ENV"));
  console.log("DEV_AUTH_BYPASS =", Deno.env.get("DEV_AUTH_BYPASS"));
  console.log("resolved origin =", {
    host: bypass.origin.host,
    port: bypass.origin.port,
    proto: bypass.origin.proto,
  });
  console.log("runtime host header =", bypass.origin.runtimeHost);
  console.log("Running DEV bypass?", bypass.enabled, "reason =", bypass.reason);
  console.log("handler: incoming headers", Object.fromEntries(req.headers.entries()));
  const method = req.method.toUpperCase();
  const route = normalizeFunctionRoute(new URL(req.url).pathname);
  console.log("handler: route resolved", { method, route });

  try {
    if (route.length === 1 && route[0] === "closet-items" && method === "GET") {
      return await withResponseTimeout(req, "list_closet_items", () => handleListClosetItems(req, bypass));
    }

    if ((route.length === 0 || (route.length === 1 && route[0] === "")) && method === "POST") {
      return await withResponseTimeout(req, "create_extraction", () => handleCreateExtraction(req, bypass));
    }

    if (route.length === 2 && route[1] === "retry" && method === "POST") {
      return await withResponseTimeout(
        req,
        "retry_extraction",
        () => handleRetryExtraction(req, route[0], bypass),
      );
    }

    if (route.length === 3 && route[0] === "items" && route[2] === "confirm-tags" && method === "PATCH") {
      return await withResponseTimeout(req, "confirm_tags", () => handleConfirmTags(req, route[1], bypass));
    }

    return apiError(req, 404, "not_found", "Route not found.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "unhandled_error";
    console.log("handler: unhandled exception", message);
    return apiError(req, 500, "unhandled_exception", message);
  }
});
