import { api } from "@/src/lib/api-client";

export type OfferPurpose = "SALE" | "RENT_MONTHLY" | "RENT_DAILY";

export type PropertyCategory =
  | "APARTMENT"
  | "NON_RESIDENTIAL"
  | "HOUSE"
  | "LAND"
  | "BUILDING"
  | "DACHA";

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
  contactPhone: string | null;
  offers: Offer[];
  images: ListingImage[];
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
  geom: { type: "Polygon"; coordinates: [number, number][][] };
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
  areaM2?: number;
  floor?: number;
  totalFloors?: number;
  address?: string;
  contactPhone?: string;
  coordinates?: [number, number][][];
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
}

export const listingApi = {
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
    return api<ViewportResponse>(`/listings/map?${params}`, { auth: false });
  },

  getById: (id: string) => api<Listing>(`/listings/${id}`, { auth: false }),

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
};
