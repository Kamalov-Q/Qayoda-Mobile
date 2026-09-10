import { api } from "@/src/lib/api-client";

export type OfferPurpose = "SALE" | "RENT_MONTHLY" | "RENT_DAILY";

/** Amenity keys — mirror of the server catalog; labels live in i18n. */
export const LISTING_PROPERTY_KEYS = [
  "REPAIRED",
  "FURNISHED",
  "AC",
  "HEATING",
  "PARKING",
  "GARAGE",
  "BALCONY",
  "ELEVATOR",
  "INTERNET",
  "SECURITY",
  "POOL",
  "GARDEN",
] as const;
export type ListingPropertyKey = (typeof LISTING_PROPERTY_KEYS)[number];

export type PropertyCategory =
  | "APARTMENT"
  | "NON_RESIDENTIAL"
  | "HOUSE"
  | "LAND"
  | "BUILDING"
  | "DACHA"
  | "HOTEL";

export interface Offer {
  id: string;
  purpose: OfferPurpose;
  price: string;
  currency: string;
  isActive: boolean;
}

export interface ListingImage {
  id: string;
  url: string;
  thumbUrl: string;
  width: number | null;
  height: number | null;
  position: number;
  isPrimary: boolean;
}

export interface Listing {
  id: string;
  ownerId: string;
  category: PropertyCategory;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  title: string | null;
  descriptionHtml: string | null;
  descriptionText: string | null;
  rooms: number | null;
  areaM2: string | null;
  floor: number | null;
  totalFloors: number | null;
  address: string | null;
  /** Amenity keys; render via `props.*` i18n labels. */
  properties: string[] | null;
  contactPhone: string | null;
  offers: Offer[];
  images: ListingImage[];
  /** The drawn boundary, GeoJSON — rings of [lng, lat]. */
  geom: { type: "Polygon"; coordinates: [number, number][][] } | null;
  centroid: { type: "Point"; coordinates: [number, number] } | null;
  createdAt: string;
  publishedAt: string | null;
}

export interface MapPointFeature {
  listingId: string;
  centroid: { type: "Point"; coordinates: [number, number] };
  price: string;
  currency: string;
  thumbUrl: string;
}

export interface MapPolygonFeature {
  id: string;
  /** Null for PIN listings — only the price bubble is drawn then. */
  geom: { type: "Polygon"; coordinates: [number, number][][] } | null;
  centroid: { type: "Point"; coordinates: [number, number] } | null;
  title: string | null;
  rooms: number | null;
  areaM2: string | null;
  price: string;
  currency: string;
  thumbUrl: string | null;
}

export type ViewportResponse =
  | {
      mode: "points";
      features: MapPointFeature[];
    }
  | {
      mode: "polygons";
      features: MapPolygonFeature[];
    };

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface ImageInput {
  url: string;
  thumbUrl: string;
  width?: number;
  height?: number;
  position: number;
  isPrimary: boolean;
}

export interface CreateListingInput {
  category: PropertyCategory;
  title?: string;
  descriptionHtml?: string;
  rooms?: number;
  floor?: number;
  totalFloors?: number;
  address?: string;
  properties?: string[];
  contactPhone?: string;
  /** Drawn boundary. Exactly one of `coordinates` or `point` must be sent. */
  coordinates?: [number, number][][];
  /** Dropped pin, [lng, lat]. */
  point?: [number, number];
  /** PIN listings only — polygon listings derive it from the boundary. */
  areaM2?: number;
  offers: {
    purpose: OfferPurpose;
    price: number;
    currency: string;
  }[];
  images: ImageInput[];
}

/** Optional server-side narrowing of the viewport query. */
export interface ViewportFilters {
  /** Case-insensitive substring match on the listing address. */
  address?: string;
  category?: PropertyCategory;
  /** USD bounds; either side may be open. */
  priceMin?: number;
  priceMax?: number;
}

export interface FeedFilters {
  purpose: OfferPurpose;
  category?: PropertyCategory;
  priceMin?: number;
  priceMax?: number;
  /** Searches title and address. */
  q?: string;
  sort?: "newest" | "priceAsc" | "priceDesc";
}

export const listingApi = {
  /** The browsable feed — ALL active listings, not just the map viewport. */
  getFeed: (filters: FeedFilters, limit = 20, offset = 0) => {
    const params = new URLSearchParams({
      purpose: filters.purpose,
      limit: String(limit),
      offset: String(offset),
    });
    if (filters.category) params.set("category", filters.category);
    if (filters.priceMin != null) params.set("priceMin", String(filters.priceMin));
    if (filters.priceMax != null) params.set("priceMax", String(filters.priceMax));
    if (filters.q?.trim()) params.set("q", filters.q.trim());
    if (filters.sort) params.set("sort", filters.sort);
    return api<Listing[]>(`/listings?${params}`, { auth: false });
  },

  getViewport: (
    bbox: BBox,
    zoom: number,
    purpose: OfferPurpose,
    filters: ViewportFilters = {},
  ) => {
    const params = new URLSearchParams({
      west: String(bbox.west),
      east: String(bbox.east),
      south: String(bbox.south),
      north: String(bbox.north),
      zoom: String(zoom),
      purpose,
    });
    if (filters.address?.trim()) params.set("address", filters.address.trim());
    if (filters.category) params.set("category", filters.category);
    if (filters.priceMin != null) params.set("priceMin", String(filters.priceMin));
    if (filters.priceMax != null) params.set("priceMax", String(filters.priceMax));
    return api<ViewportResponse>(`/listings/map?${params}`, { auth: false });
  },

  getById: (id: string) => api<Listing>(`/listings/${id}`, { auth: false }),

  /** Same category, nearest first — the detail page's "more like this". */
  getSimilar: (id: string, limit = 6) =>
    api<Listing[]>(`/listings/${id}/similar?limit=${limit}`, { auth: false }),

  /** CBU's daily USD/UZS rate, cached server-side. Public. */
  getRates: () =>
    api<{ usdToUzs: number; updatedAt: string | null }>("/rates", {
      auth: false,
    }),

  /** Newest ACTIVE listings, for the Home strip. Public. */
  getLatest: (limit = 10) =>
    api<Listing[]>(`/listings/latest?limit=${limit}`, { auth: false }),

  getMine: () => api<Listing[]>(`/listings/mine`),

  create: (input: CreateListingInput) =>
    api<Listing>(`/listings`, {
      method: "POST",
      body: input,
    }),

  updateImages: (id: string, images: ImageInput[]) =>
    api<Listing>(`/listings/${id}/images`, { method: "PUT", body: { images } }),

  archive: (id: string) =>
    api<{ success: boolean }>(`/listings/${id}`, { method: "DELETE" }),

  /** Undoes an archive. Returns the listing, now ACTIVE and back on the map. */
  restore: (id: string) =>
    api<Listing>(`/listings/${id}/restore`, { method: "PATCH" }),

  getSaved: () => api<Listing[]>(`/listings/saved`),

  /** Both idempotent server-side, so a repeated tap can't error. */
  save: (id: string) =>
    api<{ saved: boolean }>(`/listings/${id}/save`, { method: "PUT" }),

  unsave: (id: string) =>
    api<{ saved: boolean }>(`/listings/${id}/save`, { method: "DELETE" }),
};
