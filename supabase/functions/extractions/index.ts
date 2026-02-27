import {
  ApiErrorResponse,
  ConfirmTagsRequest,
  ExtractionCreateRequest,
  ExtractionRetryRequest,
} from "./contracts.ts";
import {
  buildMockConfirmTagsResponse,
  buildMockExtractionResponse,
} from "./mock.ts";

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

Deno.serve(async (req) => {
  const method = req.method.toUpperCase();
  const route = normalizeFunctionRoute(new URL(req.url).pathname);

  if ((route.length === 0 || (route.length === 1 && route[0] === "")) && method === "POST") {
    const parsed = parseCreateBody(await req.json().catch(() => null));
    if (!parsed) {
      return apiError(req, 400, "invalid_create_request", "Invalid extraction create payload.");
    }
    const extractionId = parsed.client_request_id
      ? `ext_${parsed.client_request_id}`
      : "ext_mock_001";
    return json(buildMockExtractionResponse(parsed, extractionId, "initial"));
  }

  if (route.length === 2 && route[1] === "retry" && method === "POST") {
    const extractionId = route[0];
    const parsed = parseRetryBody(await req.json().catch(() => null));
    if (!parsed) {
      return apiError(req, 400, "invalid_retry_request", "Invalid extraction retry payload.");
    }
    const mockInput: ExtractionCreateRequest = {
      target_kind: "closet",
      tap_x: parsed.tap_x,
      tap_y: parsed.tap_y,
    };
    return json(buildMockExtractionResponse(mockInput, extractionId, "retry"));
  }

  if (route.length === 3 && route[0] === "items" && route[2] === "confirm-tags" && method === "PATCH") {
    const itemId = route[1];
    const parsed = parseConfirmBody(await req.json().catch(() => null));
    if (!parsed) {
      return apiError(req, 400, "invalid_confirm_request", "Invalid confirm tags payload.");
    }
    return json(buildMockConfirmTagsResponse(itemId, parsed));
  }

  return apiError(req, 404, "not_found", "Route not found.");
});
