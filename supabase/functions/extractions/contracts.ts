export type TargetKind = "closet" | "candidate";
export type Category = "top" | "bottom" | "outer" | "shoes" | "bag";
export type FieldSource = "ai" | "user";

export type ExtractionCreateRequest = {
  target_kind: TargetKind;
  tap_x: number;
  tap_y: number;
  image_path_hint?: string;
  client_request_id?: string;
};

export type ExtractionRetryRequest = {
  tap_x: number;
  tap_y: number;
};

export type ConfirmTagsRequest = {
  category: Category;
  item_type: string;
  season_tags: string[];
  warmth_level?: number | null;
  primary_color?: string | null;
};

export type ExtractionResponse = {
  extraction_id: string;
  status: "succeeded";
  target_kind: TargetKind;
  assets: {
    original_path: string;
    cutout_path: string;
    preview_path: string;
  };
  suggestions: {
    category: Category;
    item_type: string;
    season_tags: string[];
    warmth_level: number | null;
    primary_color: string | null;
  };
  confidence: {
    category: number;
    item_type: number;
    season: number;
    warmth: number;
    color: number;
  };
  model_versions: {
    segmentation: string;
    tagging: string;
  };
};

export type ConfirmTagsResponse = {
  item_id: string;
  status: "active";
  confirmed_fields: {
    category: Category;
    item_type: string;
    season_tags: string[];
    warmth_level: number | null;
    primary_color: string | null;
  };
  sources: {
    category_source: FieldSource;
    item_type_source: FieldSource;
    season_source: FieldSource;
    warmth_source: FieldSource;
    color_source: FieldSource;
  };
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
};
