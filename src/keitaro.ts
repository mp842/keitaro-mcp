// Thin client for the Keitaro Admin API v1.
// Docs: https://admin-api.docs.keitaro.io/

export class KeitaroError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export class KeitaroClient {
  private readonly baseUrl: string;

  constructor(
    url: string,
    private readonly apiKey: string,
  ) {
    this.baseUrl = `${url.replace(/\/+$/, "")}/admin_api/v1`;
  }

  static fromEnv(): KeitaroClient {
    const url = process.env.KEITARO_URL;
    const apiKey = process.env.KEITARO_API_KEY;
    if (!url || !apiKey) {
      throw new KeitaroError(
        "KEITARO_URL and KEITARO_API_KEY environment variables must be set",
      );
    }
    return new KeitaroClient(url, apiKey);
  }

  async request<T = unknown>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Api-Key": this.apiKey,
        Accept: "application/json",
        ...(body !== undefined && { "Content-Type": "application/json" }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60_000),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new KeitaroError(
        `Keitaro API ${method} ${path} failed with ${res.status}: ${text.slice(0, 500)}`,
        res.status,
      );
    }
    return (text ? JSON.parse(text) : null) as T;
  }

  listCampaigns() {
    return this.request<Campaign[]>("GET", "/campaigns");
  }

  getCampaign(id: number) {
    return this.request<Campaign>("GET", `/campaigns/${id}`);
  }

  listStreams(campaignId: number) {
    return this.request<unknown[]>("GET", `/campaigns/${campaignId}/streams`);
  }

  listOffers() {
    return this.request<unknown[]>("GET", "/offers");
  }

  listTrafficSources() {
    return this.request<unknown[]>("GET", "/traffic_sources");
  }

  listAffiliateNetworks() {
    return this.request<unknown[]>("GET", "/affiliate_networks");
  }

  buildReport(params: ReportParams) {
    return this.request<ReportResult>("POST", "/report/build", params);
  }
}

export interface Campaign {
  id: number;
  alias: string;
  name: string;
  state: string;
  type: string;
  group_id: number | null;
  traffic_source_id: number | null;
  [key: string]: unknown;
}

export interface ReportFilter {
  name: string;
  operator: string;
  expression: unknown;
}

export interface ReportParams {
  range: {
    interval?: string;
    from?: string;
    to?: string;
    timezone?: string;
  };
  metrics: string[];
  grouping: string[];
  filters?: ReportFilter[];
  sort?: { name: string; order: "ASC" | "DESC" }[];
  limit?: number;
  offset?: number;
}

export interface ReportResult {
  rows: Record<string, unknown>[];
  total: number;
  summary?: Record<string, unknown>;
  meta?: unknown;
}
