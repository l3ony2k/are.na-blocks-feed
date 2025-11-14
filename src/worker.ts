/* eslint-disable @typescript-eslint/no-unused-vars */
import templateHtml from "../index.html";
import styleCss from "../style.css";
import themeJs from "../theme.js";
import appJs from "../app.js";
// @ts-ignore - WebP import handled by wrangler
import ogImage from "../og.webp";

type Env = {
  CHANNEL_SLUG: string;
  ARENA_ACCESS_TOKEN?: string;
};

const CACHE_TTL = 300; // 5 minutes
const PAGE_SIZE = 40; // Blocks per page for the main feed
const ARENA_PAGE_LIMIT = 100; // Are.na API maximum page size

interface ArenaBlock {
  id: number;
  created_at: string;
  position: number;
  class: string;
  content?: string;
  content_html?: string;
  title?: string;
  description?: string;
  description_html?: string;
  source?: { url: string };
  image?: {
    display: { url: string };
    large: { url: string };
    original: { url: string };
    thumb?: { url: string };
  };
  embed?: {
    html: string;
    type: string;
    title?: string;
    author_name?: string;
    width?: number;
    height?: number;
  };
}

interface ArenaChannelResponse {
  contents: ArenaBlock[];
  length: number;
}

const ALLOWED_CLASSES = new Set(["Text", "Media", "Image", "Link"]);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(date: Date): string {
  const pad = (n: number) => (n < 10 ? "0" + n : n.toString());
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} @ ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function filterAndSortBlocks(blocks: ArenaBlock[]): ArenaBlock[] {
  return blocks
    .filter((b) => ALLOWED_CLASSES.has(b.class))
    .sort((a, b) => b.position - a.position);
}

function renderBlock(block: ArenaBlock): string {
  const date = new Date(block.created_at);
  const dateLabel = formatDate(date);
  const blockId = `${block.id}`;

  let rendered = "";

  if (block.class === "Text") {
    if (block.content_html) {
      rendered = block.content_html;
    } else {
      const safe = block.content ? escapeHtml(block.content) : "";
      rendered = `<p>${safe.replace(/\n/g, "<br>")}</p>`;
    }
  } else if (block.class === "Image") {
    const altText = block.content ? escapeHtml(block.content) : `Are.na block ${block.id}`;
    if (block.image && block.image.display && block.image.display.url) {
      rendered = `<img src="${block.image.display.url}" alt="${altText}" style="max-width:100%; height:auto;"/>`;
    }
  } else if (block.class === "Media") {
    if (block.embed && block.embed.html) {
      rendered = `<div class="embed-container">${block.embed.html}</div>`;
    } else if (block.image && block.image.display && block.image.display.url) {
      const altText = block.content ? escapeHtml(block.content) : `Are.na block ${block.id}`;
      rendered = `<img src="${block.image.display.url}" alt="${altText}" style="max-width:100%; height:auto;"/>`;
    } else if (block.source && block.source.url) {
      const altText = block.content ? escapeHtml(block.content) : `Are.na block ${block.id}`;
      rendered = `<img src="${block.source.url}" alt="${altText}" style="max-width:100%; height:auto;"/>`;
    }
  } else if (block.class === "Link") {
    let thumbHtml = "";
    if (block.image && block.image.thumb && block.image.thumb.url) {
      const altText = block.title ? escapeHtml(block.title) : "";
      thumbHtml = `<img src="${block.image.thumb.url}" alt="${altText}" class="link-thumb"/>`;
    }

    let descriptionHtml = "";
    if (block.description_html) {
      descriptionHtml = `<div class="link-description">${block.description_html}</div>`;
    }

    let buttonHtml = "";
    if (block.source && block.source.url) {
      buttonHtml = `<a href="${block.source.url}" target="_blank" rel="noopener" class="link-button">Go to original</a>`;
    }

    rendered = `<div class="link-container">
                    ${thumbHtml}
                    <div class="link-main">
                      ${descriptionHtml}
                      ${buttonHtml}
                    </div>
                  </div>`;
  }

  let titleElement = "";
  if (block.title && block.title.trim()) {
    const titleHtml = escapeHtml(block.title.trim());
    if (block.description_html && block.description_html.trim()) {
      const tooltipId = `tooltip-${block.id}`;
      titleElement =
        `<div class="thought-title" data-tooltip-id="${tooltipId}">${titleHtml}</div>` +
        `<div class="tooltip-content" id="${tooltipId}" style="display: none;">${block.description_html}</div>`;
    } else {
      titleElement = `<div class="thought-title">${titleHtml}</div>`;
    }
  }

  return `<section class="thought-container" id="${blockId}" data-type="${block.class.toLowerCase()}">
            <div class="thought-header">
              <div class="thought-date"><a class="thought-date" href="#${blockId}">${dateLabel}</a></div>
              ${titleElement}
            </div>
            <div class="thought-content">${rendered}</div>
          </section>`;
}

