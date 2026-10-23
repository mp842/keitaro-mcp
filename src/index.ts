#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { KeitaroClient, type ReportParams } from "./keitaro.js";

const DEFAULT_METRICS = [
  "clicks",
  "campaign_unique_clicks",
  "conversions",
  "leads",
  "sales",
  "revenue",
  "cost",
  "profit",
  "roi",
  "cr",
  "epc",
];

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

let client: KeitaroClient | undefined;
function keitaro(): KeitaroClient {
  client ??= KeitaroClient.fromEnv();
  return client;
}

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function pick<T extends object>(rows: T[], keys: string[]) {
  return rows.map((row) =>
    Object.fromEntries(keys.filter((k) => k in row).map((k) => [k, (row as Record<string, unknown>)[k]])),
  );
}

const server = new McpServer({ name: "keitaro-mcp", version: "0.1.0" });

server.registerTool(
  "list_campaigns",
  {
    title: "List campaigns",
    description:
      "List Keitaro campaigns with id, name, alias, state, type, group and traffic source. " +
      "Use the id with get_campaign or as a filter in build_report.",
    inputSchema: {
      search: z.string().optional().describe("Case-insensitive substring to match in name or alias"),
      state: z.enum(["active", "disabled", "deleted"]).optional().describe("Only campaigns in this state"),
    },
    annotations: READ_ONLY,
  },
  async ({ search, state }) => {
    let campaigns = await keitaro().listCampaigns();
    if (state) campaigns = campaigns.filter((c) => c.state === state);
    if (search) {
      const q = search.toLowerCase();
      campaigns = campaigns.filter(
        (c) => c.name?.toLowerCase().includes(q) || c.alias?.toLowerCase().includes(q),
      );
    }
    return json(
      pick(campaigns, ["id", "name", "alias", "state", "type", "group_id", "traffic_source_id", "cost_type", "cost_value"]),
    );
  },
);

server.registerTool(
  "get_campaign",
  {
    title: "Get campaign",
    description: "Get one Keitaro campaign with all its settings and its streams (flows).",
    inputSchema: {
      id: z.number().int().describe("Campaign id"),
    },
    annotations: READ_ONLY,
  },
  async ({ id }) => {
    const [campaign, streams] = await Promise.all([
      keitaro().getCampaign(id),
      keitaro().listStreams(id),
    ]);
    return json({ campaign, streams });
  },
);

server.registerTool(
  "list_offers",
  {
    title: "List offers",
    description: "List Keitaro offers with id, name, state, affiliate network and payout.",
    inputSchema: {},
    annotations: READ_ONLY,
  },
  async () =>
    json(
      pick(await keitaro().listOffers() as object[], [
        "id", "name", "state", "group_id", "affiliate_network_id", "country", "payout_value", "payout_currency", "payout_type",
      ]),
    ),
);

server.registerTool(
  "list_traffic_sources",
  {
    title: "List traffic sources",
    description: "List Keitaro traffic sources with id and name.",
    inputSchema: {},
    annotations: READ_ONLY,
  },
  async () => json(pick(await keitaro().listTrafficSources() as object[], ["id", "name", "state"])),
);

server.registerTool(
  "list_affiliate_networks",
  {
    title: "List affiliate networks",
    description: "List Keitaro affiliate networks with id and name.",
    inputSchema: {},
    annotations: READ_ONLY,
  },
  async () => json(pick(await keitaro().listAffiliateNetworks() as object[], ["id", "name", "state"])),
);

server.registerTool(
  "build_report",
  {
    title: "Build report",
    description:
      "Build a Keitaro statistics report for a period, grouped by any dimensions. " +
      "Set either `interval` or both `from` and `to`. " +
      "Common grouping values: campaign, campaign_id, offer, offer_id, stream, traffic_source, " +
      "affiliate_network, country, region, city, device_type, os, browser, landing, day, hour, " +
      "sub_id_1 ... sub_id_30. " +
      "Common metrics: clicks, campaign_unique_clicks, conversions, leads, sales, rejected, revenue, " +
      "cost, profit, roi, cr, epc, cpc. Defaults to a standard set of metrics.",
    inputSchema: {
      interval: z
        .enum([
          "today", "yesterday", "7_days_ago", "first_day_of_this_week", "1_month_ago",
          "first_day_of_this_month", "1_year_ago", "first_day_of_this_year", "all_time",
        ])
        .optional()
        .describe("Preset period. Ignored when from/to are set."),
      from: z.string().optional().describe("Start date, YYYY-MM-DD or YYYY-MM-DD HH:MM:SS"),
      to: z.string().optional().describe("End date, YYYY-MM-DD or YYYY-MM-DD HH:MM:SS"),
      timezone: z.string().optional().describe("IANA timezone, e.g. Europe/Kyiv. Defaults to the tracker's timezone."),
      grouping: z.array(z.string()).default(["campaign"]).describe("Dimensions to group by"),
      metrics: z.array(z.string()).optional().describe("Metrics to return"),
      filters: z
        .array(
          z.object({
            name: z.string().describe("Dimension or metric, e.g. campaign_id, country, clicks"),
            operator: z
              .string()
              .describe("e.g. EQUALS, NOT_EQUAL, IN_LIST, NOT_IN_LIST, CONTAINS, GREATER_THAN, LESS_THAN, BETWEEN"),
            expression: z.unknown().describe("Value, or an array for IN_LIST / BETWEEN"),
          }),
        )
        .optional(),
      sort_by: z.string().optional().describe("Metric or dimension to sort by, e.g. profit"),
      sort_order: z.enum(["ASC", "DESC"]).default("DESC"),
      limit: z.number().int().min(1).max(1000).default(100),
      offset: z.number().int().min(0).default(0),
    },
    annotations: READ_ONLY,
  },
  async (args) => {
    if (!args.interval && !(args.from && args.to)) {
      throw new Error("Set either `interval` or both `from` and `to`");
    }
    const params: ReportParams = {
      range: {
        ...(args.from && args.to ? { from: args.from, to: args.to } : { interval: args.interval }),
        ...(args.timezone && { timezone: args.timezone }),
      },
      grouping: args.grouping,
      metrics: args.metrics?.length ? args.metrics : DEFAULT_METRICS,
      filters: args.filters as ReportParams["filters"],
      sort: args.sort_by ? [{ name: args.sort_by, order: args.sort_order }] : undefined,
      limit: args.limit,
      offset: args.offset,
    };
    const report = await keitaro().buildReport(params);
    return json({ total: report.total, summary: report.summary, rows: report.rows });
  },
);

await server.connect(new StdioServerTransport());
