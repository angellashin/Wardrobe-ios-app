import {
  ConfirmTagsRequest,
  ConfirmTagsResponse,
  ExtractionCreateRequest,
  ExtractionResponse,
} from "./contracts.ts";

const MODEL_SEGMENTATION = "seg-v0-mock";
const MODEL_TAGGING = "tag-v0-mock";

export function buildMockExtractionResponse(
  input: ExtractionCreateRequest,
  extractionId: string,
  itemId: string,
  variant: "initial" | "retry",
): ExtractionResponse {
  const basePath = `mock/${input.target_kind}/${itemId}`;
  const suffix = variant === "retry" ? "retry" : "initial";

  return {
    extraction_id: extractionId,
    item_id: itemId,
    status: "succeeded",
    target_kind: input.target_kind,
    assets: {
      original_path: `${basePath}/v1/original.jpg`,
      cutout_path: `${basePath}/v1/cutout-${suffix}.png`,
      preview_path: `${basePath}/v1/preview-${suffix}.png`,
      original_signed_url: undefined,
      cutout_signed_url: undefined,
      preview_signed_url: undefined,
    },
    suggestions: {
      category: "top",
      item_type: "t-shirt",
      season_tags: ["spring", "summer"],
      warmth_level: 2,
      primary_color: "white",
    },
    confidence: {
      category: 0.96,
      item_type: 0.88,
      season: 0.82,
      warmth: 0.79,
      color: 0.91,
    },
    model_versions: {
      segmentation: MODEL_SEGMENTATION,
      tagging: MODEL_TAGGING,
    },
  };
}

export function buildMockConfirmTagsResponse(
  itemId: string,
  body: ConfirmTagsRequest,
): ConfirmTagsResponse {
  return {
    item_id: itemId,
    status: "active",
    confirmed_fields: {
      category: body.category,
      item_type: body.item_type.trim(),
      season_tags: body.season_tags,
      warmth_level: body.warmth_level ?? null,
      primary_color: body.primary_color ?? null,
    },
    sources: {
      category_source: "user",
      item_type_source: "user",
      season_source: "user",
      warmth_source: "user",
      color_source: "user",
    },
  };
}