function renderBlocksHtml(blocks: ArenaBlock[]): string {
  return blocks.map(renderBlock).join("\n");
}

async function fetchChannelInfo(slug: string, headers: Record<string, string>): Promise<ArenaChannelResponse> {
  const channelInfoUrl = `https://api.are.na/v2/channels/${encodeURIComponent(slug)}`;
  const response = await fetch(channelInfoUrl, {
    headers,
    // @ts-ignore - Cloudflare-specific property
    cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
  } as RequestInit);

  if (!response.ok) {
    throw new Error(`Failed to fetch Are.na channel info: ${response.status}`);
  }

  return (await response.json()) as ArenaChannelResponse;
}

async function fetchChannelPage(
  slug: string,
  page: number,
  perPage: number,
  headers: Record<string, string>
): Promise<ArenaChannelResponse> {
  const searchParams = new URLSearchParams({
    per: String(perPage),
    page: String(page),
    sort: "position",
    direction: "desc",
  });
  const apiUrl = `https://api.are.na/v2/channels/${encodeURIComponent(slug)}?${searchParams.toString()}`;
  const response = await fetch(apiUrl, {
    headers,
    // @ts-ignore - Cloudflare-specific property
    cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
  } as RequestInit);

  if (!response.ok) {
    throw new Error(`Failed to fetch Are.na channel page: ${response.status}`);
  }

  return (await response.json()) as ArenaChannelResponse;
}

async function fetchBlocksForPage(
  slug: string,
  page: number,
  perPage: number,
  headers: Record<string, string>
): Promise<ArenaBlock[]> {
  const pageData = await fetchChannelPage(slug, page, perPage, headers);
  return filterAndSortBlocks(pageData.contents);
}

async function fetchAllBlocks(
  slug: string,
  totalPages: number,
  perPage: number,
  headers: Record<string, string>
): Promise<ArenaBlock[]> {
  const pagePromises: Promise<ArenaChannelResponse>[] = [];
  for (let page = 1; page <= totalPages; page++) {
    pagePromises.push(fetchChannelPage(slug, page, perPage, headers));
  }

  const pageResponses = await Promise.all(pagePromises);
  const combined: ArenaBlock[] = [];
  for (const response of pageResponses) {
    combined.push(...response.contents);
  }

  return filterAndSortBlocks(combined);
}

function createConfigJson(totalBlocks: number, totalPages: number, pageSize: number): string {
  const config = {
    totalBlocks,
    totalPages,
    pageSize,
    initialPage: 1,
  };

  return JSON.stringify(config).replace(/</g, "\\u003c");
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${CACHE_TTL}`,
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/style.css") {
      return new Response(styleCss, {
        headers: {
          "content-type": "text/css; charset=utf-8",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    if (url.pathname === "/theme.js") {
      return new Response(themeJs, {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    if (url.pathname === "/app.js") {
      return new Response(appJs, {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    if (url.pathname === "/og.webp") {
      return new Response(ogImage, {
        headers: {
          "content-type": "image/webp",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    if (url.pathname !== "/" && url.pathname !== "/embed" && url.pathname !== "/api/blocks") {
      return new Response("Not found", { status: 404 });
    }

    const cacheKey = new Request(request.url, request);
    const cache = (caches as any).default as Cache;

    // API endpoint for paginated HTML snippets
    if (url.pathname === "/api/blocks") {
      const cachedApiResponse = await cache.match(cacheKey);
      if (cachedApiResponse) {
        return cachedApiResponse;
      }

      const pageParam = url.searchParams.get("page");
      const pageNumber = pageParam ? parseInt(pageParam, 10) : NaN;
      if (!pageNumber || pageNumber < 1) {
        return jsonResponse({ error: "Invalid page" }, 400);
      }

      const slug = env.CHANNEL_SLUG;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (env.ARENA_ACCESS_TOKEN) {
        headers["Authorization"] = `Bearer ${env.ARENA_ACCESS_TOKEN}`;
      }

      try {
        const blocks = await fetchBlocksForPage(slug, pageNumber, Math.min(PAGE_SIZE, ARENA_PAGE_LIMIT), headers);
        const html = renderBlocksHtml(blocks);
        const response = jsonResponse({ html });
        // @ts-ignore - ExecutionContext typing is minimal
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      } catch (error) {
        return jsonResponse({ error: "Failed to load blocks" }, 500);
      }
    }

    const isEmbed = url.pathname === "/embed";
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    const slug = env.CHANNEL_SLUG;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (env.ARENA_ACCESS_TOKEN) {
      headers["Authorization"] = `Bearer ${env.ARENA_ACCESS_TOKEN}`;
    }

    try {
      const channelInfo = await fetchChannelInfo(slug, headers);
      const totalBlocks = channelInfo.length;

      if (isEmbed) {
        const perPage = Math.min(PAGE_SIZE, ARENA_PAGE_LIMIT);
        const totalPages = totalBlocks > 0 ? Math.ceil(totalBlocks / perPage) : 1;
        const initialBlocks = await fetchBlocksForPage(slug, 1, perPage, headers);
        const blocksHtml = renderBlocksHtml(initialBlocks);
        const configJson = createConfigJson(totalBlocks, totalPages, perPage);

        const html = `<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta http-equiv="Cache-Control" content="no-store">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <!-- open graph -->
    <meta property="og:title" content="Leon's Journal" />
    <meta property="og:description" content="A page of things in my mind." />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Leon's Journal" />
    <meta property="og:image" content="/og.webp" />

    <link rel="stylesheet" type="text/css" href="/style.css">
    <title>Leon's Journal - Embed</title>
    <style>
      #header-bar, #footer-bar {
        display: none !important;
      }
      #content-area {
        padding: 0 1em !important;
        top: 0;
        bottom: 0;
      }
      .thought-container {
        margin: 1em 0 !important;
      }
    </style>
  </head>
  <body data-theme="system">
    <main id="content-area">
      <div class="content-inner">
        ${blocksHtml}
      </div>
    </main>
    <script id="blocks-config" type="application/json">${configJson}</script>
    <script src="/theme.js"></script>
    <script src="/app.js"></script>
  </body>
</html>`;

        const response = new Response(html, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": `public, max-age=${CACHE_TTL}`,
          },
        });

        // @ts-ignore - ExecutionContext typing is minimal
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      }

      const perPage = Math.min(PAGE_SIZE, ARENA_PAGE_LIMIT);
      const totalPages = totalBlocks > 0 ? Math.ceil(totalBlocks / perPage) : 1;
      const initialBlocks = await fetchBlocksForPage(slug, 1, perPage, headers);
      const blocksHtml = renderBlocksHtml(initialBlocks);
      const configJson = createConfigJson(totalBlocks, totalPages, perPage);

      let html = templateHtml.replace("<!--THOUGHTS-->", blocksHtml);
      html = html.replace("__BLOCKS_CONFIG__", configJson);

      const response = new Response(html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": `public, max-age=${CACHE_TTL}`,
        },
      });

      // @ts-ignore - ExecutionContext typing is minimal
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (error) {
      return new Response("Failed to load channel", { status: 500 });
    }
  },
};
